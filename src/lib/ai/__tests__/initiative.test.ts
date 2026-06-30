import { describe, it, expect } from "vitest";
import { resolveInitiative, AI_INITIATIVES } from "../initiative";

describe("resolveInitiative", () => {
  it("Leads auto-fires and keeps the guide visible", () => {
    const b = resolveInitiative("Leads");
    expect(b.mode).toBe("Leads");
    expect(b.autoFires).toBe(true);
    expect(b.hidesGuide).toBe(false);
  });

  it("Assists hides the guide and never auto-fires", () => {
    const b = resolveInitiative("Assists");
    expect(b.mode).toBe("Assists");
    expect(b.autoFires).toBe(false);
    expect(b.hidesGuide).toBe(true);
  });

  it("defaults null/undefined/garbage to Collaborates", () => {
    for (const v of [null, undefined, "", "Bananas"]) {
      const b = resolveInitiative(v as any);
      expect(b.mode).toBe("Collaborates");
      expect(b.autoFires).toBe(false);
      expect(b.hidesGuide).toBe(false);
    }
  });

  it("every initiative has a label and description", () => {
    for (const m of AI_INITIATIVES) {
      const b = resolveInitiative(m);
      expect(b.label).toBeTruthy();
      expect(b.description).toBeTruthy();
    }
  });
});
