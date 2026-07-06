import { describe, it, expect, vi } from "vitest";
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";
import { FORMATS } from "@/lib/formats";

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(function () {
    return { messages: { create: vi.fn() } };
  }),
}));

vi.mock("@/lib/semantic-cache", () => ({
  checkSemanticCache: vi.fn(),
  writeSemanticCache: vi.fn(),
}));

const mockCreate = vi.fn();
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { create: (...args: any[]) => mockCreate(...args) } },
}));

const { getCraftDirectives, getFormatRules, WRITE_CRAFT_DIRECTIVES, refinePassage, ARTIFACT_VS_PERSONA_RULE } = await import("@/lib/ai/engine");

describe("getCraftDirectives", () => {
  it("includes WRITE_CRAFT_DIRECTIVES content for story formats with character cards", () => {
    expect(getCraftDirectives("Novel")).toContain("CHARACTER EMBODIMENT RULES");
    expect(getCraftDirectives("Screenplay")).toContain(WRITE_CRAFT_DIRECTIVES.trim());
    expect(getCraftDirectives("Web Series")).toContain("Contradiction must never resolve cleanly");
  });

  it("returns an empty string for creator formats (no character cards)", () => {
    expect(getCraftDirectives("YouTube Long-form")).toBe("");
    expect(getCraftDirectives("YouTube Short")).toBe("");
    expect(getCraftDirectives("TikTok Script")).toBe("");
    expect(getCraftDirectives("Instagram Reel")).toBe("");
    expect(getCraftDirectives("Podcast Episode")).toBe("");
    expect(getCraftDirectives("Podcast Episode (Co-host)")).toBe("");
  });

  it("returns an empty string for unrecognized formats", () => {
    expect(getCraftDirectives("Some Custom Format")).toBe("");
  });
});

describe("getFormatRules", () => {
  it("returns non-empty, format-specific rules for every format in FORMATS", () => {
    for (const format of FORMATS) {
      const rules = getFormatRules(format);
      expect(rules.length, `getFormatRules("${format}") should not be empty`).toBeGreaterThan(0);
      expect(rules).toContain("FORMAT");
    }
  });

  it("returns an empty string for unrecognized formats", () => {
    expect(getFormatRules("Some Custom Format")).toBe("");
  });
});

describe("MI", () => {
  it("has a system-prompt function for every mode in MODE_REGISTRY", async () => {
    const { MI } = await import("@/lib/ai/engine");
    for (const mode of Object.keys(MODE_REGISTRY) as GenerationMode[]) {
      expect(typeof MI[mode]).toBe("function");
      expect(MI[mode]("Novel")).toBeTypeOf("string");
      expect(MI[mode]("Novel").length).toBeGreaterThan(0);
    }
  });
});

function mockAnthropicResponse(text: string) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: "text", text }],
    usage: { input_tokens: 100, output_tokens: 200 },
  });
}

describe("refinePassage — contradiction-flag delimiter parsing", () => {
  it("returns an empty contradictionFlags array when the model finds nothing (delimiter present, nothing after it)", async () => {
    mockAnthropicResponse("Revised prose here.\n<<<CONTRADICTION_FLAGS>>>");
    const result = await refinePassage("original text", "Novel");
    expect(result.text).toBe("Revised prose here.");
    expect(result.contradictionFlags).toEqual([]);
  });

  it("parses one or more flagged contradictions out of the delimiter block", async () => {
    mockAnthropicResponse(
      "Revised prose here.\n<<<CONTRADICTION_FLAGS>>>\nCharacter has blue eyes — established as green in chapter 1\nSays this is her first visit — she was here in chapter 2"
    );
    const result = await refinePassage("original text", "Novel");
    expect(result.text).toBe("Revised prose here.");
    expect(result.contradictionFlags).toEqual([
      "Character has blue eyes — established as green in chapter 1",
      "Says this is her first visit — she was here in chapter 2",
    ]);
  });

  it("returns the full raw text and no flags when the model omits the delimiter entirely", async () => {
    mockAnthropicResponse("Just the revised prose, no delimiter.");
    const result = await refinePassage("original text", "Novel");
    expect(result.text).toBe("Just the revised prose, no delimiter.");
    expect(result.contradictionFlags).toEqual([]);
  });
});

describe("generate — artifact-vs-persona rule", () => {
  it("includes ARTIFACT_VS_PERSONA_RULE in the system prompt sent to the model", async () => {
    mockAnthropicResponse("Some generated prose.");
    const { generate } = await import("@/lib/ai/engine");
    await generate({ mode: "write", prompt: "Write a scene", format: "Novel" });
    const callArgs = mockCreate.mock.calls[mockCreate.mock.calls.length - 1][0];
    const systemText = Array.isArray(callArgs.system) ? callArgs.system.map((b: any) => b.text).join("\n") : callArgs.system;
    expect(systemText).toContain(ARTIFACT_VS_PERSONA_RULE);
  });
});
