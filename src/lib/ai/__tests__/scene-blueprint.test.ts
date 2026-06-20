import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(function () {
    return { messages: { create: (...args: any[]) => create(...args) } };
  }),
}));

const { buildSceneBlueprint } = await import("@/lib/ai/scene-blueprint");

describe("buildSceneBlueprint", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a labeled blueprint wrapped with injection instructions on success", async () => {
    create.mockResolvedValue({
      content: [{ type: "text", text: "GOAL: escape\nOBSTACLE: locked door\nTURN: finds key\nCHANGE: free\nSENSORY: cold, dark, echo\nEXIT: decision" }],
    });
    const result = await buildSceneBlueprint({ prompt: "next scene", format: "Novel" });
    expect(result).toContain("SCENE BLUEPRINT");
    expect(result).toContain("Vary paragraph length");
    expect(result).toContain("GOAL: escape");
  });

  it("fails open (returns empty string) when the model call throws", async () => {
    create.mockRejectedValue(new Error("API down"));
    const result = await buildSceneBlueprint({ prompt: "next scene", format: "Novel" });
    expect(result).toBe("");
  });

  it("fails open when the model returns a too-short response", async () => {
    create.mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
    const result = await buildSceneBlueprint({ prompt: "next scene", format: "Novel" });
    expect(result).toBe("");
  });
});
