import { describe, it, expect, vi, beforeEach } from "vitest";

const cosineSimilarity = vi.fn();
vi.mock("@/lib/ai/embeddings", () => ({ cosineSimilarity: (...args: any[]) => cosineSimilarity(...args) }));

const {
  findSimilarEntities,
  buildCharacterEmbeddingText,
  buildLocationEmbeddingText,
  buildWorldEntityEmbeddingText,
  DUPLICATE_SIMILARITY_THRESHOLD,
} = await import("../duplicate-detection");

describe("findSimilarEntities", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns candidates at or above the duplicate threshold, sorted by similarity desc", () => {
    cosineSimilarity.mockReturnValueOnce(0.95).mockReturnValueOnce(0.88).mockReturnValueOnce(0.5);
    const result = findSimilarEntities([1, 0], [
      { id: "a", name: "Sara", embedding: [1, 0] },
      { id: "b", name: "Sarah", embedding: [1, 0] },
      { id: "c", name: "Unrelated", embedding: [1, 0] },
    ]);
    expect(result.map(r => r.id)).toEqual(["a", "b"]);
    expect(result[0].similarity).toBe(0.95);
  });

  it("excludes the given excludeId even if it would otherwise match", () => {
    cosineSimilarity.mockReturnValue(0.99);
    const result = findSimilarEntities([1, 0], [{ id: "self", name: "Me", embedding: [1, 0] }], "self");
    expect(result).toEqual([]);
  });

  it("excludes candidates with no embedding", () => {
    cosineSimilarity.mockReturnValue(0.99);
    const result = findSimilarEntities([1, 0], [{ id: "a", name: "A", embedding: null }]);
    expect(result).toEqual([]);
    expect(cosineSimilarity).not.toHaveBeenCalled();
  });

  it("caps results at 3 matches", () => {
    cosineSimilarity.mockReturnValue(0.99);
    const candidates = Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, name: `N${i}`, embedding: [1, 0] }));
    const result = findSimilarEntities([1, 0], candidates);
    expect(result).toHaveLength(3);
  });

  it("uses a high (0.87) threshold, distinct from loose exemplar-retrieval thresholds elsewhere", () => {
    expect(DUPLICATE_SIMILARITY_THRESHOLD).toBe(0.87);
  });
});

describe("embedding text builders", () => {
  it("builds character embedding text from identity-defining fields, skipping empties", () => {
    const text = buildCharacterEmbeddingText({ name: "Mara", role: "Protagonist", appearance: null, personality: "Stubborn", backstory: undefined });
    expect(text).toBe("Mara. Protagonist. Stubborn");
  });

  it("builds location embedding text", () => {
    const text = buildLocationEmbeddingText({ name: "The Old Mill", description: "Abandoned", atmosphere: null, history: null });
    expect(text).toBe("The Old Mill. Abandoned");
  });

  it("builds world-entity embedding text", () => {
    const text = buildWorldEntityEmbeddingText({ name: "The Ring", summary: "A cursed ring", description: null });
    expect(text).toBe("The Ring. A cursed ring");
  });
});
