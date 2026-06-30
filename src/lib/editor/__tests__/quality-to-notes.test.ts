import { describe, it, expect } from "vitest";
import { qualityCheckToNotes } from "../quality-to-notes";

describe("qualityCheckToNotes", () => {
  it("maps rule violations to high/medium issue notes tagged quality_check", () => {
    const notes = qualityCheckToNotes({
      ruleViolations: [{ rule: "No modern slang", violation: "'cool' appears in a medieval scene", severity: "high" }],
    });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ type: "issue", severity: "high", category: "rule", source: "quality_check" });
    expect(notes[0].message).toContain("No modern slang");
  });

  it("maps knowledge violations to high-severity continuity notes", () => {
    const notes = qualityCheckToNotes({
      knowledgeViolations: [{ character: "Mara", state: "IGNORANT", entity: "the betrayal", violation: "she references it" }],
    });
    expect(notes[0]).toMatchObject({ type: "issue", severity: "high", category: "continuity" });
    expect(notes[0].message).toContain("Mara");
  });

  it("maps slop markers to low-severity prose suggestions with a fix", () => {
    const notes = qualityCheckToNotes({
      slopMarkers: [{ type: "cliche", text: "heart raced", suggestion: "show the physical reaction" }],
    });
    expect(notes[0]).toMatchObject({ type: "suggestion", severity: "low", category: "prose", suggestedFix: "show the physical reaction" });
    expect(notes[0].message).toContain("heart raced");
  });

  it("maps POV breaks", () => {
    const notes = qualityCheckToNotes({ povBreaks: [{ issue: "head-hops to Kessler" }] });
    expect(notes[0]).toMatchObject({ category: "pov", type: "issue" });
  });

  it("drops entries with no message and defaults severity to medium", () => {
    const notes = qualityCheckToNotes({
      ruleViolations: [{ rule: "X" /* no violation */ }, { violation: "real one" }],
    });
    expect(notes).toHaveLength(1);
    expect(notes[0].severity).toBe("medium");
  });

  it("returns [] for an empty result", () => {
    expect(qualityCheckToNotes({})).toEqual([]);
  });
});
