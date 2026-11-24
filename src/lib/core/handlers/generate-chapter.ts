/**
 * Phase 2 / v4 §7 — `generateChapter`, the fifth shared business handler.
 *
 * v4 §7 names four handlers that must exist once behind auth adapters; this one
 * was last because it is the heaviest: `/api/ai/generate` carried inline
 * violations policy, mode gating, per-tier context caps, two bible-context
 * builders, and four prose-augmentation helpers in one 421-line body.
 *
 * What Core owns here is the POLICY that should not drift:
 *
 *  - the 400 contract (blank prompt / blank mode / unknown mode) — moved out of
 *    the route's if-chain so it is unit-testable without HTTP;
 *  - the violation gate — `detectGenerationViolation` against the caller's
 *    previously-confirmed record, loaded through a port the host supplies;
 *  - the pipeline wiring itself — this is the first production binding of
 *    `runGenerationPipeline`, which until now had zero real call sites.
 *
 * What the HOST (route) owns is everything I/O-shaped: reading the violation
 * record, assembling context, calling a model, persisting, billing. Those arrive
 * as ports and pass through untouched.
 *
 * Stops contract (what the adapter maps to transport):
 *  - `stoppedAt: "validate"`  → `control` IS the 400 body.
 *  - `stoppedAt: "authorize"` → `control` IS the violation-confirmation body
 *    (a 200 control response, NOT an error).
 *  - `stoppedAt: "resolveGate"` → ledger refusal (`reason` is
 *    `upgrade_required:<feature>`, `gateRef` carries the feature id); the
 *    adapter shapes the 403 paywall body from them.
 *  - `stoppedAt: "reserve"` → `control` IS the billing refusal response, passed
 *    through verbatim — it must never be re-serialized.
 *
 * It does NOT import `@/db`, `next/auth`, or `next/server` — the route is still
 * the thin adapter that produces a context, calls the handler, and shapes a
 * response. It does import `@/lib/modes/registry` and `@/lib/ai/generation-service`,
 * both of which are import-pure (types and functions only, no framework, no DB).
 */

import { isGenerationMode } from "@/lib/modes/registry";
import {
  runGenerationPipeline,
  type GenerationOutcome,
  type GenerationPorts,
  type PipelineStage,
  type StageOutcome,
} from "@/lib/ai/generation-service";
import {
  detectGenerationViolation,
  violationConfirmation,
  type ConfirmedViolations,
} from "@/lib/core/policy/generation-violations";
import type { RequestContext } from "@/lib/core/request-context";

export interface GenerateChapterInput {
  readonly mode: string;
  readonly prompt: string;
  readonly projectId?: string;
  readonly chapterId?: string;
  /** Set by the client after the caller has read the flagMessage and confirmed. */
  readonly bypassViolationCheck?: boolean;
  /** Host- or client-supplied extras the provider never sees directly. */
  readonly staticContext?: string;
  readonly dynamicContext?: string;
  /** Body-level client context the mount's buildContext lane composes (the
   * provider never sees it directly). Slice 4d: rides the pipeline request so
   * a planted local builder can compose it — the cloud route keeps composing
   * it from the body instead. */
  readonly additionalContext?: string;
  readonly format?: string;
}

export interface GenerateChapterPorts
  extends Omit<GenerationPorts<GenerateChapterInput>, "authorize"> {
  /**
   * Reads the caller's per-project record of previously confirmed violations.
   * Supplying this arms the violation gate; omitting it leaves `authorize`
   * unwired, which is the deliberate shape of a local host with no policy
   * store.
   */
  loadViolations?: (projectId: string, actorId: string) => Promise<ConfirmedViolations>;
  /** Forwarded to the pipeline's stage callback (streaming UI progress). */
  onStage?: (stage: PipelineStage) => void;
}

/**
 * The 400 contract, previously an inline chain in the route. The `control`
 * payloads are the exact bodies the route returned, byte for byte.
 */
export function validateGenerateRequest(
  input: GenerateChapterInput,
): StageOutcome<GenerateChapterInput> {
  if (!input.prompt?.trim()) {
    return {
      stop: { ok: false, stoppedAt: "validate", control: { error: "Prompt is required" } },
    };
  }
  if (!input.mode) {
    return {
      stop: { ok: false, stoppedAt: "validate", control: { error: "Mode is required" } },
    };
  }
  // A truthiness check alone let an arbitrary string reach `MI[mode as
  // GenerationMode]` in engine.ts, which indexes a dispatch map with no optional
  // chaining and threw a TypeError — surfacing as an opaque 500 instead of a
  // 400. The registry-derived guard also rejects inherited Object keys
  // ("toString", "constructor").
  if (!isGenerationMode(input.mode)) {
    return {
      stop: {
        ok: false,
        stoppedAt: "validate",
        control: { error: `Unknown mode: ${String(input.mode)}` },
      },
    };
  }
  return input;
}

/**
 * The violation gate, previously an inline loop in the route. Runs on the RAW
 * prompt — it must not see truncated or directive-suffixed text, and it must
 * run before context building (it did, before the tier cap, in the route's
 * order).
 */
function violationGate(
  loadViolations: NonNullable<GenerateChapterPorts["loadViolations"]>,
  ctx: RequestContext,
): NonNullable<GenerationPorts<GenerateChapterInput>["authorize"]> {
  return async (req) => {
    if (req.bypassViolationCheck || !req.projectId) return undefined;
    const confirmed = await loadViolations(req.projectId, ctx.actor.id);
    const hit = detectGenerationViolation(req.prompt, confirmed);
    if (!hit) return undefined;
    return { stop: { ok: false, stoppedAt: "authorize", control: violationConfirmation(hit) } };
  };
}

export async function generateChapter(
  input: GenerateChapterInput,
  ctx: RequestContext,
  ports: GenerateChapterPorts,
): Promise<GenerationOutcome> {
  const { loadViolations, ...gen } = ports;
  return runGenerationPipeline<GenerateChapterInput>(
    input,
    {
      validate: validateGenerateRequest,
      ...(loadViolations ? { authorize: violationGate(loadViolations, ctx) } : {}),
      ...gen,
    },
    ports.onStage,
  );
}
