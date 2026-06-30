// Headroom — LLM-summarisation layer (the meaning-level compression above the
// deterministic v1/v2 whitespace+packing layers).
//
// This is intentionally NOT wired into buildStaticContext's sync, deterministic,
// prompt-cache-stable path. It's an OPT-IN async layer a caller uses where an
// LLM round-trip is acceptable (e.g. the dynamic/never-cached block, or
// pre-computing a compact entity description that's then stored). The summariser
// is dependency-injected so this orchestration is unit-testable with a mock — no
// real tokens spent in tests.
import { estimateTokens } from "@/lib/ai/headroom";

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
