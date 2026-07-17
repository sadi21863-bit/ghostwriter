import { describe, it, expect, vi, beforeEach } from "vitest";

const createMessage = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class { messages = { create: (...args: any[]) => createMessage(...args) }; },
}));

const generateSoulImage = vi.fn();
vi.mock("@/lib/higgsfield/client", () => ({
  generateSoulImage: (...args: any[]) => generateSoulImage(...args),
}));

const { generateBestOfN } = await import("../best-of-n");

function selectionResponse(json: object) {
  return { content: [{ type: "text", text: JSON.stringify(json) }] };
}

describe("generateBestOfN", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates N candidates in parallel (default 3) and picks the one the comparative call selects", async () => {
    generateSoulImage
      .mockResolvedValueOnce("https://blob.example/candidate-0.png")
      .mockResolvedValueOnce("https://blob.example/candidate-1.png")
      .mockResolvedValueOnce("https://blob.example/candidate-2.png");
    createMessage.mockResolvedValue(selectionResponse({ best_index: 1, reason: "Best facial match to the reference." }));

    const result = await generateBestOfN({ apiKey: "key", prompt: "a scene", referenceImageUrl: "https://blob.example/ref.png" });

    expect(generateSoulImage).toHaveBeenCalledTimes(3);
    expect(result.candidateUrls).toEqual([
      "https://blob.example/candidate-0.png",
      "https://blob.example/candidate-1.png",
      "https://blob.example/candidate-2.png",
    ]);
    expect(result.bestImageUrl).toBe("https://blob.example/candidate-1.png");
    expect(result.reason).toBe("Best facial match to the reference.");
  });

  it("respects a custom n", async () => {
    generateSoulImage.mockResolvedValue("https://blob.example/candidate.png");
    createMessage.mockResolvedValue(selectionResponse({ best_index: 0, reason: "ok" }));

    await generateBestOfN({ apiKey: "key", prompt: "a scene", n: 5 });

    expect(generateSoulImage).toHaveBeenCalledTimes(5);
  });

  it("skips the comparative call entirely when only one candidate generates successfully", async () => {
    generateSoulImage
      .mockResolvedValueOnce("https://blob.example/only-one.png")
      .mockRejectedValueOnce(new Error("provider error"))
      .mockRejectedValueOnce(new Error("provider error"));

    const result = await generateBestOfN({ apiKey: "key", prompt: "a scene" });

    expect(result.bestImageUrl).toBe("https://blob.example/only-one.png");
    expect(result.candidateUrls).toEqual(["https://blob.example/only-one.png"]);
    expect(createMessage).not.toHaveBeenCalled();
  });

  it("shrinks the field rather than failing when some (not all) candidates fail to generate", async () => {
    generateSoulImage
      .mockResolvedValueOnce("https://blob.example/a.png")
      .mockRejectedValueOnce(new Error("provider error"))
      .mockResolvedValueOnce("https://blob.example/c.png");
    createMessage.mockResolvedValue(selectionResponse({ best_index: 1, reason: "Better of the two." }));

    const result = await generateBestOfN({ apiKey: "key", prompt: "a scene" });

    expect(result.candidateUrls).toEqual(["https://blob.example/a.png", "https://blob.example/c.png"]);
    expect(result.bestImageUrl).toBe("https://blob.example/c.png");
  });

  it("throws only when every single candidate generation fails", async () => {
    generateSoulImage.mockRejectedValue(new Error("provider down"));

    await expect(generateBestOfN({ apiKey: "key", prompt: "a scene" })).rejects.toThrow(/all candidate generations failed/);
    expect(createMessage).not.toHaveBeenCalled();
  });

  it("defaults to the first candidate when the selection response has no parseable JSON (fail-open)", async () => {
    generateSoulImage
      .mockResolvedValueOnce("https://blob.example/a.png")
      .mockResolvedValueOnce("https://blob.example/b.png")
      .mockResolvedValueOnce("https://blob.example/c.png");
    createMessage.mockResolvedValue({ content: [{ type: "text", text: "not json at all" }] });

    const result = await generateBestOfN({ apiKey: "key", prompt: "a scene" });

    expect(result.bestImageUrl).toBe("https://blob.example/a.png");
    expect(result.reason).toContain("defaulted to the first candidate");
  });

  it("defaults to the first candidate when best_index is out of range (fail-open)", async () => {
    generateSoulImage
      .mockResolvedValueOnce("https://blob.example/a.png")
      .mockResolvedValueOnce("https://blob.example/b.png")
      .mockResolvedValueOnce("https://blob.example/c.png");
    createMessage.mockResolvedValue(selectionResponse({ best_index: 99, reason: "oops" }));

    const result = await generateBestOfN({ apiKey: "key", prompt: "a scene" });

    expect(result.bestImageUrl).toBe("https://blob.example/a.png");
  });

  it("defaults to the first candidate when the selection call itself throws (fail-open)", async () => {
    generateSoulImage
      .mockResolvedValueOnce("https://blob.example/a.png")
      .mockResolvedValueOnce("https://blob.example/b.png")
      .mockResolvedValueOnce("https://blob.example/c.png");
    createMessage.mockRejectedValue(new Error("Anthropic down"));

    const result = await generateBestOfN({ apiKey: "key", prompt: "a scene" });

    expect(result.bestImageUrl).toBe("https://blob.example/a.png");
    expect(result.reason).toContain("Selection call failed");
  });

  it("passes both soulId and referenceImageUrl through to every candidate generation", async () => {
    generateSoulImage.mockResolvedValue("https://blob.example/x.png");
    createMessage.mockResolvedValue(selectionResponse({ best_index: 0, reason: "ok" }));

    await generateBestOfN({ apiKey: "key", prompt: "a scene", soulId: "soul-123", referenceImageUrl: "https://blob.example/ref.png" });

    for (const call of generateSoulImage.mock.calls) {
      expect(call[0]).toMatchObject({ soulId: "soul-123", referenceImageUrl: "https://blob.example/ref.png" });
    }
  });
});
