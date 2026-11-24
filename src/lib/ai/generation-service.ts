/**
 * Phase 1 / v4 item 9 — GenerationService.
 *
 * v4's target pipeline:
 *
 *   validate -> authorize -> resolve capability/gate
 *   -> build context -> choose provider/model
 *   -> reserve/estimate usage -> generate/stream
 *   -> parse/validate -> persist
 *   -> propose Story Transactions
 *   -> finalize/refund usage
 *
 * This module is the seam that makes those stages explicit and independently
 * testable. It is a pure orchestrator: every stage is an injected function, so
 * the ordering, the short-circuits, and the refund-on-failure contract can be
 * asserted without React, without a database, and without spending a token.
 *
 * Two design rules that the tests hold it to:
 *
 *  1. **A stage that reserves usage must be settled.** If anything after
 *     `reserve` fails, `finalizeUsage` runs with the reservation so the caller
 *     can refund. A reservation silently dropped is a billing leak — the exact
 *     bug class Phase 0 spent its effort closing.
 *  2. **A failure before `reserve` costs nothing**, so it must not attempt to
 *     settle usage it never reserved.
 *
 * It deliberately does NOT know how to bill, how to call a model, or how to
 * persist. Those are ports. That is what lets a local Story OS host supply a
 * different provider and a different reservation strategy without touching this
 * file — the same goal as the generic CapabilityGate beside it.
 */

import type { CapabilityGate, GateFacts, GateResolver } from "@/lib/capabilities/gate";
import { resolveGates } from "@/lib/capabilities/gate";

