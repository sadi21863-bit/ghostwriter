import { anthropic as client } from "@/lib/ai/client";
import { checkSemanticCache, writeSemanticCache } from "@/lib/semantic-cache";

const GROUNDABLE_MODES = new Set(["historical", "scitech"]);
const CACHE_TYPE = "web_research";

export function isGroundableMode(mode: string): boolean {
  return GROUNDABLE_MODES.has(mode);
}

/**
 * Opt-in, real web-search-grounded research for the two fiction modes where factual
 * accuracy genuinely matters (historical periods, real scientific/technical concepts) --
 * unlike Combat/Emotional/Tension/Atmosphere, which have deep synthetic craft libraries
 * (src/lib/combat, src/lib/emotional, etc.), historical/scitech had nothing beyond the
 * model's own training-data recall. Reuses the same web_search tool already used by
 * researchWorkPacket() (craft-library seeding) and the Director creator-tool routes
 * (research-scaffold/guest-intel/trend-angles), but scoped to grounding a SPECIFIC
 * story beat rather than building a reusable craft packet.
 *
 * Checked against the existing cacheType-agnostic semantic cache (src/lib/semantic-cache.ts,
 * 0.92 similarity -- "safe for research/analysis reuse") before spending a real web_search
 * call, since two beats set in the same historical period/scientific concept are common
 * within one project (and across a mode-sweep-style test) and would otherwise re-research
 * the identical topic every single call.
 *
 * Strictly opt-in (only fires when the caller explicitly asks) since a cache MISS still
 * adds real latency/cost on top of the base generation call -- never automatic. Fails open
 * (empty string) on any error; a research failure never blocks generation.
 */
export async function groundInWebResearch(mode: string, queryText: string): Promise<string> {
  if (!isGroundableMode(mode) || !queryText?.trim()) return "";

  const cacheKey = `${mode}:${queryText.slice(0, 500)}`;
  const cached = await checkSemanticCache(CACHE_TYPE, cacheKey);
  if (cached && typeof cached.text === "string") return cached.text;

  try {
    const { MODELS } = await import("@/lib/ai/engine");
    const res = await client.messages.create({
      model: MODELS.default,
      max_tokens: 700,
      tools: [{ type: "web_search_20250305" as any, name: "web_search" }],
      messages: [{
        role: "user",
        content: `Search for real, verifiable facts relevant to this scene, then return ONLY a compact bullet list (max 5 bullets, one line each) of concrete, checkable details a fiction writer could use to ground this scene in reality. No commentary, no preamble.\n\nSCENE: ${queryText.slice(0, 500)}`,
      }],
    });
    const text = res.content.filter((b) => b.type === "text").map((b: any) => b.text).join("").trim();
    if (!text) return "";
    const result = `REAL-WORLD GROUNDING (verify against these facts, do not contradict them):\n${text}`;
    await writeSemanticCache(CACHE_TYPE, cacheKey, { text: result });
    return result;
  } catch {
    return "";
  }
}
