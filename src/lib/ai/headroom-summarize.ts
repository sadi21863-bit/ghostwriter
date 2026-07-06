// Headroom — LLM-summarisation layer (the meaning-level compression above the
// deterministic v1/v2 whitespace+packing layers).
//
// This is intentionally NOT wired into buildStaticContext's sync, deterministic,
// prompt-cache-stable path. It's an OPT-IN async layer a caller uses where an
// LLM round-trip is acceptable (e.g. the dynamic/never-cached block, or
// pre-computing a compact entity description that's then stored). The summariser
// is dependency-injected so this orchestration is unit-testable with a mock — no
// real tokens spent in tests.
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { estimateTokens } from "@/lib/ai/headroom";
import { db } from "@/db";
import { semanticCache } from "@/db/schema";
import { anthropic } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/engine";

/** Compress `text` to roughly `targetTokens`. Injected: Claude in prod, a mock in tests. */
export type Summarizer = (text: string, targetTokens: number) => Promise<string>;

/**
 * Return `text` untouched if it already fits the token target; otherwise summarise
 * it down. Defensive: if the summariser returns something still over target, the
 * caller's downstream cap still applies, but we never expand (return the shorter
 * of summary vs original).
 */
export async function summarizeToFit(text: string, targetTokens: number, summarize: Summarizer): Promise<string> {
  if (!text.trim()) return text;
  if (estimateTokens(text) <= targetTokens) return text;
  const summary = await summarize(text, targetTokens);
  // Never make it worse than the original.
  return estimateTokens(summary) < estimateTokens(text) ? summary : text;
}

export interface SummarizableSection {
  /** Stable id (e.g. entity id) — lets callers cache the summary per content. */
  id: string;
  text: string;
  /** Lower = compressed first when over budget (least important sections shrink first). */
  priority: number;
}

/**
 * Bring a set of prioritised sections under a total token budget by summarising
 * the lowest-priority sections first, only as far as needed. Sections already
 * within their share are left verbatim. Returns sections in their original order.
 */
export async function summarizeOverflow(
  sections: SummarizableSection[],
  budgetTokens: number,
  summarize: Summarizer,
): Promise<SummarizableSection[]> {
  const total = sections.reduce((s, sec) => s + estimateTokens(sec.text), 0);
  if (total <= budgetTokens) return sections;

  // Work on a copy; compress lowest-priority sections first until we fit (or run out).
  const out = sections.map(s => ({ ...s }));
  const order = [...out].sort((a, b) => a.priority - b.priority);
  let running = total;
  for (const sec of order) {
    if (running <= budgetTokens) break;
    const before = estimateTokens(sec.text);
    // Target this section's share of the remaining overage, floored so we don't ask for 0.
    const overage = running - budgetTokens;
    const target = Math.max(40, before - overage);
    const compressed = await summarizeToFit(sec.text, target, summarize);
    const after = estimateTokens(compressed);
    sec.text = compressed;
    running -= before - after;
  }
  return out;
}

/**
 * Production summariser backed by Claude. `call` is the model invocation
 * (`(prompt) => Promise<string>`), kept injectable so this file has no hard SDK
 * dependency and stays test-friendly.
 */
export function makeClaudeSummarizer(call: (prompt: string) => Promise<string>): Summarizer {
  return async (text, targetTokens) => {
    const words = Math.max(20, Math.round(targetTokens * 0.7)); // ~0.7 words/token
    const prompt = `Compress the following story context to at most ~${words} words. Preserve every concrete fact, name, number, and relationship; drop only filler and repetition. Return only the compressed text.\n\n---\n${text}`;
    try {
      const out = await call(prompt);
      return out?.trim() || text;
    } catch {
      return text; // fail-open: never break the caller on a summariser error
    }
  };
}

