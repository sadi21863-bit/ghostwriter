/**
 * Versioned story-loop guards — pure, deterministic, no I/O.
 *
 * Extracted from the temp harness that generated the 13-story library
 * (`%TEMP%\opencode\chapter-loop-format.mts`) so the truncation and repetition
 * protections are tested, reviewable code instead of an untracked script.
 *
 * Two behaviours here are load-bearing:
 *
 *  - `looksTruncated` — a revise/repair pass can return a completion cut off
 *    mid-sentence; accepting it would silently replace a complete draft with a
 *    truncated one (seen on The Ward).
 *  - `worstRepeat` — the model drifts into re-running a unit almost verbatim
 *    (Low Tide Message's finale shared 54 consecutive words with the episode
 *    before it). It compares against EVERY non-empty row except the unit
 *    itself, not just the rows before it, so a resumed run cannot echo a unit
 *    written later in a previous pass. Deliberate refrains are exempted with
 *    `allow`.
 *
 * Allocation is bounded: the longest-common-run tokenizer caps each side at
 * 6000 words, and the DP keeps two Int32Array rows regardless of input size.
 */

/** One unit of the story; only `content` matters to the repetition guard. */
export interface RepeatRow {
  readonly content?: string | null;
}

/** The worst shared word run found, and which row it came from (-1 = none). */
export interface RepeatHit {
  readonly run: number;
  readonly index: number;
}

/** Whitespace-separated word count; empty/blank text is 0. */
export function words(text: string): number {
  return String(text ?? "")
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * Deterministic artifact scrub: the model cannot be trusted with a format ban.
 * Drops CHAPTER/SCENE/EPISODE label lines, `BEAT:` prefixes, `---` separators
 * and `**CHAPTER n**` markers, then collapses 3+ newlines and trims.
 */
export function scrubArtifacts(text: string): string {
  return String(text ?? "")
    .split(/\r?\n/)
    .filter(
      (line) =>
        !/^\s*(\*\*|---)?\s*(CHAPTER|Chapter)\s+\d+/.test(line) &&
        !/^\s*\**\s*(SCENE|Scene|EPISODE|Episode)\s+\d+\s*\**\s*[:.-]?\s*$/.test(line) &&
        !/^\s*---+=?\s*$/.test(line) &&
        !/^\s*BEAT:\s*$/i.test(line),
    )
    .join("\n")
    .replace(/\*\*CHAPTER\s+\d+\*\*/gi, "")
    .replace(/\bBEAT:\s*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * A finished unit ends on terminal punctuation. Empty text counts as
 * truncated so a blank completion can never be mistaken for a draft.
 */
export function looksTruncated(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return true;
  return !/[.!?"'\u201d\u2019)\]]$/.test(t);
}

/** Lowercase word tokens (letters/apostrophes) capped at 6000 per side. */
function tokenize(text: string): string[] {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .split(/[^a-z']+/)
    .filter((w) => w.length > 0 && /[a-z]/.test(w))
    .slice(0, 6000);
}

/**
 * Longest run of consecutive words shared by two texts. Case, punctuation and
 * curly apostrophes are ignored; O(n*m) DP with rolling rows (6000 words a
 * side caps it).
 */
export function longestCommonWordRun(aText: string, bText: string): number {
  const a = tokenize(aText);
  const b = tokenize(bText);
  if (a.length === 0 || b.length === 0) return 0;
  let prev = new Int32Array(b.length + 1);
  let cur = new Int32Array(b.length + 1);
  let best = 0;
  for (let i = 1; i <= a.length; i++) {
    const w = a[i - 1];
    for (let j = 1; j <= b.length; j++) {
      if (w !== b[j - 1]) {
        cur[j] = 0;
        continue;
      }
      const run = prev[j - 1] + 1;
      cur[j] = run;
      if (run > best) best = run;
    }
    const swap = prev;
    prev = cur;
    cur = swap;
  }
  return best;
}

/** Placeholder that survives tokenization (letters only, unlikely to occur). */
const REFRAIN_TOKEN = "zzrefrainzz";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace each deliberate refrain phrase with one placeholder word, in BOTH
 * texts, before measuring. Matching is case-insensitive and a phrase's
 * whitespace runs match any whitespace run in the text.
 */
function maskRefrains(text: string, allow: readonly string[]): string {
  if (allow.length === 0) return String(text ?? "");
  let out = String(text ?? "").replace(/[\u2018\u2019]/g, "'");
  for (const phrase of allow) {
    const normalized = String(phrase ?? "")
      .replace(/[\u2018\u2019]/g, "'")
      .trim();
    if (!normalized) continue;
    const pattern = normalized.split(/\s+/).map(escapeRegExp).join("\\s+");
    out = out.replace(new RegExp(pattern, "gi"), ` ${REFRAIN_TOKEN} `);
  }
  return out;
}

/**
 * The longest shared word run between `content` and ANY non-empty row except
 * `selfIndex` — earlier AND later rows, so a resumed run catches an echo of a
 * unit written after it. `allow` lists deliberate refrain phrases; each is
 * masked in both texts before measuring so an intentional recurring line
 * cannot trigger the guard. Returns `{ run: 0, index: -1 }` when clean.
 */
export function worstRepeat(
  content: string,
  rows: readonly RepeatRow[],
  selfIndex: number,
  opts: { readonly allow?: readonly string[] } = {},
): RepeatHit {
  const allow = opts.allow ?? [];
  const probe = maskRefrains(content, allow);
  let run = 0;
  let index = -1;
  for (let j = 0; j < rows.length; j++) {
    if (j === selfIndex) continue;
    const prior = String(rows[j]?.content ?? "").trim();
    if (!prior) continue;
    const shared = longestCommonWordRun(probe, maskRefrains(prior, allow));
    if (shared > run) {
      run = shared;
      index = j;
    }
  }
  return { run, index };
}

/** Plan lines arrive as "1. BEAT: 1. Title — beat"; keep only the human text. */
export function cleanBeat(line: string): string {
  return String(line ?? "")
    .replace(/^\s*\d+[.)]\s*/, "")
    .replace(/^BEAT:\s*/i, "")
    .replace(/^\s*\d+[.)]\s*/, "")
    .replace(/^CHAPTER\s+\d+\s*[:\u2014-]\s*/i, "")
    .replace(/^(SCENE|EPISODE)\s+\d+\s*[:\u2014-]\s*/i, "")
    .trim();
}

/**
 * The unit title is the first segment before an em/en/hyphen separator,
 * trimmed; `fallback` when the beat has no usable prefix.
 */
export function splitUnitTitle(beat: string, fallback: string): string {
  const first = String(beat ?? "")
    .split(/\u2014|\u2013|-/)[0]
    ?.trim();
  return first || fallback;
}
