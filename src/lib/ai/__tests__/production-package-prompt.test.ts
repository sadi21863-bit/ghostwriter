import { describe, it, expect } from "vitest";
import { PRODUCTION_PACKAGE_SYSTEM_PROMPT } from "../prompts";

describe("PRODUCTION_PACKAGE_SYSTEM_PROMPT", () => {
  it("instructs cross-shot continuity checking", () => {
    expect(PRODUCTION_PACKAGE_SYSTEM_PROMPT.toLowerCase()).toContain("continuity");
  });

  it("instructs writing a combined multi-shot script using Shot N: directives", () => {
    expect(PRODUCTION_PACKAGE_SYSTEM_PROMPT).toContain("multiShotScript");
    expect(PRODUCTION_PACKAGE_SYSTEM_PROMPT).toContain("Shot N:");
  });

  it("instructs the @image1-style reference tag and identity-weight pattern", () => {
    expect(PRODUCTION_PACKAGE_SYSTEM_PROMPT).toContain("@image1");
    expect(PRODUCTION_PACKAGE_SYSTEM_PROMPT.toLowerCase()).toContain("weight");
  });
});