// ---------------------------------------------------------------------------
// Production wiring: a real, cached Claude call plugged into the pure
// orchestration above. Exact-content-hash cached — NOT embedding-similarity
// like semantic-cache.ts, because this needs byte-identical reuse for the
// same (prompt) input rather than "similar enough" reuse. That matters for two
// reasons: it keeps a project's assembled context stable call-to-call (the
// same over-budget project shouldn't get a differently-worded compression
// every single generation), and it means a large project only pays the real
// model-call cost once per distinct section content, not on every draft click.
// Reuses the existing `semantic_cache` table with a dedicated cacheType and a
// null embedding column rather than adding a new table for this.
const CACHE_TYPE = "headroom_summary";

function hashPrompt(prompt: string): string {
  return crypto.createHash("sha256").update(prompt).digest("hex");
}

async function readCachedCall(hash: string): Promise<string | null> {
  try {
    const row = await db.query.semanticCache.findFirst({
      where: and(eq(semanticCache.cacheType, CACHE_TYPE), eq(semanticCache.inputKey, hash)),
    });
    if (!row) return null;
    await db.update(semanticCache)
      .set({ hitCount: (row.hitCount ?? 0) + 1, lastHitAt: new Date() })
      .where(eq(semanticCache.id, row.id));
    return (row.cachedOutput as { text?: string }).text ?? null;
  } catch {
    return null; // cache-read failure just means a fresh (uncached) call below
  }
}

async function writeCachedCall(hash: string, text: string): Promise<void> {
  try {
    await db.insert(semanticCache)
      .values({ cacheType: CACHE_TYPE, inputKey: hash, cachedOutput: { text } })
      .onConflictDoNothing();
  } catch {
    // Cache write failure must never break the calling generation.
  }
}

/**
 * The real `call` function for makeClaudeSummarizer in production: Haiku (fast,
 * cheap — this is compression, not creative generation), cached by exact prompt
 * hash. Not separately metered/credited — same convention as the other
 * generate()-augmenting helpers (promise ledger, voice exemplars, scene
 * blueprint): this rides along under the credit already charged for the
 * generation it's supporting, rather than being its own billed operation.
 */
async function cachedClaudeCall(prompt: string): Promise<string> {
  const hash = hashPrompt(prompt);
  const cached = await readCachedCall(hash);
  if (cached) return cached;

  const msg = await anthropic.messages.create({
    model: MODELS.fast,
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("").trim();
  if (text) await writeCachedCall(hash, text);
  return text;
}

/** The production Summarizer — pass this to summarizeToFit/summarizeOverflow
 *  wherever a real, cached Claude compression is wanted. */
export const claudeSummarizer: Summarizer = makeClaudeSummarizer(cachedClaudeCall);

// Fixed importance ranking for buildStaticContextDetailed's section labels —
// matches the same descending-priority order the sections are already built in
// (characters > locations > plots > world-elements). Lower rank = compressed
// first / more aggressively by summarizeOverflow when rescuing skipped sections.
const SECTION_RESCUE_PRIORITY: Record<string, number> = {
  "world-elements": 0,
  plots: 1,
  locations: 2,
  characters: 3,
  "voice-fingerprint": 4,
};

/**
 * Try to recover buildStaticContextDetailed()'s dropped sections into whatever
 * budget headroom remains, by compressing them (least important first) via
 * summarizeOverflow + the cached production summarizer. Returns "" if there's
 * nothing to rescue or no headroom to rescue into — callers append the result
 * after the packed static context (and its TRIM_MARKER) when non-empty.
 */
export async function rescueSkippedSections(
  skipped: { label: string; content: string }[],
  remainingBudgetTokens: number,
): Promise<string> {
  if (skipped.length === 0 || remainingBudgetTokens <= 0) return "";

  const sections: SummarizableSection[] = skipped.map((s) => ({
    id: s.label,
    text: s.content,
    priority: SECTION_RESCUE_PRIORITY[s.label] ?? 0,
  }));

  const compressed = await summarizeOverflow(sections, remainingBudgetTokens, claudeSummarizer);
  return compressed
    .map((s) => `[${s.id.toUpperCase()} — auto-compressed]\n${s.text}`)
    .join("\n\n");
}
