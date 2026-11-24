export const dynamic = 'force-dynamic';

/**
 * Phase 2 / v4 §7 — the route is now a THIN adapter.
 *
 * Core (`generateChapter`) owns the 400 contract, the violation gate, and the
 * pipeline wiring. This file is the host: it reads the session, prefetched the
 * tier, and supplies I/O-shaped ports (violation record, gates, context
 * assembly, metering, the engine, persistence, refunds).
 *
 * Stop-to-HTTP mapping (the documented stop contract from the handler):
 *  - `validate`   → control IS the error body            → `NextResponse.json(control, 400)`
 *  - `authorize`  → control IS the violation confirmation → `NextResponse.json(control)` (200)
 *  - `buildContext` → control IS the context-size error   → `NextResponse.json(control, 400)`
 *  - `resolveGate` → gateRef denial → the 403 paywall body; the pipeline's
 *    `reason` already reads `upgrade_required:<feature>`
 *  - `reserve`    → control IS the meter's NextResponse   → returned verbatim, never re-serialized
 *  - a failure after `reserve` has already been refunded by the pipeline's
 *    `finalizeUsage` port → the documented 429/400/500 error mapping below
 *
 * Behavior preserved byte-for-byte from the pre-adapter route (see git history
 * for the inline version): the streaming branch reuses the same assembled
 * context as the non-streaming path, streamed requests persist/track/refund
 * from inside the stream's own lifecycle, and every control-response body is
 * the exact string the old inline code returned.
 */

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier } from "@/lib/subscription";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
import { GATED_MODES } from "@/types/subscription";
import { generate, generateStream, MODELS } from "@/lib/ai/engine";
import { capContextForTier } from "@/lib/ai/context-caps";
import { buildAiismsInstruction } from "@/lib/ai/aiisms";
import { db } from "@/db";
import { generations, projects, users } from "@/db/schema";
import { and, eq, sql, lte, ne } from "drizzle-orm";
import { universeEvents, universeCharacters, projectCharacterStates, seriesBibles, universes } from "@/db/schema";
import { track } from "@/lib/analytics";
import { isFeatureOnServer } from "@/lib/growthbook-server";
import { FLAGS } from "@/lib/growthbook";
import { buildSceneBlueprint } from "@/lib/ai/scene-blueprint";
import { buildPromiseLedger } from "@/lib/ai/promise-ledger";
import { buildVoiceExemplars } from "@/lib/ai/exemplars";
import { buildAuthorVoiceExemplars } from "@/lib/ai/author-voice";
import { groundInWebResearch, isGroundableMode } from "@/lib/ai/web-research";

// Core: the 400 contract + violation gate + pipeline binding live here now.
import { generateChapter, type GenerateChapterInput, type GenerateChapterPorts } from "@/lib/core/handlers/generate-chapter";
import { cloudContext, type RequestContext } from "@/lib/core/request-context";
import type { GenerationOutcome } from "@/lib/ai/generation-service";
import type { GenerationMode } from "@/lib/modes/registry";
// Request-boundary context assembly, moved verbatim from the inline route body.
import {
  applyModePromptDirective,
  appendSeriesContext,
  composeDynamicContext,
  isResearchMode,
  shouldRunProseAugmentation,
  buildSeriesUniverseContext,
  buildSeriesBibleContext,
} from "@/lib/ai/generation-context";
// The legacy-cloud interpretation of subscription gates — the single place
// allowed to know what a gate means here.
import { cloudGateResolver } from "@/lib/capabilities/cloud-gate-adapter";
import type { CapabilityGate } from "@/lib/capabilities/gate";

/** Body fields the handler input does not carry; the route keeps them local. */
type GenerateBody = GenerateChapterInput & {
  context?: string;
  narrativeStructure?: string;
  additionalContext?: string;
  skipBlueprint?: boolean;
  stream?: boolean;
  groundInResearch?: boolean;
};

