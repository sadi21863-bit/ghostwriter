import { db } from "@/db";
import { storyPromises } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateEmbedding, cosineSimilarity } from "@/lib/ai/embeddings";

// Fire-and-forget, mirrors updateChapterEmbedding's fail-open convention —
// never blocks the promise-creation response.
export function updatePromiseEmbedding(promiseId: string, setup: string): void {
  if (!setup?.trim()) return;
  generateEmbedding(setup.slice(0, 4000))
    .then(embedding => db.update(storyPromises).set({ embedding }).where(eq(storyPromises.id, promiseId)))
    .catch(() => { /* embedding refresh must never affect the main save path */ });
}

// Semantic cross-referencing for the Promise Tracker / knowledge_audit (extends
// item 44's structured-promise injection, which is purely literal DB-row text —
// nothing catches a promise that's "the same setup, worded differently" than
// what actually shows up in the manuscript). This is a HINT layer only: it
// surfaces a candidate chapter for the LLM auditor to verify, never asserts a
// payoff actually happened.
export const PAYOFF_HINT_THRESHOLD = 0.5;
const MAX_HINTS_PER_PROMISE = 2;

export interface ChapterCandidate {
  id: string;
  title: string;
  embedding: number[] | null;
}

export interface PromiseForHints {
  id: string;
  setup: string;
  priority: string | null;
  status: string | null;
  payoffChapterId: string | null;
  setupChapterId: string | null;
  embedding: number[] | null;
}

export function findLikelyPayoffChapters(
  promiseEmbedding: number[],
  chapters: ChapterCandidate[],
  excludeChapterId?: string | null
): Array<{ id: string; title: string; similarity: number }> {
  return chapters
    .filter(c => c.id !== excludeChapterId && Array.isArray(c.embedding) && c.embedding.length > 0)
    .map(c => ({ id: c.id, title: c.title, similarity: cosineSimilarity(promiseEmbedding, c.embedding as number[]) }))
    .filter(m => m.similarity >= PAYOFF_HINT_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_HINTS_PER_PROMISE);
}

// Only hints at promises that are still open (unresolved) AND have no
// payoffChapterId already recorded — a promise the user already marked paid
// off doesn't need a semantic lead, and a closed/abandoned promise isn't
// waiting on anything.
export function buildPromiseSemanticHints(
  promises: PromiseForHints[],
  chapters: ChapterCandidate[]
): string {
  const lines: string[] = [];

  for (const p of promises) {
    if (p.status !== "open" || p.payoffChapterId || !p.embedding) continue;
    const matches = findLikelyPayoffChapters(p.embedding, chapters, p.setupChapterId);
    if (!matches.length) continue;
    const chapterList = matches.map(m => `"${m.title}"`).join(" or ");
    lines.push(`- Promise "${p.setup}" [priority ${p.priority}] has no confirmed payoff, but semantically similar content was found in ${chapterList} — verify whether this already resolves it.`);
  }

  return lines.join("\n");
}
