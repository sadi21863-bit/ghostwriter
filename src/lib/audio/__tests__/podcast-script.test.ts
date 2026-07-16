import { describe, it, expect, vi, beforeEach } from "vitest";

const createMessage = vi.fn();
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { create: (...args: any[]) => createMessage(...args) } },
}));
vi.mock("@/lib/ai/engine", () => ({ MODELS: { default: "claude-sonnet-5", quality: "claude-opus-4-8" } }));

import { generatePodcastScript } from "../podcast-script";

function textResponse(json: string) {
  return { content: [{ type: "text", text: json }] };
}

describe("generatePodcastScript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses a valid JSON array of turns", async () => {
    createMessage.mockResolvedValue(textResponse(JSON.stringify([
      { speaker: "A", text: "So this chapter opens with a real gut-punch." },
      { speaker: "B", text: "Right — the dome reveal." },
    ])));

    const turns = await generatePodcastScript("chapter text here", "Horizon Line");

    expect(turns).toEqual([
      { speaker: "A", text: "So this chapter opens with a real gut-punch." },
      { speaker: "B", text: "Right — the dome reveal." },
    ]);
  });

  it("strips markdown code fences before parsing", async () => {
    createMessage.mockResolvedValue(textResponse("```json\n" + JSON.stringify([{ speaker: "A", text: "Hi" }]) + "\n```"));

    const turns = await generatePodcastScript("text", "Project");

    expect(turns).toEqual([{ speaker: "A", text: "Hi" }]);
  });

  it("drops malformed turns (missing text, invalid speaker) instead of throwing", async () => {
    createMessage.mockResolvedValue(textResponse(JSON.stringify([
      { speaker: "A", text: "Valid turn." },
      { speaker: "C", text: "Invalid speaker." },
      { speaker: "B", text: "" },
      { speaker: "B" },
    ])));

    const turns = await generatePodcastScript("text", "Project");

    expect(turns).toEqual([{ speaker: "A", text: "Valid turn." }]);
  });

  it("throws clearly when the response isn't valid JSON", async () => {
    createMessage.mockResolvedValue(textResponse("not json at all"));

    await expect(generatePodcastScript("text", "Project")).rejects.toThrow(/Failed to parse/);
  });

  it("throws clearly when the response is valid JSON but not an array", async () => {
    createMessage.mockResolvedValue(textResponse(JSON.stringify({ speaker: "A", text: "oops" })));

    await expect(generatePodcastScript("text", "Project")).rejects.toThrow(/not a JSON array/);
  });

  it("truncates very long chapter content before sending it to the model", async () => {
    createMessage.mockResolvedValue(textResponse(JSON.stringify([{ speaker: "A", text: "ok" }])));
    const longContent = "x".repeat(50_000);

    await generatePodcastScript(longContent, "Project");

    const call = createMessage.mock.calls[0][0];
    const userMessage = call.messages[0].content as string;
    expect(userMessage.length).toBeLessThan(longContent.length);
  });
});
