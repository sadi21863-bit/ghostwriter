// Production #5 — self-eval scoring + render→evaluate→auto-fix loop.
//
// Inspired by browser-use/video-use (render → self-eval → auto-fix) and
// OpenMontage's multi-dimension tool scoring. This module is the PURE decision
// layer: an evaluator (LLM or heuristic) supplies per-dimension scores; we
// aggregate them (7 weighted dims), decide accept/retry/stop within an attempt
// budget, and hand back a targeted fix hint for the weakest dimension. The actual
// render is the (real-money) caller; this never spends.

export interface EvalDimensions {
  promptAdherence: number;       // matches the requested shot/prompt
  characterConsistency: number;  // characters match their references
  continuity: number;            // flows from the previous shot
  technicalQuality: number;      // no artifacts / anatomy errors
  pacing: number;                // appropriate duration / rhythm
  coverage: number;              // covers the intended beat
  aesthetics: number;            // overall visual/style quality
}

export const EVAL_WEIGHTS: EvalDimensions = {
  promptAdherence: 0.2, characterConsistency: 0.2, continuity: 0.15,
  technicalQuality: 0.15, pacing: 0.1, coverage: 0.1, aesthetics: 0.1,
};

export const EVAL_DIMENSIONS = Object.keys(EVAL_WEIGHTS) as (keyof EvalDimensions)[];

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export interface ShotScore {
  overall: number;                 // 0..1 weighted aggregate
  weakest: keyof EvalDimensions;   // lowest-scoring dimension (drives the retry hint)
  dims: EvalDimensions;
}

/** Aggregate per-dimension scores into a weighted overall + the weakest dimension. */
export function scoreShot(raw: Partial<EvalDimensions>): ShotScore {
  const dims = {} as EvalDimensions;
  for (const k of EVAL_DIMENSIONS) dims[k] = clamp01(raw[k] ?? 0);
  let overall = 0;
  for (const k of EVAL_DIMENSIONS) overall += dims[k] * EVAL_WEIGHTS[k];
  // Weakest = lowest raw dimension score (ties → declaration order).
  let weakest = EVAL_DIMENSIONS[0];
  for (const k of EVAL_DIMENSIONS) if (dims[k] < dims[weakest]) weakest = k;
  return { overall: clamp01(overall), weakest, dims };
}

export type LoopAction = "accept" | "retry" | "stop";

export interface LoopOptions {
  threshold?: number;   // accept when overall >= threshold (default 0.7)
  maxAttempts?: number; // give up after this many renders (default 2)
}

/**
 * Decide what to do after a render: accept if good enough, retry if there's
 * attempt budget left, else stop. `attempt` is 1-based (the attempt just scored).
 */
export function nextLoopAction(score: ShotScore, attempt: number, opts: LoopOptions = {}): LoopAction {
  const threshold = opts.threshold ?? 0.7;
  const maxAttempts = opts.maxAttempts ?? 2;
  if (score.overall >= threshold) return "accept";
  if (attempt < maxAttempts) return "retry";
  return "stop";
}

const FIX_HINTS: Record<keyof EvalDimensions, string> = {
  promptAdherence: "Hew closer to the shot description; include every named subject and action.",
  characterConsistency: "Reinforce the character reference; keep face, hair, build and clothing consistent.",
  continuity: "Match lighting, location and time-of-day to the previous shot for a clean cut.",
  technicalQuality: "Emphasise anatomically-correct, artifact-free rendering with natural proportions.",
  pacing: "Adjust the duration/rhythm so the beat lands without feeling rushed or padded.",
  coverage: "Make sure the shot actually depicts the intended story beat.",
  aesthetics: "Strengthen composition, colour and overall visual polish.",
};

/** A targeted instruction to append to the next render's prompt, fixing the weakest dim. */
export function retryHint(score: ShotScore): string {
  return FIX_HINTS[score.weakest];
}
