// Per-tier ceilings on context sent to /api/ai/generate, enforced server-side.
// Caps are deterministic for identical (tier, input) so the prompt-cache
// block stays byte-identical across calls — a tier change is the only thing
// that can shift the cap, which is an expected one-time cache miss.

export const CONTEXT_CHAR_CAPS: Record<string, number> = {
  free:        2_000 * 4,
  story_pro:   8_000 * 4,
  creator_pro: 6_000 * 4,
  all_access: 10_000 * 4,
};

const DEFAULT_CONTEXT_CHAR_CAP = 6_000 * 4;
const PROMPT_CHAR_CAP = 20_000;
const TIER_TRUNCATION_MARKER = "\n[Context truncated for tier limit]";

// buildStaticContext already trims at section boundaries with its own
// marker, but its budget can exceed a tier's char cap (e.g. free/creator_pro).
// Re-slicing at an arbitrary character offset would otherwise cut mid-line,
// mid-field. Cut at the last newline within the cap instead, so a re-trim
// always drops whole lines and signals it happened.
function truncateAtLineBoundary(text: string, cap: number): string {
  if (text.length <= cap) return text;
  const sliced = text.slice(0, cap);
  const lastNewline = sliced.lastIndexOf("\n");
  const truncated = lastNewline > 0 ? sliced.slice(0, lastNewline) : sliced;
  return truncated + TIER_TRUNCATION_MARKER;
}

export function capContextForTier(tier: string, input: {
  staticContext?: string;
  dynamicContext?: string;
  prompt: string;
}): { cappedStatic?: string; cappedDynamic?: string; cappedPrompt: string } {
  const cap = CONTEXT_CHAR_CAPS[tier] ?? DEFAULT_CONTEXT_CHAR_CAP;
  return {
    cappedStatic: input.staticContext !== undefined ? truncateAtLineBoundary(input.staticContext, cap) : undefined,
    cappedDynamic: input.dynamicContext !== undefined ? truncateAtLineBoundary(input.dynamicContext, Math.floor(cap / 2)) : undefined,
    cappedPrompt: input.prompt.slice(0, PROMPT_CHAR_CAP),
  };
}
