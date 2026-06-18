export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
import { GATED_MODES } from "@/types/subscription";
import { generate, generateStream, MODELS } from "@/lib/ai/engine";
import { buildSceneBlueprint } from "@/lib/ai/scene-blueprint";
import { capContextForTier } from "@/lib/ai/context-caps";
import { buildAiismsInstruction } from "@/lib/ai/aiisms";
import { db } from "@/db";
import { generations, projects, users } from "@/db/schema";
import { and, eq, sql, lte, ne } from "drizzle-orm";
import { universeEvents, universeCharacters, projectCharacterStates, seriesBibles } from "@/db/schema";
import { track } from "@/lib/analytics";

const VIOLATION_PATTERNS: Record<string, {
  detect: (prompt: string) => boolean;
  flagMessage: string;
  supportMode: string;
}> = {
  "op_protagonist": {
    detect: (p) => /overpowered|(?<!\w)OP(?!\w)|perfect.*protagonist|no.*weakness|always win|never fail/i.test(p),
    flagMessage: "This request appears to involve an overpowered/perfect protagonist. If intentional (power fantasy, isekai wish-fulfillment, parody), confirm below and I'll generate with full craft support for that specific mode. If unintentional, consider adding external constraints — who they care about, what they refuse to do, information gaps — to create tension without reducing their power.",
    supportMode: "The OP character's tension is external: stakes come from who they love, what they won't do, and costs to others. I'll write with this in mind.",
  },
  "villain_accent": {
    detect: (p) => /villain.*accent|evil.*accent|bad.*guy.*foreign/i.test(p),
    flagMessage: "Assigning a foreign/non-standard accent to a villain activates a documented harmful trope. If intentional (the story is explicitly about this bias, or you're subverting it), confirm. Otherwise, consider: what if the villain speaks with the prestige accent, and the most trustworthy character has the stigmatized accent?",
    supportMode: "Using accent subversion to challenge reader assumptions. The villain's prestige accent is their armor. I'll write this with full awareness.",
  },
  "supercrip_disability": {
    detect: (p) => /blind.*radar|deaf.*super|disability.*superpower|disability.*gift/i.test(p),
    flagMessage: "This appears to use a disability as a superpower source (the 'Supercrip' trope). If intentional subversion or genre-aware choice, confirm. Otherwise, consider: the disability is one dimension of a whole person, not the source of their extraordinary ability.",
    supportMode: "Writing disability with full human complexity. The superpower, if present, comes from something other than the disability itself.",
  },
};

