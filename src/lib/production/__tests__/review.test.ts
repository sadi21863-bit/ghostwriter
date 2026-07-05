import { describe, it, expect } from "vitest";
import { qualityScoreColor, formatWeakestDimension, REVIEW_STATUS_LABEL } from "../review";

describe("qualityScoreColor", () => {
  it("returns null when not yet scored", () => {
    expect(qualityScoreColor(null)).toBeNull();
    expect(qualityScoreColor(undefined)).toBeNull();
  });
  it("returns green at/above 0.7", () => {
    expect(qualityScoreColor(0.7)).toBe("#22c55e");
    expect(qualityScoreColor(1)).toBe("#22c55e");
  });
  it("returns amber between 0.4 and 0.7", () => {
    expect(qualityScoreColor(0.4)).toBe("#f59e0b");
    expect(qualityScoreColor(0.69)).toBe("#f59e0b");
  });
  it("returns red below 0.4", () => {
    expect(qualityScoreColor(0)).toBe("#ef4444");
    expect(qualityScoreColor(0.39)).toBe("#ef4444");
  });
});

describe("formatWeakestDimension", () => {
  it("returns null for empty input", () => {
    expect(formatWeakestDimension(null)).toBeNull();
    expect(formatWeakestDimension("")).toBeNull();
  });
  it("humanizes a camelCase dimension key", () => {
    expect(formatWeakestDimension("characterConsistency")).toBe("Character Consistency");
    expect(formatWeakestDimension("promptAdherence")).toBe("Prompt Adherence");
  });
  it("leaves a single-word dimension capitalized", () => {
    expect(formatWeakestDimension("continuity")).toBe("Continuity");
  });
});

describe("REVIEW_STATUS_LABEL", () => {
  it("covers all three review states", () => {
    expect(REVIEW_STATUS_LABEL.draft).toBe("Draft");
    expect(REVIEW_STATUS_LABEL.approved).toBe("Approved");
    expect(REVIEW_STATUS_LABEL.needs_rework).toBe("Needs Rework");
  });
});
