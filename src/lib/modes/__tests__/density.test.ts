import { describe, it, expect } from "vitest";
import { normalizeDensity, densityRank, isModeVisibleAtDensity, DENSITY_LEVELS, DENSITY_META } from "../density";

describe("normalizeDensity", () => {
  it("passes through valid levels", () => {
    expect(normalizeDensity("simple")).toBe("simple");
    expect(normalizeDensity("full")).toBe("full");
  });
  it("coerces null/garbage to standard", () => {
    for (const v of [null, undefined, "", "huge"]) expect(normalizeDensity(v as any)).toBe("standard");
  });
});

describe("densityRank", () => {
  it("orders simple < standard < full", () => {
    expect(densityRank("simple")).toBeLessThan(densityRank("standard"));
    expect(densityRank("standard")).toBeLessThan(densityRank("full"));
  });
});

describe("isModeVisibleAtDensity", () => {
  it("a mode with no floor is always visible", () => {
    expect(isModeVisibleAtDensity(undefined, "simple")).toBe(true);
    expect(isModeVisibleAtDensity(null, "simple")).toBe(true);
  });
  it("a full-only mode hides at simple/standard, shows at full", () => {
    expect(isModeVisibleAtDensity("full", "simple")).toBe(false);
    expect(isModeVisibleAtDensity("full", "standard")).toBe(false);
    expect(isModeVisibleAtDensity("full", "full")).toBe(true);
  });
  it("a standard-floor mode shows at standard and full, hides at simple", () => {
    expect(isModeVisibleAtDensity("standard", "simple")).toBe(false);
    expect(isModeVisibleAtDensity("standard", "standard")).toBe(true);
    expect(isModeVisibleAtDensity("standard", "full")).toBe(true);
  });
});

describe("density metadata", () => {
  it("every level has a label + description", () => {
    for (const lvl of DENSITY_LEVELS) {
      expect(DENSITY_META[lvl].label).toBeTruthy();
      expect(DENSITY_META[lvl].description).toBeTruthy();
    }
  });
});
