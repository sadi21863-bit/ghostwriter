import { describe, it, expect, vi, beforeEach } from "vitest";

const createMessage = vi.fn();
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { create: (...args: any[]) => createMessage(...args) } },
}));
vi.mock("@/lib/ai/engine", () => ({ MODELS: { fast: "claude-haiku-4-5-20251001", default: "claude-sonnet-5" } }));

import { compressForContext } from "../compress-for-context";

function textResponse(text: string) {
  return { content: [{ type: "text", text }] };
}

describe("compressForContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the text unchanged, with no LLM call, when it already fits within the target size", async () => {
    const short = "A short chapter.\n\nJust two paragraphs.";

    const result = await compressForContext(short, 6000);

    expect(result).toBe(short);
    expect(createMessage).not.toHaveBeenCalled();
  });

  it("splits long text into paragraph-aligned chunks and compresses each in parallel", async () => {
    const para = "x".repeat(3000);
    const longText = [para, para, para].join("\n\n"); // ~9000 chars, over a 4000 target
    createMessage.mockResolvedValue(textResponse("compressed"));

    const result = await compressForContext(longText, 4000);

    expect(createMessage.mock.calls.length).toBeGreaterThan(1); // real chunking happened, not one giant call
    expect(result.split("\n\n").every(p => p === "compressed")).toBe(true);
  });

  it("never cuts mid-paragraph — each chunk boundary falls on a paragraph break", async () => {
    const paragraphs = Array.from({ length: 5 }, (_, i) => `Paragraph ${i}: ${"y".repeat(1000)}`);
    const longText = paragraphs.join("\n\n");
    createMessage.mockImplementation(async (params: any) => textResponse(params.messages[0].content));

    await compressForContext(longText, 2500);

    for (const call of createMessage.mock.calls) {
      const chunkSent = call[0].messages[0].content as string;
      // every chunk sent to the model must be composed of whole paragraphs from the original
      for (const part of chunkSent.split("\n\n")) {
        expect(paragraphs).toContain(part);
      }
    }
  });

  it("falls back to the original chunk text if the model returns an empty response", async () => {
    const para = "x".repeat(3000);
    const longText = [para, para].join("\n\n");
    createMessage.mockResolvedValue(textResponse(""));

    const result = await compressForContext(longText, 2000);

    expect(result).toContain(para);
  });
});