/** Every stage name, in pipeline order. Exported so tests can assert order. */
export const PIPELINE_STAGES = [
  "validate",
  "authorize",
  "resolveGate",
  "buildContext",
  "chooseProvider",
  "reserve",
  "generate",
  "parse",
  "persist",
  "proposeTransactions",
  "finalizeUsage",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/**
 * A stage outcome. `undefined` means "done, carry on"; `{ stop }` ends the
 * pipeline early with a result; throwing is an unexpected failure and triggers
 * the settle path.
 */
export type StageOutcome<T> = T | { stop: GenerationOutcome };

/** A port may return its result directly or as a promise; both are awaited. */
export type MaybeAsync<T> = T | Promise<T>;

export interface GenerationRequest {
  readonly mode: string;
  readonly prompt: string;
  readonly projectId?: string;
  readonly chapterId?: string;
  readonly format?: string;
}

export interface GeneratedOutput {
  readonly text: string;
  readonly model?: string;
  readonly tokensUsed?: number;
  /**
   * A non-fatal control response from the endpoint — `upgrade_required`,
   * `rate_limit`, a violation confirmation, etc. These are NOT errors: the
   * endpoint answers 200 with a control payload and the client is expected to
   * show a prompt. Carrying them explicitly stops every caller from having to
   * re-invent the "check for data.error" convention.
   */
  readonly control?: unknown;
}

/** What a reservation represents, so a host can bill it however it likes. */
export interface UsageReservation {
  readonly operation: string;
  readonly estimatedUnits: number;
}

export interface GenerationOutcome {
  readonly ok: boolean;
  readonly text?: string;
  readonly model?: string;
  readonly tokensUsed?: number;
  /** Populated when `ok` is false. */
  readonly reason?: string;
  /** The stage that ended the pipeline. */
  readonly stoppedAt?: PipelineStage;
  /** Gates consulted, for telemetry and debugging. */
  readonly gates?: readonly CapabilityGate[];
  /** The specific gate that denied the request, when one did. */
  readonly gateRef?: CapabilityGate;
  /**
   * A structured halt from a pre-reserve stage (an empty prompt, a violation
   * confirmation, a paywall, an over-quota meter). `control` means "the request
   * was answered with a defined response, not an error" — a host decides the
   * transport (HTTP status, status line) from its own vocabulary. Carrying the
   * payload on the outcome is what lets a stop return a 200-with-prompt or a
   * verbatim billing response instead of forcing every denial through the
   * stringly-typed `reason`.
   */
  readonly control?: unknown;
}

/**
 * The ports. Every one is optional except `generate`, so a caller can supply only
 * the stages it cares about — but `reserve`/`finalizeUsage` are paired: if you
 * pass one you should pass both.
 */
export interface GenerationPorts<Req extends GenerationRequest = GenerationRequest> {
  validate?: (req: Req) => MaybeAsync<StageOutcome<Req>>;
  authorize?: (req: Req) => MaybeAsync<StageOutcome<void>>;
  /** Gates are resolved from here. Falls back to ungated when absent. */
  gates?: (req: Req) => readonly (CapabilityGate | null)[];
  gateFacts?: GateFacts;
  gateResolver?: GateResolver;
  /**
   * `static`/`dynamic` are optional so a host can preserve "the client sent no
   * context at all" distinctly from "the client sent an empty string" — the
   * distinction decides whether a provider falls back to the raw `context`
   * parameter or receives an authored empty block.
   */
  buildContext?: (req: Req) => MaybeAsync<StageOutcome<{ static?: string; dynamic?: string }>>;
  chooseProvider?: (req: Req) => MaybeAsync<StageOutcome<{ provider: string; model: string }>>;
  /**
   * May refuse to reserve — typically an over-quota meter that has its own
   * response shape (a 429 billing response, an email-verification gate). The
   * refusal MUST NOT settle usage: nothing was reserved.
   */
  reserve?: (req: Req, provider: { provider: string; model: string }) => Promise<StageOutcome<UsageReservation>>;
  generate?: (
    req: Req,
    ctx: { staticContext?: string; dynamicContext?: string; provider: string; model: string },
  ) => Promise<GeneratedOutput>;
  parse?: (out: GeneratedOutput, req: Req) => MaybeAsync<StageOutcome<GeneratedOutput>>;
  persist?: (out: GeneratedOutput, req: Req) => MaybeAsync<StageOutcome<void>>;
  proposeTransactions?: (out: GeneratedOutput, req: Req) => MaybeAsync<StageOutcome<void>>;
  finalizeUsage?: (
    reservation: UsageReservation | null,
    outcome: { ok: boolean; tokensUsed?: number },
  ) => Promise<void>;
}

const stopped = (stage: PipelineStage, reason: string, extra: Partial<GenerationOutcome> = {}): GenerationOutcome => ({
  ok: false,
  reason,
  stoppedAt: stage,
  ...extra,
});

const isStop = <T,>(v: StageOutcome<T>): v is { stop: GenerationOutcome } =>
  typeof v === "object" && v !== null && "stop" in v;

/**
 * Run one generation through the pipeline.
 *
 * `onStage` is called before each stage, which is what the streaming UI needs to
 * show real progress rather than a setTimeout theatre (see CLAUDE.md item 72,
 * where `generate-package`'s fake stage timeline was replaced for this reason).
 */
export async function runGenerationPipeline<Req extends GenerationRequest>(
  req: Req,
  ports: GenerationPorts<Req>,
  onStage?: (stage: PipelineStage) => void,
): Promise<GenerationOutcome> {
  let reservation: UsageReservation | null = null;
  let reserved = false;

  /** Settle exactly once, and never settle a reservation we never made. */
  const settle = async (ok: boolean, tokensUsed?: number) => {
    if (!ports.finalizeUsage || !reserved) return;
    reserved = false;
    try {
      await ports.finalizeUsage(reservation, { ok, tokensUsed });
    } catch {
      // A failure to settle must not mask the generation outcome. The caller
      // still gets the real result; the leak is logged by the host adapter.
    }
  };

  const stage = async <T>(name: PipelineStage, run: () => T | Promise<T>): Promise<T> => {
    onStage?.(name);
    return run();
  };

  /**
   * A pre-reserve stage failure is not a billing event — nothing has been
   * charged — but it must still surface as a structured outcome instead of an
   * exception on the caller's floor. Previously stages before `reserve` only
   * failed by returning `{stop}`; a throw fell through to the host unhandled.
   * A database outage inside `buildContext` would have bypassed every
   * error-shaping contract the host had.
   */
  const guarded = async <T>(name: PipelineStage, run: () => T | Promise<T>): Promise<T | { stop: GenerationOutcome }> => {
    try {
      return await stage(name, run);
    } catch (e) {
      return { stop: stopped(name, e instanceof Error ? e.message : String(e)) };
    }
  };

  // 1. validate
  let current = req;
  if (ports.validate) {
    const r = await guarded("validate", () => ports.validate!(current));
    if (isStop(r)) return r.stop;
    current = r;
  }

  // 2. authorize
  if (ports.authorize) {
    const r = await guarded("authorize", () => ports.authorize!(current));
    if (isStop(r)) return r.stop;
  }

  // 3. resolve capability/gate
  let gates: readonly CapabilityGate[] = [];
  if (ports.gates && ports.gateResolver) {
    onStage?.("resolveGate");
    let resolved: ReturnType<typeof resolveGates>;
    try {
      resolved = resolveGates(ports.gates(current), ports.gateFacts ?? {}, ports.gateResolver);
    } catch (e) {
      return stopped("resolveGate", e instanceof Error ? e.message : String(e), { gates });
    }
    gates = resolved.consulted;
    if (!resolved.decision.allowed) {
      const { reason, gate } = resolved.decision;
      return { ok: false, reason, stoppedAt: "resolveGate", gates, gateRef: gate };
    }
  }

  // 4. build context
  let ctx: { staticContext?: string; dynamicContext?: string } = {};
  if (ports.buildContext) {
    const r = await guarded("buildContext", () => ports.buildContext!(current));
    if (isStop(r)) return r.stop;
    ctx = { staticContext: r.static, dynamicContext: r.dynamic };
  }

  // 5. choose provider/model
  let chosen = { provider: "default", model: "default" };
  if (ports.chooseProvider) {
    const r = await guarded("chooseProvider", () => ports.chooseProvider!(current));
    if (isStop(r)) return r.stop;
    chosen = r;
  }

  // From here a failure costs money, so everything after is inside the settle path.
  try {
    // 6. reserve / estimate usage
    if (ports.reserve) {
      onStage?.("reserve");
      const r = await ports.reserve(current, chosen);
      // A reserve refusal (quota, email gate) ends the run: nothing was
      // reserved, so `reserved` must stay false and finalizeUsage must not run.
      if (isStop(r)) return { ...r.stop, stoppedAt: r.stop.stoppedAt ?? "reserve" };
      reservation = r;
      reserved = true;
    }

    // 7. generate / stream
    if (!ports.generate) throw new Error("GenerationService: no `generate` port supplied.");
    const raw = await stage("generate", () => ports.generate!(current, { ...ctx, ...chosen }));

    // 8. parse / structured validation
    let parsed = raw;
    if (ports.parse) {
      const r = await stage("parse", () => ports.parse!(raw, current));
      if (isStop(r)) return { ...await fail(r.stop.reason ?? "parse rejected the output"), ...pickOutput(r.stop) };
      parsed = r;
    }

    // 9. persist
    if (ports.persist) {
      const r = await stage("persist", () => ports.persist!(parsed, current));
      if (isStop(r)) return { ...await fail(r.stop.reason ?? "persist rejected the output"), ...pickOutput(r.stop) };
    }

    // 10. propose Story Transactions
    // A proposal is advisory: it must never fail an otherwise-successful
    // generation, or the user loses their credits over a suggestion that merely
    // failed to render.
    if (ports.proposeTransactions) {
      try {
        onStage?.("proposeTransactions");
        await ports.proposeTransactions(parsed, current);
      } catch {
        /* advisory only */
      }
    }

    // 11. finalize / refund usage
    await settle(true, parsed.tokensUsed);
    return {
      ok: true,
      text: parsed.text,
      model: parsed.model,
      tokensUsed: parsed.tokensUsed,
      gates,
    };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return { ...(await fail(reason)), gates };
  }

  /** Settle a failed generation as a refund and shape the outcome. */
  async function fail(reason: string) {
    await settle(false);
    return { ok: false as const, reason };
  }
}

const pickOutput = (o: GenerationOutcome) =>
  o.text === undefined ? {} : { text: o.text, model: o.model, tokensUsed: o.tokensUsed };