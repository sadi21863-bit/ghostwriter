import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("@/db", () => ({
  db: { query: { workPackets: { findMany: (...args: any[]) => findMany(...args) } } },
}));

const generateEmbedding = vi.fn();
const cosineSimilarity = vi.fn();
vi.mock("@/lib/ai/embeddings", () => ({
  generateEmbedding: (...args: any[]) => generateEmbedding(...args),
  cosineSimilarity: (...args: any[]) => cosineSimilarity(...args),
}));

const { buildVoiceExemplars } = await import("@/lib/ai/exemplars");

describe("buildVoiceExemplars", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the top-2 most similar packets above the similarity threshold", async () => {
    generateEmbedding.mockResolvedValue([0.1, 0.2]);
    findMany.mockResolvedValue([
      { title: "A", creator: "X", embedding: [1, 0], thematicCore: "loss" },
      { title: "B", creator: "Y", embedding: [1, 0], thematicCore: "betrayal" },
      { title: "C", creator: "Z", embedding: [1, 0], thematicCore: "redemption" },
    ]);
    cosineSimilarity.mockReturnValueOnce(0.9).mockReturnValueOnce(0.8).mockReturnValueOnce(0.1);
    const result = await buildVoiceExemplars("user-1", "a scene about grief");
    expect(result).toContain("A");
    expect(result).toContain("B");
    expect(result).not.toContain('"C"');
  });

  it("returns empty string when embedding generation fails open (returns falsy)", async () => {
    generateEmbedding.mockResolvedValue(null);
    const result = await buildVoiceExemplars("user-1", "prompt");
    expect(result).toBe("");
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns empty string when nothing clears the similarity threshold", async () => {
    generateEmbedding.mockResolvedValue([0.1, 0.2]);
    findMany.mockResolvedValue([{ title: "A", embedding: [1, 0] }]);
    cosineSimilarity.mockReturnValue(0.05);
    const result = await buildVoiceExemplars("user-1", "prompt");
    expect(result).toBe("");
  });

  it("fails open (returns empty string) when the DB query throws", async () => {
    generateEmbedding.mockResolvedValue([0.1, 0.2]);
    findMany.mockRejectedValue(new Error("db down"));
    const result = await buildVoiceExemplars("user-1", "prompt");
    expect(result).toBe("");
  });
});
