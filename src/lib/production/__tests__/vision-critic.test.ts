import { describe, it, expect, vi, beforeEach } from "vitest";

const createMessage = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class { messages = { create: (...args: any[]) => createMessage(...args) }; },
}));

const { critiqueShot } = await import("../vision-critic");

function textResponse(json: object) {
  return { content: [{ type: "text", text: JSON.stringify(json) }] };
}

describe("critiqueShot", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the generated image plus reference/previous-shot images when provided", async () => {
    createMessage.mockResolvedValue(textResponse({
      promptAdherence: 0.8, characterConsistency: 0.9, continuity: 0.7,
      technicalQuality: 0.9, pacing: 0.6, coverage: 0.8, aesthetics: 0.7,
    }));

    await critiqueShot({
      imageUrl: "https://blob.example/shot.jpg",
      prompt: "The Dealer walks through the factory at dusk",
      referenceImageUrl: "https://blob.example/portrait.jpg",
      previousShotImageUrl: "https://blob.example/prev-shot.jpg",
    });

    expect(createMessage).toHaveBeenCalledTimes(1);
    const call = createMessage.mock.calls[0][0];
    const userContent = call.messages[0].content;
    const imageBlocks = userContent.filter((b: any) => b.type === "image");
    expect(imageBlocks).toHaveLength(3);
    expect(imageBlocks.map((b: any) => b.source.url)).toEqual([
      "https://blob.example/shot.jpg",
      "https://blob.example/portrait.jpg",
      "https://blob.example/prev-shot.jpg",
    ]);
  });

  it("sends only the generated image when no reference or previous shot is given", async () => {
    createMessage.mockResolvedValue(textResponse({ promptAdherence: 0.5 }));

    await critiqueShot({ imageUrl: "https://blob.example/shot.jpg", prompt: "A quiet room" });

    const call = createMessage.mock.calls[0][0];
    const imageBlocks = call.messages[0].content.filter((b: any) => b.type === "image");
    expect(imageBlocks).toHaveLength(1);
  });

  it("parses the model's JSON scores into Partial<EvalDimensions>", async () => {
    createMessage.mockResolvedValue(textResponse({
      promptAdherence: 0.8, characterConsistency: 0.4, continuity: 0.6,
      technicalQuality: 0.9, pacing: 0.5, coverage: 0.7, aesthetics: 0.6,
    }));

    const result = await critiqueShot({ imageUrl: "https://blob.example/shot.jpg", prompt: "A hallway" });

    expect(result).toEqual({
      promptAdherence: 0.8, characterConsistency: 0.4, continuity: 0.6,
      technicalQuality: 0.9, pacing: 0.5, coverage: 0.7, aesthetics: 0.6,
    });
  });

  it("strips markdown code fences before parsing", async () => {
    createMessage.mockResolvedValue({
      content: [{ type: "text", text: "```json\n{\"promptAdherence\": 0.7}\n```" }],
    });

    const result = await critiqueShot({ imageUrl: "https://blob.example/shot.jpg", prompt: "A hallway" });
    expect(result).toEqual({ promptAdherence: 0.7 });
  });

  it("extracts the JSON object even when the model appends prose after it", async () => {
    createMessage.mockResolvedValue({
      content: [{
        type: "text",
        text: '```json\n{"promptAdherence": 0.8, "characterConsistency": 0.5, "continuity": 0.6, "technicalQuality": 0.9, "pacing": 0.4, "coverage": 0.7, "aesthetics": 0.85}\n```\n\n**Brief Assessment:**\n- Strong technical quality, muted color grading.',
      }],
    });

    const result = await critiqueShot({ imageUrl: "https://blob.example/shot.jpg", prompt: "A hallway" });
    expect(result).toEqual({
      promptAdherence: 0.8, characterConsistency: 0.5, continuity: 0.6,
      technicalQuality: 0.9, pacing: 0.4, coverage: 0.7, aesthetics: 0.85,
    });
  });

  it("fails open (returns {}) on malformed JSON rather than throwing", async () => {
    createMessage.mockResolvedValue({ content: [{ type: "text", text: "not json at all" }] });
    const result = await critiqueShot({ imageUrl: "https://blob.example/shot.jpg", prompt: "A hallway" });
    expect(result).toEqual({});
  });

  it("fails open (returns {}) when the Anthropic call itself throws", async () => {
    createMessage.mockRejectedValue(new Error("503 overloaded"));
    const result = await critiqueShot({ imageUrl: "https://blob.example/shot.jpg", prompt: "A hallway" });
    expect(result).toEqual({});
  });
});
