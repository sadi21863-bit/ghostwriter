import { describe, it, expect, vi, beforeEach } from "vitest";

const updateSet = vi.fn();
vi.mock("@/db", () => ({
  db: {
    update: () => ({
      set: (vals: any) => {
        updateSet(vals);
        return { where: () => Promise.resolve(undefined) };
      },
    }),
  },
}));

const generateEmbedding = vi.fn();
const cosineSimilarity = vi.fn();
vi.mock("@/lib/ai/embeddings", () => ({
  generateEmbedding: (...args: any[]) => generateEmbedding(...args),
  cosineSimilarity: (...args: any[]) => cosineSimilarity(...args),
}));

const {
  findLikelyPayoffChapters,
  buildPromiseSemanticHints,
  updatePromiseEmbedding,
  PAYOFF_HINT_THRESHOLD,
} = await import("../promise-cross-reference");

describe("findLikelyPayoffChapters", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns chapters at or above the hint threshold, sorted by similarity desc", () => {
    cosineSimilarity.mockReturnValueOnce(0.9).mockReturnValueOnce(0.6).mockReturnValueOnce(0.2);
    const result = findLikelyPayoffChapters([1, 0], [
      { id: "c1", title: "High", embedding: [1, 0] },
      { id: "c2", title: "Mid", embedding: [1, 0] },
      { id: "c3", title: "Low", embedding: [1, 0] },
    ]);
    expect(result.map(r => r.id)).toEqual(["c1", "c2"]);
  });

  it("excludes the given excludeChapterId (the promise's own setup chapter)", () => {
    cosineSimilarity.mockReturnValue(0.99);
    const result = findLikelyPayoffChapters([1, 0], [{ id: "setup-chapter", title: "Setup", embedding: [1, 0] }], "setup-chapter");
    expect(result).toEqual([]);
  });

  it("skips chapters with no embedding", () => {
    const result = findLikelyPayoffChapters([1, 0], [{ id: "c1", title: "A", embedding: null }]);
    expect(result).toEqual([]);
    expect(cosineSimilarity).not.toHaveBeenCalled();
  });

  it("uses a 0.5 threshold", () => {
    expect(PAYOFF_HINT_THRESHOLD).toBe(0.5);
  });
});

describe("buildPromiseSemanticHints", () => {
  beforeEach(() => vi.clearAllMocks());

  const chapters = [{ id: "chap-2", title: "The Reveal", embedding: [1, 0] }];

  it("hints at an open promise with no payoffChapterId when a similar chapter is found", () => {
    cosineSimilarity.mockReturnValue(0.9);
    const promises = [{
      id: "p1", setup: "Mara hides the ring", priority: "A", status: "open",
      payoffChapterId: null, setupChapterId: "chap-1", embedding: [1, 0],
    }];
    const hints = buildPromiseSemanticHints(promises, chapters);
    expect(hints).toContain("Mara hides the ring");
    expect(hints).toContain("The Reveal");
  });

  it("skips a promise that already has a payoffChapterId recorded", () => {
    const promises = [{
      id: "p1", setup: "Mara hides the ring", priority: "A", status: "open",
      payoffChapterId: "chap-2", setupChapterId: "chap-1", embedding: [1, 0],
    }];
    const hints = buildPromiseSemanticHints(promises, chapters);
    expect(hints).toBe("");
    expect(cosineSimilarity).not.toHaveBeenCalled();
  });

  it("skips a promise that isn't open (already resolved/abandoned)", () => {
    const promises = [{
      id: "p1", setup: "Mara hides the ring", priority: "A", status: "resolved",
      payoffChapterId: null, setupChapterId: "chap-1", embedding: [1, 0],
    }];
    const hints = buildPromiseSemanticHints(promises, chapters);
    expect(hints).toBe("");
  });

  it("skips a promise with no embedding yet", () => {
    const promises = [{
      id: "p1", setup: "Mara hides the ring", priority: "A", status: "open",
      payoffChapterId: null, setupChapterId: "chap-1", embedding: null,
    }];
    const hints = buildPromiseSemanticHints(promises, chapters);
    expect(hints).toBe("");
  });

  it("returns an empty string when nothing clears the threshold", () => {
    cosineSimilarity.mockReturnValue(0.1);
    const promises = [{
      id: "p1", setup: "Mara hides the ring", priority: "A", status: "open",
      payoffChapterId: null, setupChapterId: "chap-1", embedding: [1, 0],
    }];
    const hints = buildPromiseSemanticHints(promises, chapters);
    expect(hints).toBe("");
  });
});

describe("updatePromiseEmbedding", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips empty setup text", () => {
    updatePromiseEmbedding("p1", "");
    expect(generateEmbedding).not.toHaveBeenCalled();
  });

  it("computes and stores an embedding for real setup text", async () => {
    generateEmbedding.mockResolvedValue([0.1, 0.2]);
    updatePromiseEmbedding("p1", "Mara hides the ring in the old mill");
    await vi.waitFor(() => expect(generateEmbedding).toHaveBeenCalled());
    await vi.waitFor(() => expect(updateSet).toHaveBeenCalledWith({ embedding: [0.1, 0.2] }));
  });

  it("never throws even if the embedding call rejects (fire-and-forget)", () => {
    generateEmbedding.mockRejectedValue(new Error("embedding API down"));
    expect(() => updatePromiseEmbedding("p1", "some setup text")).not.toThrow();
  });
});
