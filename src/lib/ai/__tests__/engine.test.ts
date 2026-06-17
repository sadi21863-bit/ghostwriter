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

const { getCraftDirectives, getFormatRules, WRITE_CRAFT_DIRECTIVES } = await import("@/lib/ai/engine");

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
