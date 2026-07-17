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

  it("compresses very long chapter content (via compressForContext) rather than silently truncating it — real bug fixed in item 71/72: a plain .slice() used to drop content past the cutoff with no signal anything was missing", async () => {
    // Real chapter prose has paragraph breaks - compressForContext chunks on
    // those. Every compression sub-call and the final script-generation call
    // all go through the same mocked createMessage, so route by call order:
    // N compression calls (one per paragraph-sized chunk) then one final call.
    const paragraphs = Array.from({ length: 6 }, (_, i) => `Paragraph ${i}: ${"word ".repeat(500)}`);
    const longContent = paragraphs.join("\n\n"); // well over the 12000-char compression threshold
    createMessage
      .mockImplementation(async (params: any) => {
        // Compression calls have no `system` prompt about podcast hosts; the
        // real podcast-script call does. Use that to return the right shape.
        if (params.system?.includes("two-host discussion podcast script")) {
          return textResponse(JSON.stringify([{ speaker: "A", text: "ok" }]));
        }
        return textResponse("compressed chunk");
      });

    await generatePodcastScript(longContent, "Project");

    const finalCall = createMessage.mock.calls.find((c: any) => c[0].system?.includes("two-host discussion podcast script"));
    expect(finalCall).toBeTruthy();
    const userMessage = finalCall![0].messages[0].content as string;
    expect(userMessage.length).toBeLessThan(longContent.length);
    expect(userMessage).toContain("compressed chunk");
    expect(createMessage.mock.calls.length).toBeGreaterThan(1); // real chunking/compression happened, not a single pass-through
  });
});
