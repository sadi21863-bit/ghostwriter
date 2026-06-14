import { describe, it, expect } from "vitest";
import { classifyBeat, LIBRARY_MODES } from "@/lib/modes/classify";

describe("LIBRARY_MODES", () => {
  it("has exactly 23 modes, excluding brainstorm/outline/write", () => {
    expect(LIBRARY_MODES).toHaveLength(23);
    expect(LIBRARY_MODES).not.toContain("brainstorm");
    expect(LIBRARY_MODES).not.toContain("outline");
    expect(LIBRARY_MODES).not.toContain("write");
  });
});

describe("classifyBeat", () => {
  it("detects a combat beat", () => {
    expect(classifyBeat("He drew his sword and lunged across the field")).toBe("combat");
  });

  it("detects an emotional beat", () => {
    expect(classifyBeat("She broke down in tears, utterly devastated")).toBe("emotional");
  });

  it("returns null for empty text", () => {
    expect(classifyBeat("")).toBeNull();
    expect(classifyBeat("   ")).toBeNull();
  });

  it("returns null when no candidate keywords match", () => {
    expect(classifyBeat("Just a normal quiet morning, nothing much happening")).toBeNull();
  });

  it("picks the candidate with more keyword matches, restricted to given candidates", () => {
    const text = "Their conversation turned into a heated argument";
    expect(classifyBeat(text, ["dialogue", "tension"])).toBe("dialogue");
  });

  it("does not match partial words", () => {
    expect(classifyBeat("She was crying", ["emotional"])).toBe(null);
  });
});
