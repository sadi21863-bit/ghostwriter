/**
 * The blended per-model cost model shared by BOTH admin surfaces — the cloud
 * route (`api/admin/cost-report`) and the loopback side-registry's twin
 * (`lib/core/local-admin-registry.ts`). Single source so the two deployment
 * surfaces can never drift apart in their estimates.
 *
 * Blended USD per million tokens (tokensUsed = input + output combined, so a
 * single blended rate is used rather than separate input/output pricing), using
 * an 80/20 input/output split throughout. Sonnet 5 (claude-sonnet-5, released
 * 2026-06-30) is priced at an introductory $2/$10 per MTok (in/out) through
 * 2026-08-31, then reverts to standard $3/$15 (same as the prior Sonnet 4.6
 * rate) — bump 3.6 -> 5.4 for sonnet-5 after that date.
 *
 * opus-4-6/opus-4-8 corrected 2026-07-05: the prior 27.0 figure back-solves to
 * Opus 4.1's old $15/$75 pricing, not current Opus 4.6/4.8 pricing (confirmed
 * live against Anthropic's docs: $5/$25 per MTok) — was overstating Opus cost
 * by ~3x. haiku-4-5 nudged to the exact $1/$5 blend (was implicitly ~$1/$4).
 */
export const BLENDED_COST_PER_MTOK: Record<string, number> = {
  'claude-haiku-4-5-20251001': 1.8,
  'claude-sonnet-4-6':         5.4, // historical rows predating the Sonnet 5 switch
  'claude-sonnet-5':           3.6, // introductory rate through 2026-08-31
  'claude-opus-4-6':           9.0,
  'claude-opus-4-8':           9.0,
};
// An unknown model (or null, for rows predating model recording) prices at the
// default-rate blend rather than crashing the report.
export const DEFAULT_COST_PER_MTOK = 5.4;

export function costForTokens(model: string | null, tokens: number): number {
  const rate = BLENDED_COST_PER_MTOK[model ?? ''] ?? DEFAULT_COST_PER_MTOK;
  return (tokens / 1_000_000) * rate;
}
