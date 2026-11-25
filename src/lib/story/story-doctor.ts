/**
 * PLAN-v5 step 5 — Story Doctor v1. EXACTLY TWO checks, deterministic, no LLM:
 *
 *  1. KNOWLEDGE CONFLICT — a character acts on information they have not
 *     learned yet in the timeline. The memory layer records what a character
 *     learned (`structuredData.knowledgeShifts` = { character, learned, from,
 *     to }) and in which chapter (the memory's `chapterIndex`, 0-based into the
 *     ordered chapter list). If an EARLIER chapter's prose mentions both the
 *     character and the learned fact's distinctive terms, the Doctor flags it.
 *
 *  2. UNRESOLVED PROMISE — a setup opened in some chapter is never paid off by
 *     the final chapter. This is the same pure math the promise ledger uses
 *     (fuzzy `includes` matching in either direction), applied across ALL
 *     memories in chapter order.
 *
 * Deliberately heuristic, deliberately deterministic: the plan asks for two
 * checks and a fixture story per check with a planted defect it must find. The
 * knowledge check is a term-presence probe (documented below), NOT semantic
 * understanding; a match is reported as a CANDIDATE with its evidence so the
 * writer judges it. No provider call, no cost, no network.
 */

export interface DoctorChapter {
  readonly title: string;
  readonly content: string;
  readonly sortOrder?: number;
}

export interface DoctorKnowledgeShift {
  readonly character: string;
  readonly learned: string;
  readonly from?: string;
  readonly to?: string;
}

export interface DoctorStructuredData {
  readonly knowledgeShifts?: readonly DoctorKnowledgeShift[];
  readonly openPromisesCreated?: readonly string[];
  readonly openPromisesResolved?: readonly string[];
}

export interface DoctorMemory {
  /** 0-based chapter position this memory was extracted from. */
  readonly chapterIndex: number;
  readonly structuredData?: DoctorStructuredData | null;
}

export interface KnowledgeConflictIssue {
  readonly kind: "knowledge-conflict";
  readonly character: string;
  readonly learned: string;
  /** The chapter that records the learning (0-based). */
  readonly learnedAtChapter: number;
  /** The earlier chapter whose prose already acts on it (0-based). */
  readonly chapterIndex: number;
  readonly chapterTitle: string;
  readonly excerpt: string;
  readonly message: string;
}

export interface UnresolvedPromiseIssue {
  readonly kind: "unresolved-promise";
  readonly promise: string;
  /** The first chapter that opened it (0-based), when known. */
  readonly openedInChapter: number | null;
  readonly message: string;
}

export type StoryDoctorIssue = KnowledgeConflictIssue | UnresolvedPromiseIssue;

export interface StoryDoctorReport {
  readonly issues: readonly StoryDoctorIssue[];
  readonly checked: {
    readonly chapters: number;
    readonly knowledgeShifts: number;
    readonly promisesCreated: number;
    readonly promisesResolved: number;
  };
}

/** Words too common to identify a fact; never counted as evidence terms. */
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "that", "this", "these",
  "those", "is", "are", "was", "were", "be", "been", "being", "has", "have",
  "had", "do", "does", "did", "will", "would", "can", "could", "should",
  "shall", "may", "might", "must", "with", "without", "from", "into", "onto",
  "over", "under", "about", "after", "before", "between", "through", "during",
  "his", "her", "their", "its", "our", "your", "my", "he", "she", "they",
  "it", "we", "you", "i", "him", "them", "us", "who", "whom", "whose", "which",
  "what", "when", "where", "why", "how", "not", "no", "yes", "all", "any",
  "each", "every", "some", "such", "than", "too", "very", "just", "also",
  "one", "two", "three", "first", "last", "later", "now", "then", "there",
]);