function toResponse(outcome: GenerationOutcome, tier: string): Response {
  // Success: the inline route returned `NextResponse.json(r)` — the engine's
  // own { text, model, tokensUsed } object, not a wrapped shape.
  if (outcome.ok) {
    return NextResponse.json({
      text: outcome.text,
      model: outcome.model,
      tokensUsed: outcome.tokensUsed,
    });
  }
  if (outcome.control !== undefined) {
    // Pre-reserve stops never cost anything, so none of these can be a refund
    // case. `control` is either a body to serialize or (for `reserve`) the
    // meter's own NextResponse, passed through verbatim.
    if (outcome.control instanceof Response) return outcome.control;
    if (outcome.stoppedAt === "authorize") return NextResponse.json(outcome.control);
    return NextResponse.json(outcome.control, { status: 400 });
  }
  if (outcome.gateRef) {
    // The pipeline's denial: shape the same 403 body the old inline check
    // returned — `feature` is the registry's gate, not a deleted set's copy.
    return NextResponse.json(
      { error: "upgrade_required", feature: outcome.gateRef.value, tier },
      { status: 403 },
    );
  }
  // A failure after `reserve`: the pipeline already called finalizeUsage,
  // whose port below refunded the credit. Only the transport mapping remains.
  const msg = outcome.reason ?? "";
  console.error(`[gen] ${msg.slice(0, 300)}`);
  if (msg.includes("rate_limit") || msg.includes("529"))
    return NextResponse.json({ error: "Anthropic rate limit hit. Wait a moment and try again.", retryable: true }, { status: 429 });
  if (msg.includes("context_length") || msg.includes("too long"))
    return NextResponse.json({ error: "Context too long. Reduce World Bible detail or clear old memories." }, { status: 400 });
  return NextResponse.json({ error: "Generation failed. Please try again." }, { status: 500 });
}

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const body = await req.json() as GenerateBody;
  const ctx: RequestContext = cloudContext(session.user.id);
  const userId = ctx.actor.id;

  // Tier is pre-fetched before the pipeline: `gateFacts`, `capContextForTier`,
  // and the free-tier model override all depend on it. Accepted deviation from
  // the inline route: the tier read now happens even for requests that will
  // stop at validate/authorize (it is a read; no observable wire change).
  const tier = await getUserTier(userId);
  // Free tier: route to Haiku (4.5x cheaper, proves value, drives upgrades)
  const overrideModel = tier === 'free' ? MODELS.fast : undefined;

  // Memoized project read. The inline route fetched this row twice — once for
  // the violation check, once for the AIisms/series context. Both stage
  // closures now share one memoized promise.
  let projectRowPromise: Promise<any> | null = null;
  const loadProject = () => {
    if (!body.projectId) return Promise.resolve(null);
    projectRowPromise ??= db.query.projects.findFirst({
      where: and(eq(projects.id, body.projectId), eq(projects.userId, userId)),
    });
    return projectRowPromise;
  };

  // The prompt persisted in the generations row is the TIER-CAPPED prompt,
  // without the mode directive suffix (the old inline code persisted the same).
  let recordPrompt = body.prompt ?? "";
  // Captured inside buildContext so `generate`/`generateStream` get the
  // directive-suffixed prompt (the old inline code had `effectivePrompt`).
  let effectivePrompt = recordPrompt;
  // The streaming Response is built inside the `generate` port and handed back
  // here — the pipeline's success path has no text for it.
  let streamResponse: Response | null = null;

  const ports: GenerateChapterPorts = {
    loadViolations: async (projectId) => {
      const row = await loadProject();
      return ((row as { intentionalViolations?: Record<string, unknown> } | null)?.intentionalViolations || {}) as Record<string, unknown>;
    },

    gates: (req) => {
      // The registry-derived paywall. Ungated modes resolve to `null` —
      // `resolveGates` treats it as allowed.
      const feature = (GATED_MODES as Record<string, string | undefined>)[req.mode];
      return [feature ? ({ kind: "subscription", value: feature } as CapabilityGate) : null];
    },
    gateFacts: { tier },
    gateResolver: cloudGateResolver(),

    buildContext: async (req) => {
      // Size ceiling FIRST, before any project fetch, research call, or
      // augmentation spend — an oversized request paid nothing extra in the
      // inline route and must not pay more now.
      const totalLength = (body.context || "").length + (body.prompt || "").length;
      if (totalLength > 150000) {
        return {
          stop: {
            ok: false,
            stoppedAt: "buildContext",
            control: { error: "Context too large. Try reducing your World Bible or clearing old memories." },
          },
        };
      }

      const { cappedStatic, cappedDynamic, cappedPrompt } = capContextForTier(tier, {
        staticContext: req.staticContext,
        dynamicContext: req.dynamicContext,
        prompt: req.prompt,
      });
      effectivePrompt = applyModePromptDirective(req.mode, cappedPrompt ?? "");
      recordPrompt = cappedPrompt ?? "";

      // AIisms check + series/universe context (fetch project once for both)
      let aiismsNote = '';
      let seriesUniverseCtx = '';
      if (req.projectId) {
        const proj = await loadProject();
        if (tier !== 'free' && (proj as any)?.aiismsCheck) {
          aiismsNote = '\n\n' + buildAiismsInstruction();
        }
        if ((proj as any)?.storyType === 'series' || (proj as any)?.storyType === 'universe-story') {
          seriesUniverseCtx = await buildSeriesUniverseContext(proj, userId);
        }
        const seriesBibleCtx = await buildSeriesBibleContext(req.projectId, userId);
        if (seriesBibleCtx) seriesUniverseCtx += seriesBibleCtx;
      }

      // Series/universe context belongs in the static (cached) block — it doesn't change mid-session.
      // Appended AFTER the cap so server-derived series/universe context is never truncated by a
      // client-inflated static block.
      const effectiveStatic = appendSeriesContext(cappedStatic, seriesUniverseCtx);

      let domainResearchContext = '';

      if (isResearchMode(req.mode) && process.env.GEMINI_API_KEY) {
        try {
          const { GoogleGenAI } = await import('@google/genai');
          const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

          const researchMsg = await gemini.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: [{
              text: `Quick domain research for fiction writing accuracy:
Topic: "${body.prompt}"
Mode: ${req.mode}

Provide 3-5 specific, accurate facts that a writer would need to portray this
authentically. Focus on technical accuracy and realistic detail. Be brief.
Do NOT write the scene — just provide the accurate factual grounding.`,
            }],
          });

          const facts = researchMsg.text;
          if (facts && facts.trim().length > 50) {
            domainResearchContext = `\nDOMAIN ACCURACY NOTES (verified for this scene):\n${facts}\n`;
          }
        } catch { /* domain research failure must never block generation */ }
      }

      const effectiveDynamic = composeDynamicContext([cappedDynamic, body.additionalContext, aiismsNote, domainResearchContext]);

      // Prose-augmentation helpers, split per the 2026-06-21 six-model blind panel
      // (docs/quality-stack-eval-judging-2026-06-20.md + the panel's own eval):
      // judges disagreed on aggregate score (a wash) but unanimously agreed on the
      // SAME action, which the old bundled quality_stack flag couldn't express.
      //
      // Free, near-zero-cost grounding helpers (promise-ledger: DB-only, no LLM;
      // voice-exemplars: one cheap embedding call) run by DEFAULT, no flag — the
      // panel confirmed they suppress off-bible hallucination. The costly Haiku
      // scene-blueprint pre-pass runs ONLY behind sceneBlueprint (default OFF) —
      // the panel found its "wins" were length-driven and it actively hurts
      // tone-driven modes (horror/atmosphere/comedy). All three remain fail-open —
      // a failure in any one never blocks or alters base generation.
      let blueprint = '', promiseLedger = '', voiceExemplars = '', authorVoiceExemplars = '', webResearch = '';
      if (shouldRunProseAugmentation(req.mode as GenerationMode, req.projectId, tier)) {
        [promiseLedger, voiceExemplars, authorVoiceExemplars] = await Promise.all([
          buildPromiseLedger(req.projectId!),
          buildVoiceExemplars(userId, effectivePrompt, req.mode),
          buildAuthorVoiceExemplars(req.projectId!, body.chapterId, effectivePrompt),
        ]);

        // Real web-search grounding for historical/scitech -- unlike combat/emotional/
        // tension/atmosphere, these two modes have no synthetic craft library, only the
        // model's training-data recall. Strictly opt-in (groundInResearch must be
        // explicitly true) since it adds a real extra Claude call on top of generation.
        if (body.groundInResearch && isGroundableMode(req.mode)) {
          webResearch = await groundInWebResearch(req.mode, effectivePrompt);
        }

        const blueprintOn = await isFeatureOnServer(FLAGS.sceneBlueprint, userId, tier);
        if (blueprintOn && !body.skipBlueprint) {
          blueprint = await buildSceneBlueprint({ prompt: effectivePrompt, staticContext: effectiveStatic ?? undefined, dynamicContext: effectiveDynamic, format: req.format as string });
        }
      }
      const finalDynamic = composeDynamicContext([effectiveDynamic, promiseLedger, voiceExemplars, authorVoiceExemplars, webResearch, blueprint]) || undefined;

      return { static: effectiveStatic, dynamic: finalDynamic };
    },

    reserve: async () => {
      const gate = await meterAndGate(userId, "generate");
      if (gate) return { stop: { ok: false, stoppedAt: "reserve", control: gate } };
      return { operation: "generate", estimatedUnits: 1 };
    },

    generate: async (req, genCtx) => {
      const params = {
        mode: req.mode,
        prompt: effectivePrompt,
        context: body.context,
        staticContext: genCtx.staticContext,
        dynamicContext: genCtx.dynamicContext,
        format: req.format as string,
        narrativeStructure: body.narrativeStructure,
        overrideModel,
      };
      if (body.stream) {
        // Streaming path: emit text deltas live, then persist the generation
        // record inside the stream's own lifecycle — everything after this
        // point in the pipeline no-ops for a streamed request.
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
          async start(controller) {
            try {
              const r = await generateStream(
                params,
                (delta) => { try { controller.enqueue(encoder.encode(delta)); } catch { /* client gone */ } },
              );
              await db.insert(generations).values({
                projectId: req.projectId, chapterId: req.chapterId || null, mode: req.mode, prompt: recordPrompt,
                output: r.text, model: r.model, tokensUsed: r.tokensUsed,
              });
              await track(userId, 'ai_generation', { mode: req.mode, format: body.format ?? '', streamed: true });
            } catch (err: any) {
              await refundCredits(userId, "generate");
              console.error(`[gen-stream] ${err?.status} ${(err?.message || '').slice(0, 200)}`);
              try { controller.enqueue(encoder.encode('\n\n[Generation interrupted. Please try again.]')); } catch { /* noop */ }
            } finally {
              try { controller.close(); } catch { /* noop */ }
            }
          },
        });
        streamResponse = new Response(readable, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'X-Accel-Buffering': 'no',
          },
        });
        // The stream persists and refunds itself; no text for the outcome.
        return { text: "", model: overrideModel ?? "", tokensUsed: 0 };
      }
      const r = await generate(params);
      return r;
    },

    persist: async (out, req) => {
      // Streamed requests persist from inside the stream's own lifecycle.
      if (body.stream) return;
      if (out.control) return;
      await db.insert(generations).values({
        projectId: req.projectId, chapterId: req.chapterId || null, mode: req.mode, prompt: recordPrompt,
        output: out.text, model: out.model, tokensUsed: out.tokensUsed,
      });
      await track(userId, 'ai_generation', { mode: req.mode, format: body.format ?? '' });
    },

    finalizeUsage: async (_reservation, outcome) => {
      // The old route refunded in a catch after meterAndGate had charged; the
      // pipeline now guarantees the settle for every post-reserve failure.
      if (outcome.ok) return;
      await refundCredits(userId, "generate");
    },
  };

  const input: GenerateChapterInput = {
    mode: body.mode,
    prompt: body.prompt,
    projectId: body.projectId,
    chapterId: body.chapterId,
    bypassViolationCheck: body.bypassViolationCheck,
    staticContext: body.staticContext,
    dynamicContext: body.dynamicContext,
    format: body.format,
  };

  const outcome = await generateChapter(input, ctx, ports);
  if (streamResponse) return streamResponse;
  return toResponse(outcome, tier);
}
