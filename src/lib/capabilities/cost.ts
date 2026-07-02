// Shared per-capability unit-cost constants (USD) for spend preflight. One place
// so the production pipeline cost estimate and the Story-Graph dataflow runner
// agree. Rough, documented-approximate — used only to warn before paid runs.
//
// comic_generate is 0.29, NOT the ~0.04 originally guessed: real-money validation
// (outputtestresults/comic-validation/FINDINGS.md, 2026-06-30) measured ≈$0.29 per
// Segmind Soul/photoreal image — 7× the old estimate. A 6-panel page ≈ $1.74.
export const CAPABILITY_UNIT_USD: Record<string, number> = {
  production_video: 0.10, // per shot, Seedance 2.0 ballpark
  comic_generate:   0.29, // per panel — measured, not estimated
  audio_generate:   0.02, // per chapter, TTS ballpark
};

// Fallback for an unlisted paid capability — conservative non-zero so a paid run
// is never shown as free.
export const DEFAULT_UNIT_USD = 0.05;

// Hard ceiling (USD) for a single unattended multi-item batch spend — e.g.
// preview-all's per-click shot-preview batch, which loops through paid
// generations with no per-item confirmation. This is the one place today
// where the server decides how much to spend on its own; enforceBudgetCap
// must gate it. Any future auto-retry/self-eval loop (see
// src/lib/production/self-eval.ts) must reuse this same server-side gate
// before it is wired into a paid route — a UI-side cap alone is not enough.
export const MAX_BATCH_SPEND_USD = 5;

export function unitCostFor(capabilityId: string): number {
  return CAPABILITY_UNIT_USD[capabilityId] ?? DEFAULT_UNIT_USD;
}

// ─── Budget caps ────────────────────────────────────────────────────────────
// A spend ceiling for a paid run (Production #5). Pure decision so the gate is
// testable; the caller blocks the run and shows the reason when not allowed.
export interface BudgetDecision {
  allowed: boolean;
  reason?: string;
  estimateUsd: number;
  capUsd?: number;
}

/**
 * Decide whether a paid run is within budget. An undefined/non-positive cap means
 * "no cap" → always allowed. Otherwise block when the estimate exceeds the cap.
 */
export function enforceBudgetCap(estimateUsd: number, capUsd?: number): BudgetDecision {
  if (capUsd === undefined || capUsd <= 0) return { allowed: true, estimateUsd, capUsd };
  if (estimateUsd > capUsd) {
    return {
      allowed: false,
      estimateUsd,
      capUsd,
      reason: `Estimated $${estimateUsd.toFixed(2)} exceeds your $${capUsd.toFixed(2)} run cap.`,
    };
  }
  return { allowed: true, estimateUsd, capUsd };
}
