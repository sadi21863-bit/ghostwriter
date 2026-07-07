import { cosineSimilarity } from "@/lib/ai/embeddings";

// Warn-don't-block duplicate detection for World Bible entities. A real gap:
// character/location/world-entity name matching elsewhere in this codebase is
// exact-substring (e.g. audio segment speaker lookup) — nothing catches a
// renamed character or a forgotten near-duplicate. Threshold is deliberately
// high (0.87) — this flags likely-the-same-entity, not "thematically related"
// (the craft-library exemplar retrieval elsewhere uses a much looser ~0.2-0.3
// bar for a completely different purpose).
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.87;
const MAX_MATCHES = 3;

export interface SimilarEntityMatch {
  id: string;
  name: string;
  similarity: number;
}

export function findSimilarEntities(
  embedding: number[],
  candidates: Array<{ id: string; name: string; embedding: number[] | null }>,
  excludeId?: string
): SimilarEntityMatch[] {
  return candidates
    .filter(c => c.id !== excludeId && Array.isArray(c.embedding) && c.embedding.length > 0)
    .map(c => ({ id: c.id, name: c.name, similarity: cosineSimilarity(embedding, c.embedding as number[]) }))
    .filter(m => m.similarity >= DUPLICATE_SIMILARITY_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_MATCHES);
}

function joinNonEmpty(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(". ");
}

export function buildCharacterEmbeddingText(c: {
  name: string; role?: string | null; appearance?: string | null; personality?: string | null; backstory?: string | null;
}): string {
  return joinNonEmpty([c.name, c.role, c.appearance, c.personality, c.backstory]).slice(0, 4000);
}

export function buildLocationEmbeddingText(l: {
  name: string; description?: string | null; atmosphere?: string | null; history?: string | null;
}): string {
  return joinNonEmpty([l.name, l.description, l.atmosphere, l.history]).slice(0, 4000);
}

export function buildWorldEntityEmbeddingText(e: {
  name: string; summary?: string | null; description?: string | null;
}): string {
  return joinNonEmpty([e.name, e.summary, e.description]).slice(0, 4000);
}