async function buildSeriesUniverseContext(proj: any, userId: string): Promise<string> {
  if (!proj) return '';
  const lines: string[] = [];

  // SERIES: walk seriesParentId chain to collect previous stories' key events
  if (proj.storyType === 'series' && proj.seriesParentId) {
    const previousStories: any[] = [];
    let currentId: string | null = proj.seriesParentId;
    let depth = 0;
    while (currentId && depth < 10) {
      const prev = await db.query.projects.findFirst({
        where: and(eq(projects.id, currentId), eq(projects.userId, userId)),
        columns: { id: true, name: true, seriesParentId: true },
        with: { storyMemories: { limit: 5, orderBy: (m, { desc }) => [desc(m.createdAt)] } },
      });
      if (!prev) break;
      previousStories.unshift(prev);
      currentId = (prev as any).seriesParentId ?? null;
      depth++;
    }
    if (previousStories.length > 0) {
      lines.push('SERIES CONTEXT — events from previous books that inform this story:');
      previousStories.forEach((story: any, i: number) => {
        lines.push(`\nBook ${i + 1}: ${story.name}`);
        if (story.storyMemories?.length) {
          story.storyMemories.forEach((m: any) => {
            if (m.structuredData?.keyEvents?.length) {
              lines.push(`  Key: ${m.structuredData.keyEvents.join(' | ')}`);
            } else if (m.fact) {
              lines.push(`  - ${m.fact}`);
            }
          });
        }
      });
    }
  }

  // UNIVERSE: inject canonical events + character states from earlier-positioned stories
  if (proj.storyType === 'universe-story' && proj.universeId && proj.timelineSort != null) {
    const canonEvents = await db.query.universeEvents.findMany({
      where: and(
        eq(universeEvents.universeId, proj.universeId),
        eq(universeEvents.isCanon, true),
        lte(universeEvents.timelineSort, (proj.timelineSort ?? 0) - 1)
      ),
      orderBy: (e, { asc }) => [asc(e.timelineSort)],
      limit: 15,
    });
    if (canonEvents.length > 0) {
      lines.push('UNIVERSE CANON — events established before this story:');
      canonEvents.forEach((e: any) => {
        lines.push(`- ${e.name}${e.description ? ': ' + e.description : ''}`);
      });
    }

    // Universe characters with states from prior stories
    const uniChars = await db.query.universeCharacters.findMany({
      where: eq(universeCharacters.universeId, proj.universeId),
      with: { states: true },
    });
    const priorProjs = await db.query.projects.findMany({
      where: and(eq(projects.universeId, proj.universeId), ne(projects.id, proj.id)),
      columns: { id: true, timelineSort: true },
    });
    const priorProjIds = new Set(
      priorProjs
        .filter((p: any) => (p.timelineSort ?? 0) < (proj.timelineSort ?? 0))
        .map((p: any) => p.id)
    );
    if (uniChars.length > 0) {
      const charLines: string[] = [];
      for (const char of uniChars) {
        const priorState = (char as any).states
          ?.filter((s: any) => priorProjIds.has(s.projectId))
          .sort((a: any, b: any) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0))[0];
        if (priorState?.isDeceased) {
          charLines.push(`${char.name}: DECEASED (do not include in this story)`);
          continue;
        }
        const parts: string[] = [`${char.name}:`];
        const baseProfile = (char as any).baseProfile as any;
        if (baseProfile?.role) parts.push(`  Role: ${baseProfile.role}`);
        if (priorState?.emotionalState) parts.push(`  State: ${priorState.emotionalState}`);
        if (priorState?.stateNotes) parts.push(`  History: ${priorState.stateNotes}`);
        charLines.push(parts.join('\n'));
      }
      if (charLines.length > 0) {
        lines.push('\nUNIVERSE CHARACTERS — state at the start of this story:');
        lines.push(...charLines);
      }
    }
  }

  return lines.length > 0 ? '\n\n--- STORY UNIVERSE ---\n' + lines.join('\n') : '';
}