/** Lowercase word tokens (letters/digits/apostrophes) of length >= 4. */
export function doctorTokens(text: string): string[] {
  return String(text ?? "")
    .toLowerCase()
    .split(/[^a-z0-9']+/i)
    .map((t) => t.replace(/^'+|'+$/g, ""))
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

/**
 * The distinctive terms of a learned fact: up to six tokens, longest first
 * (longer tokens are less ambiguous), de-duplicated, lowercase.
 */
export function factTerms(learned: string): string[] {
  const uniq = [...new Set(doctorTokens(learned))];
  return uniq.sort((a, b) => b.length - a.length).slice(0, 6);
}

function lower(text: string): string {
  return String(text ?? "").toLowerCase();
}

function containsName(haystack: string, name: string): boolean {
  const n = lower(name).trim();
  if (n.length < 3) return false;
  // Whole-word-ish containment: bounded by non-letter chars or string ends.
  const re = new RegExp(`(^|[^a-z0-9])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i");
  return re.test(haystack);
}

/** A prose excerpt around the first matching term, for the issue evidence. */
function excerptAround(content: string, terms: readonly string[]): string {
  const text = String(content ?? "");
  const lowerText = text.toLowerCase();
  let at = -1;
  for (const t of terms) {
    const i = lowerText.indexOf(t);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return text.slice(0, 160).trim();
  const start = Math.max(0, at - 70);
  const end = Math.min(text.length, at + 110);
  return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
}

export function findKnowledgeConflicts(
  chapters: readonly DoctorChapter[],
  memories: readonly DoctorMemory[],
): KnowledgeConflictIssue[] {
  const ordered = chapters.map((c, i) => ({ chapter: c, index: i }));
  const issues: KnowledgeConflictIssue[] = [];
  const seen = new Set<string>();

  for (const memory of memories) {
    const shifts = memory.structuredData?.knowledgeShifts ?? [];
    for (const shift of shifts) {
      if (!shift?.character || !shift?.learned) continue;
      const terms = factTerms(shift.learned);
      if (terms.length === 0) continue;
      const learnedAt = memory.chapterIndex;

      for (const { chapter, index } of ordered) {
        if (index >= learnedAt) break; // only chapters BEFORE the learning
        const nameOk = containsName(lower(chapter.content), shift.character);
        if (!nameOk) continue;
        const hits = terms.filter((t) => lower(chapter.content).includes(t));
        // Require real evidence: at least two distinct fact terms, or the one
        // available term when the fact is a single distinctive word.
        const enough = terms.length >= 2 ? hits.length >= 2 : hits.length >= 1;
        if (!enough) continue;

        const dedupeKey = `${shift.character}|${lower(shift.learned)}|${index}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        issues.push({
          kind: "knowledge-conflict",
          character: shift.character,
          learned: shift.learned,
          learnedAtChapter: learnedAt,
          chapterIndex: index,
          chapterTitle: chapter.title || `Chapter ${index + 1}`,
          excerpt: excerptAround(chapter.content, hits),
          message:
            `${shift.character} acts on "${shift.learned}" in "${chapter.title || `Chapter ${index + 1}`}" ` +
            `(chapter ${index + 1}), but the timeline records learning it in chapter ${learnedAt + 1}.`,
        });
        break; // one issue per learning event: the earliest offending chapter
      }
    }
  }

  return issues;
}

export function findUnresolvedPromises(memories: readonly DoctorMemory[]): UnresolvedPromiseIssue[] {
  const ordered = [...memories].sort((a, b) => (a.chapterIndex ?? 0) - (b.chapterIndex ?? 0));
  const opened = new Map<string, number | null>(); // promise -> first chapter
  const resolved: string[] = [];

  for (const memory of ordered) {
    const sd = memory.structuredData ?? {};
    for (const promise of sd.openPromisesCreated ?? []) {
      const p = String(promise ?? "").trim();
      if (p && !opened.has(p)) opened.set(p, memory.chapterIndex ?? null);
    }
    for (const promise of sd.openPromisesResolved ?? []) {
      const p = String(promise ?? "").trim();
      if (p) resolved.push(p);
    }
  }

  const issues: UnresolvedPromiseIssue[] = [];
  for (const [promise, openedInChapter] of opened) {
    const paid = resolved.some((r) => r && (r.includes(promise) || promise.includes(r)));
    if (paid) continue;
    issues.push({
      kind: "unresolved-promise",
      promise,
      openedInChapter,
      message:
        `"${promise}" is opened` +
        (openedInChapter === null ? "" : ` in chapter ${openedInChapter + 1}`) +
        " and is never paid off by the final chapter.",
    });
  }
  return issues;
}

export function runStoryDoctor(input: {
  readonly chapters: readonly DoctorChapter[];
  readonly memories: readonly DoctorMemory[];
}): StoryDoctorReport {
  const chapters = [...(input.chapters ?? [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
  const memories = input.memories ?? [];
  const issues = [
    ...findKnowledgeConflicts(chapters, memories),
    ...findUnresolvedPromises(memories),
  ];

  let created = 0;
  let resolved = 0;
  let shifts = 0;
  for (const m of memories) {
    const sd = m.structuredData ?? {};
    created += (sd.openPromisesCreated ?? []).length;
    resolved += (sd.openPromisesResolved ?? []).length;
    shifts += (sd.knowledgeShifts ?? []).length;
  }

  return {
    issues,
    checked: { chapters: chapters.length, knowledgeShifts: shifts, promisesCreated: created, promisesResolved: resolved },
  };
}
