import { describe, it, expect, vi, beforeEach } from "vitest";

const createMessage = vi.fn();
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { create: (...args: any[]) => createMessage(...args) } },
}));
vi.mock("@/lib/ai/engine", () => ({ MODELS: { default: "claude-sonnet-5", quality: "claude-opus-4-8" } }));

const { groundInWebResearch, isGroundableMode } = await import("../web-research");

describe("isGroundableMode", () => {
  it("returns true only for historical and scitech", () => {
    expect(isGroundableMode("historical")).toBe(true);
    expect(isGroundableMode("scitech")).toBe(true);
    expect(isGroundableMode("combat")).toBe(false);
    expect(isGroundableMode("write")).toBe(false);
  });
});

describe("groundInWebResearch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty string for a non-groundable mode without calling the model", async () => {
    const result = await groundInWebResearch("combat", "a fight scene");
    expect(result).toBe("");
    expect(createMessage).not.toHaveBeenCalled();
  });

  it("returns empty string for empty query text", async () => {
    const result = await groundInWebResearch("historical", "   ");
    expect(result).toBe("");
    expect(createMessage).not.toHaveBeenCalled();
  });

  it("calls the model with the web_search tool for a groundable mode", async () => {
    createMessage.mockResolvedValue({ content: [{ type: "text", text: "- fact one\n- fact two" }] });
    await groundInWebResearch("historical", "a scene set during the fall of Constantinople");
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.arrayContaining([expect.objectContaining({ name: "web_search" })]),
      }),
    );
  });

  it("wraps the result in a REAL-WORLD GROUNDING label", async () => {
    createMessage.mockResolvedValue({ content: [{ type: "text", text: "- fact one" }] });
    const result = await groundInWebResearch("scitech", "a scene about quantum entanglement");
    expect(result).toContain("REAL-WORLD GROUNDING");
    expect(result).toContain("fact one");
  });

  it("fails open (empty string) when the model call throws", async () => {
    createMessage.mockRejectedValue(new Error("529 overloaded"));
    const result = await groundInWebResearch("historical", "a scene set in ancient Rome");
    expect(result).toBe("");
  });

  it("fails open (empty string) when the model returns no text content", async () => {
    createMessage.mockResolvedValue({ content: [] });
    const result = await groundInWebResearch("historical", "a scene set in ancient Rome");
    expect(result).toBe("");
  });
});
