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

export function unitCostFor(capabilityId: string): number {
  return CAPABILITY_UNIT_USD[capabilityId] ?? DEFAULT_UNIT_USD;
}
