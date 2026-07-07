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

  it("prefers a mode-tagged craft principle over the generic thematic notes when a mode is given", async () => {
    generateEmbedding.mockResolvedValue([0.1, 0.2]);
    findMany.mockResolvedValue([
      {
        title: "A", creator: "X", embedding: [1, 0], thematicCore: "generic theme",
        craftPrinciples: [{ principle: "Ground force from the hips", example: "the duel scene", applicableTo: ["combat"] }],
      },
    ]);
    cosineSimilarity.mockReturnValue(0.9);
    const result = await buildVoiceExemplars("user-1", "a fight scene", "combat");
    expect(result).toContain("Ground force from the hips");
    expect(result).not.toContain("generic theme");
  });

  it("falls back to generic thematic notes when no craft principle is tagged for the given mode", async () => {
    generateEmbedding.mockResolvedValue([0.1, 0.2]);
    findMany.mockResolvedValue([
      {
        title: "A", creator: "X", embedding: [1, 0], thematicCore: "generic theme",
        craftPrinciples: [{ principle: "Comedic timing", example: "the banter scene", applicableTo: ["comedy"] }],
      },
    ]);
    cosineSimilarity.mockReturnValue(0.9);
    const result = await buildVoiceExemplars("user-1", "a fight scene", "combat");
    expect(result).toContain("generic theme");
  });

  it("ranks a packet with a mode-tagged principle above an equally-similar packet with none", async () => {
    generateEmbedding.mockResolvedValue([0.1, 0.2]);
    findMany.mockResolvedValue([
      { title: "NoTag", embedding: [1, 0], thematicCore: "loss", craftPrinciples: [] },
      {
        title: "Tagged", embedding: [1, 0], thematicCore: "loss too",
        craftPrinciples: [{ principle: "Withhold the next blow", example: "the alley fight", applicableTo: ["combat"] }],
      },
      { title: "AlsoNoTag", embedding: [1, 0], thematicCore: "loss three", craftPrinciples: [] },
    ]);
    cosineSimilarity.mockReturnValue(0.5);
    const result = await buildVoiceExemplars("user-1", "a fight scene", "combat");
    expect(result).toContain("Tagged");
    expect(result).toContain("Withhold the next blow");
  });

  it("ignores mode filtering entirely when no mode is supplied (backward compatible)", async () => {
    generateEmbedding.mockResolvedValue([0.1, 0.2]);
    findMany.mockResolvedValue([
      { title: "A", embedding: [1, 0], thematicCore: "generic theme", craftPrinciples: [{ principle: "x", example: "y", applicableTo: ["combat"] }] },
    ]);
    cosineSimilarity.mockReturnValue(0.9);
    const result = await buildVoiceExemplars("user-1", "prompt");
    expect(result).toContain("generic theme");
  });
});
