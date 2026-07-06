import { describe, it, expect } from "vitest";
import { buildAiismsInstruction, FICTION_AIISMS, STRUCTURAL_AIISMS } from "@/lib/ai/aiisms";

describe("buildAiismsInstruction", () => {
  it("surfaces every entry in FICTION_AIISMS, not just a truncated slice", () => {
    const instruction = buildAiismsInstruction();
    for (const phrase of FICTION_AIISMS) {
      expect(instruction).toContain(phrase);
    }
  });

  it("uses an active self-scan framing, not a passive after-the-fact check", () => {
    const instruction = buildAiismsInstruction();
    expect(instruction).toMatch(/before finalizing/i);
    expect(instruction).toMatch(/scan/i);
  });

  it("includes the structural echo and double-statement rules", () => {
    const instruction = buildAiismsInstruction();
    expect(instruction).toContain("ECHO");
    expect(instruction).toContain("DOUBLE-STATEMENT");
    for (const rule of STRUCTURAL_AIISMS) {
      expect(instruction).toContain(rule.detail);
    }
  });
});
