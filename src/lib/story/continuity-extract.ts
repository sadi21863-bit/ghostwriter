/**
 * Parse the story loop's continuity extraction into the exact structuredData
 * shape the Story Doctor reads.
 *
 * The loop used to post only `keyEvents`, so `knowledgeShifts` and the promise
 * arrays were always empty and the Doctor's two checks had nothing to run on.
 * A generated book could pass "clean" while containing timeline contradictions
 * or unpaid setups. This parser is deliberately lenient about the wrapper
 * (models add code fences or a sentence before the JSON) and strict about the
 * shape: malformed items are dropped, never guessed.
 */

export interface ExtractedKnowledgeShift {
  readonly character: string;
  readonly learned: string;
  readonly from: string;
  readonly to: string;
}

export interface ExtractedContinuity {
  readonly openPromisesCreated: string[];
  readonly openPromisesResolved: string[];
  readonly knowledgeShifts: ExtractedKnowledgeShift[];
  readonly keyEvents: string[];
}

/** The subset of a stored memory the promise walk needs. */
export interface ContinuityMemory {
  readonly id?: string;
  readonly fact?: string;
  readonly chapterId?: string | null;
  readonly chapterIndex?: number | null;
  readonly structuredData?: Record<string, unknown> | null;
}

/**
 * Promises still open after walking memories in order, using the Doctor's own
 * fuzzy close rule (a resolution matches when either text contains the other).
 * Duplicate setups are kept once; a promise with no recorded resolution stays
 * open even when a later chapter resolves it implicitly in prose.
 */
export function openPromisesFrom(
  memories: readonly ContinuityMemory[],
): string[] {
  const opened = new Map<string, number>();
  const resolved: string[] = [];
  for (const memory of memories) {
    const data = (memory.structuredData ?? {}) as Record<string, unknown>;
    const created = Array.isArray(data["openPromisesCreated"])
      ? data["openPromisesCreated"]
      : [];
    const paid = Array.isArray(data["openPromisesResolved"])
      ? data["openPromisesResolved"]
      : [];
    for (const value of created) {
      const promise = String(value ?? "").trim();
      if (promise && !opened.has(promise)) {
        opened.set(promise, memory.chapterIndex ?? 0);
      }
    }
    for (const value of paid) {
      const promise = String(value ?? "").trim();
      if (promise) resolved.push(promise);
    }
  }
  return [...opened.keys()].filter(
    (promise) => !resolved.some((r) => r.includes(promise) || promise.includes(r)),
  );
}

const MAX_ITEMS = 8;
const MAX_TEXT = 300;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_TEXT) : "";
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(text)
    .filter(Boolean)
    .slice(0, MAX_ITEMS);
}

function shift(value: unknown): ExtractedKnowledgeShift | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const character = text(row["character"]);
  const learned = text(row["learned"]);
  if (!character || !learned) return null;
  // The memory decoder drops the whole knowledgeShifts array when from/to is
  // missing; default to the extractor's neutral pair rather than lose the row.
  return {
    character,
    learned,
    from: text(row["from"]) || "IGNORANT",
    to: text(row["to"]) || "KNOWS",
  };
}

/**
 * Extract the first JSON object from `raw` and normalize it. Returns null when
 * there is no parseable object or every recognized field is empty — callers
 * then fall back to a key-events note instead of writing an empty memory.
 */
export function parseContinuityNotes(raw: string): ExtractedContinuity | null {
  const input = String(raw ?? "").trim();
  if (!input) return null;
  const start = input.indexOf("{");
  const end = input.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const row = parsed as Record<string, unknown>;
  const knowledgeShifts = (Array.isArray(row["knowledgeShifts"]) ? row["knowledgeShifts"] : [])
    .map(shift)
    .filter((s): s is ExtractedKnowledgeShift => s !== null)
    .slice(0, MAX_ITEMS);

  const result: ExtractedContinuity = {
    openPromisesCreated: textList(row["openPromisesCreated"]),
    openPromisesResolved: textList(row["openPromisesResolved"]),
    knowledgeShifts,
    keyEvents: textList(row["keyEvents"]),
  };

  const empty =
    result.openPromisesCreated.length === 0 &&
    result.openPromisesResolved.length === 0 &&
    result.knowledgeShifts.length === 0 &&
    result.keyEvents.length === 0;
  return empty ? null : result;
}
