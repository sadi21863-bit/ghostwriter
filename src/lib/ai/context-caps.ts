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

export function capContextForTier(tier: string, input: {
  staticContext?: string;
  dynamicContext?: string;
  prompt: string;
}): { cappedStatic?: string; cappedDynamic?: string; cappedPrompt: string } {
  const cap = CONTEXT_CHAR_CAPS[tier] ?? DEFAULT_CONTEXT_CHAR_CAP;
  return {
    cappedStatic: input.staticContext !== undefined ? input.staticContext.slice(0, cap) : undefined,
    cappedDynamic: input.dynamicContext !== undefined ? input.dynamicContext.slice(0, Math.floor(cap / 2)) : undefined,
    cappedPrompt: input.prompt.slice(0, PROMPT_CHAR_CAP),
  };
}
