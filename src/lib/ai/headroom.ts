// Headroom — deterministic, zero-spend context compaction.
//
// "Compression under all AI calls" (MASTER-PLAN). This is the cheap, lossless-ish
// first layer: it squeezes whitespace and exact-duplicate facts out of an
// assembled context block so more real story content fits under the same token
// budget — no LLM call, no cost. Because it's deterministic (same input → same
// output) it keeps the prompt-cache static block stable.
//
// Conservative on purpose: it only removes pure whitespace noise (trailing
// spaces, blank-line runs, repeated double-spaces). It is strictly LOSSLESS — it
// never drops a line, paraphrases, or dedupes content, because two entities can
// legitimately share identical text and collapsing them would lose information.
// Meaning-level reduction (summarisation) belongs to a later, opt-in LLM layer.

/**
 * Compact a context block losslessly:
 *  - normalise CRLF→LF, strip trailing whitespace per line
 *  - collapse runs of 2+ spaces inside a line to one
 *  - collapse 3+ blank lines to a single blank line
 *  - trim leading/trailing blank lines
 * Idempotent: compactContext(compactContext(x)) === compactContext(x).
 */
export function compactContext(text: string): string {
  if (!text) return "";
  const rawLines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let blankRun = 0;

  for (const raw of rawLines) {
    const line = raw.replace(/[ \t]+$/g, "").replace(/  +/g, " ");
    if (line.trim() === "") {
      blankRun++;
      if (blankRun <= 1) out.push("");
      continue;
    }
    blankRun = 0;
    out.push(line);
  }

  // Trim leading/trailing blank lines.
  while (out.length && out[0] === "") out.shift();
  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

/** Rough token estimate (chars/4), matching the context-builder's heuristic. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** How many tokens compaction saved, for telemetry/headroom reporting. */
export function headroomSaved(text: string): { before: number; after: number; saved: number } {
  const before = estimateTokens(text);
  const after = estimateTokens(compactContext(text));
  return { before, after, saved: before - after };
}
