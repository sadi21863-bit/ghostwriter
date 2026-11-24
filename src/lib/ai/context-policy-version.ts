/**
 * ContextPolicy rollout control (Phase 0 / v4 §5).
 *
 * The mode-aware ContextPolicy already exists and is unit-tested, but the
 * primary production generation path never passed `mode`, so every request
 * silently received the FULL policy. Turning it on is therefore a BEHAVIOURAL
 * change, not a pure bug fix: some modes would start receiving sections they
 * never received before (combat/horror/action gain WORLD ELEMENTS), and others
 * would stop receiving sections they always received (dialogue drops LOCATIONS,
 * atmosphere/setting drop to brief character cards). For a project with existing
 * chapters, prose generated after the switch would diverge from prose generated
 * before it.
 *
 * v4 §5 therefore mandates a three-stage rollout:
 *
 *   "legacy"     only the old full-policy context is produced. Pre-switch behaviour.
 *   "shadow"     DEFAULT. The legacy context is what generation actually uses; the
 *                mode-aware candidate is built alongside and the difference is
 *                recorded. Zero behaviour change, full visibility.
 *   "mode-aware" the mode-aware context is used. Only after fixture evaluation
 *                approves, per v4 §5.3.
 *
 * This is deliberately NOT a GrowthBook flag (v4 §5.1): it must be a code/config
 * value that ships with the build, because a remote flag could flip the context
 * policy in production without a deploy or a rollback path.
 */

/**
 * Typed as the union rather than `as const` on purpose: a literal type would
 * make the "legacy" and "mode-aware" branches unreachable to the compiler, which
 * is false — they become reachable the moment this line is edited. All three
 * stages therefore stay type-checked, which is the point.
 */
export const CONTEXT_POLICY_VERSION: ContextPolicyVersion = "shadow";

export type ContextPolicyVersion = "legacy" | "shadow" | "mode-aware";

/** Every value the switch is allowed to take, for tests and validation. */
export const CONTEXT_POLICY_VERSIONS: readonly ContextPolicyVersion[] = [
  "legacy",
  "shadow",
  "mode-aware",
] as const;

export function isContextPolicyVersion(v: unknown): v is ContextPolicyVersion {
  return typeof v === "string" && (CONTEXT_POLICY_VERSIONS as readonly string[]).includes(v);
}

/**
 * A single observed difference between the legacy and mode-aware context.
 * Emitted only in "shadow" mode.
 */
export interface ContextShadowDiff {
  /** The mode the request asked for. */
  mode: string;
  /** Whether a registered mode was actually found in MODE_REGISTRY. A false here
   *  means the mode-aware build is identical to legacy by definition, so the diff
   *  is uninformative rather than empty-by-design. */
  modeIsRegistered: boolean;
  /** Static sections admitted under legacy but not under mode-aware. */
  droppedByPolicy: string[];
  /** Sections admitted under mode-aware but not legacy (e.g. world elements for
   *  combat). The policy can only add these via charDepth/flag differences, but
   *  proving it is cheaper than assuming it. */
  addedByPolicy: string[];
  charDepth: { legacy: string; modeAware: string };
  chars: { legacy: number; modeAware: number; saved: number };
  estimatedTokens: { legacy: number; modeAware: number; saved: number };
  /** Cheap content-presence markers, so a reviewer can see what actually moved
   *  rather than diffing two multi-thousand-character strings by eye. */
  presence: {
    legacy: Record<string, boolean>;
    modeAware: Record<string, boolean>;
  };
}

/**
 * Receives each shadow diff. Deliberately a settable hook rather than a direct
 * call to any telemetry/analytics module: this file runs on the CLIENT during
 * context assembly, and Core must not acquire an analytics dependency. Tests and
 * the evaluation harness replace it; production leaves it unset.
 */
let shadowSink: ((d: ContextShadowDiff) => void) | null = null;

export function setContextShadowSink(fn: ((d: ContextShadowDiff) => void) | null): void {
  shadowSink = fn;
}

export function emitContextShadowDiff(diff: ContextShadowDiff): void {
  try {
    shadowSink?.(diff);
  } catch {
    // Shadow reporting must never break a generation. Same fail-open convention
    // as buildPromiseLedger / buildAuthorVoiceExemplars / soul-id bootstrap.
  }
}