async function buildSeriesBibleContext(projectId: string, userId: string): Promise<string> {
  const bibles = await db.query.seriesBibles.findMany({ where: eq(seriesBibles.userId, userId) });
  const bible = bibles.find((b: any) => (b.projectIds as string[] | null)?.includes(projectId));
  if (!bible) return '';

  const lines: string[] = [`Series: "${bible.name}"`];
  if (bible.premise) lines.push(`Premise: ${bible.premise}`);
  if (bible.tone) lines.push(`Tone: ${bible.tone}`);

  const worldRules = (bible.worldRules as string[] | null) ?? [];
  if (worldRules.length > 0) {
    lines.push('World rules (must hold across every book in this series):');
    worldRules.forEach((r) => lines.push(`- ${r}`));
  }

  const arcs = (bible.seriesCharacterArcs as { characterName: string; arcSummary: string; booksInvolved: string[] }[] | null) ?? [];
  if (arcs.length > 0) {
    lines.push('Series-spanning character arcs:');
    arcs.forEach((a) => lines.push(`- ${a.characterName}: ${a.arcSummary}${a.booksInvolved?.length ? ` (books: ${a.booksInvolved.join(', ')})` : ''}`));
  }

  if (bible.continuityNotes) lines.push(`Continuity notes: ${bible.continuityNotes}`);

  const timeline = (bible.timeline as { event: string; period: string; projectId?: string }[] | null) ?? [];
  if (timeline.length > 0) {
    lines.push('Series timeline:');
    timeline.forEach((t) => lines.push(`- ${t.period ? `[${t.period}] ` : ''}${t.event}`));
  }

  return lines.length > 1 ? '\n\n--- SERIES BIBLE ---\n' + lines.join('\n') : '';
}

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const { mode, prompt, context, staticContext, dynamicContext, format, projectId, chapterId, bypassViolationCheck, narrativeStructure, additionalContext, stream } = await req.json();

  if (!prompt?.trim()) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  if (!mode) return NextResponse.json({ error: "Mode is required" }, { status: 400 });

  // Violation detection: check prompt against known harmful patterns
  if (!bypassViolationCheck && projectId) {
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
    });
    const confirmed = ((project as any)?.intentionalViolations || {}) as Record<string, any>;
    for (const [violationType, pattern] of Object.entries(VIOLATION_PATTERNS)) {
      if (pattern.detect(prompt) && !confirmed[violationType]?.confirmed) {
        return NextResponse.json({
          requiresConfirmation: true,
          violationType,
          flagMessage: pattern.flagMessage,
          supportMode: pattern.supportMode,
        });
      }
    }
  }

  // Tier check: mode-gated features (dialogue, combat, emotional, atmosphere, tension, composition)
  const tier = await getUserTier(session.user.id);

  // Server-side context caps: a deterministic ceiling per tier so the prompt-cache
  // block stays byte-identical across calls with the same input (cap only changes
  // on a tier change, which is an expected one-time cache miss).
  const { cappedStatic, cappedDynamic, cappedPrompt } = capContextForTier(tier, { staticContext, dynamicContext, prompt });

  const gatedFeature = GATED_MODES[mode as string];
  if (gatedFeature && !canAccessFeature(tier, gatedFeature)) {
    return NextResponse.json({ error: "upgrade_required", feature: gatedFeature, tier }, { status: 403 });
  }

  // Free tier: block all library modes
  const LIBRARY_MODES = new Set([
    'combat', 'emotional', 'atmosphere', 'tension', 'horror',
    'comedy', 'mystery', 'romance', 'action', 'monologue',
    'voice', 'thriller', 'sports', 'setting', 'historical',
    'scitech', 'ethics', 'endings', 'isekai', 'composition',
    'interrogation', 'chase',
  ]);
  if (tier === 'free' && LIBRARY_MODES.has(mode)) {
    return NextResponse.json({
      error: 'upgrade_required',
      feature: 'story_modes_advanced',
      message: 'Library modes require Story Pro. Upgrade for all 23 library modes.',
    }, { status: 403 });
  }

  // Free tier: route to Haiku (4.5x cheaper, proves value, drives upgrades)
  const overrideModel = tier === 'free' ? MODELS.fast : undefined;

  const gate = await meterAndGate(session.user.id, "generate");
  if (gate) return gate;

  const totalLength = (context || "").length + (prompt || "").length;
  if (totalLength > 150000) {
    return NextResponse.json({ error: "Context too large. Try reducing your World Bible or clearing old memories." }, { status: 400 });
  }

  try {
    // Brainstorm mode: append 3-options directive
    let effectivePrompt = cappedPrompt;
    if (mode === 'brainstorm') {
      effectivePrompt = cappedPrompt + `\n\nReturn exactly 3 distinct structural approaches as options. Do not pick one.\nFormat strictly:\n\nOPTION A — [SHORT NAME]:\n[2-3 sentences describing the structural direction, opening, key tension]\n\nOPTION B — [SHORT NAME]:\n[2-3 sentences describing a different structural direction]\n\nOPTION C — [SHORT NAME]:\n[2-3 sentences describing a third structural direction]\n\n---\nEach option must represent a genuinely different creative direction, not variations of the same idea.\nOne option should subvert expectations.`;
    }
    else if (mode === 'outline') {
      effectivePrompt = cappedPrompt + `\n\nFormat each beat as a numbered list item starting with "BEAT:":\nBEAT: [beat description in present tense, 1-2 sentences]\n\nGenerate 6-12 beats appropriate for this story. Each beat should describe what happens in the scene and what changes as a result.`;
    }

    // AIisms check + series/universe context (fetch project once for both)
    let aiismsNote = '';
    let seriesUniverseCtx = '';
    if (projectId) {
      const proj = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
      });
      if (tier !== 'free' && (proj as any)?.aiismsCheck) {
        aiismsNote = '\n\n' + buildAiismsInstruction();
      }
      if ((proj as any)?.storyType === 'series' || (proj as any)?.storyType === 'universe-story') {
        seriesUniverseCtx = await buildSeriesUniverseContext(proj, session.user.id);
      }
      const seriesBibleCtx = await buildSeriesBibleContext(projectId, session.user.id);
      if (seriesBibleCtx) seriesUniverseCtx += seriesBibleCtx;
    }

    // Series/universe context belongs in the static (cached) block — it doesn't change mid-session.
    // Appended AFTER the cap so server-derived series/universe context is never truncated by a
    // client-inflated static block.
    const effectiveStatic = seriesUniverseCtx
      ? (cappedStatic ?? '') + '\n\n---\n' + seriesUniverseCtx
      : cappedStatic;

    const RESEARCH_MODES = new Set(['historical', 'scitech', 'sports', 'setting']);
    let domainResearchContext = '';

    if (RESEARCH_MODES.has(mode) && process.env.GEMINI_API_KEY) {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const researchMsg = await gemini.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: [{
            text: `Quick domain research for fiction writing accuracy:
Topic: "${prompt}"
Mode: ${mode}

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

    const effectiveDynamic = [cappedDynamic, additionalContext, aiismsNote, domainResearchContext].filter(Boolean).join('\n\n');

    // Planner step (P0): a fast Haiku scene blueprint that gives the writer a
    // concrete plan before drafting prose — the biggest lever against generic output.
    // Opt-in for paid tiers; fail-open so it never blocks generation.
    let sceneBlueprint = '';
    if (mode === 'write' && tier !== 'free') {
      sceneBlueprint = await buildSceneBlueprint({ prompt: effectivePrompt, staticContext: effectiveStatic ?? undefined, dynamicContext: effectiveDynamic, format });
    }
    const finalDynamic = [effectiveDynamic, sceneBlueprint].filter(Boolean).join('\n\n') || undefined;

    // Streaming path: emit text deltas live, then persist the generation record on completion.
    if (stream) {
      const encoder = new TextEncoder();
      const userId = session.user.id;
      const readable = new ReadableStream({
        async start(controller) {
          try {
            const r = await generateStream(
              { mode, prompt: effectivePrompt, context, staticContext: effectiveStatic, dynamicContext: finalDynamic, format, narrativeStructure, overrideModel },
              (delta) => { try { controller.enqueue(encoder.encode(delta)); } catch { /* client gone */ } },
            );
            await db.insert(generations).values({
              projectId, chapterId: chapterId || null, mode, prompt: cappedPrompt,
              output: r.text, model: r.model, tokensUsed: r.tokensUsed,
            });
            await track(userId, 'ai_generation', { mode, format: format ?? '', streamed: true });
          } catch (err: any) {
            await refundCredits(userId, "generate");
            console.error(`[gen-stream] ${err?.status} ${(err?.message || '').slice(0, 200)}`);
            try { controller.enqueue(encoder.encode('\n\n[Generation interrupted. Please try again.]')); } catch { /* noop */ }
          } finally {
            try { controller.close(); } catch { /* noop */ }
          }
        },
      });
      return new Response(readable, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    const r = await generate({ mode, prompt: effectivePrompt, context, staticContext: effectiveStatic, dynamicContext: finalDynamic, format, narrativeStructure, overrideModel });
    await db.insert(generations).values({
      projectId, chapterId: chapterId || null, mode, prompt: cappedPrompt,
      output: r.text, model: r.model, tokensUsed: r.tokensUsed,
    });
    await track(session.user.id, 'ai_generation', { mode, format: format ?? '' });
    return NextResponse.json(r);
  } catch (e: any) {
    // Generation failed after the quota was already counted — refund it so failed
    // requests don't consume the user's monthly allowance.
    await refundCredits(session.user.id, "generate");
    const msg = e?.message || "";
    console.error(`[gen] ${e?.status} ${msg.slice(0, 300)}`);
    if (msg.includes("rate_limit") || msg.includes("529"))
      return NextResponse.json({ error: "Anthropic rate limit hit. Wait a moment and try again.", retryable: true }, { status: 429 });
    if (msg.includes("context_length") || msg.includes("too long"))
      return NextResponse.json({ error: "Context too long. Reduce World Bible detail or clear old memories." }, { status: 400 });
    return NextResponse.json({ error: "Generation failed. Please try again." }, { status: 500 });
  }
}
