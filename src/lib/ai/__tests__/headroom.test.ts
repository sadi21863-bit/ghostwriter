import { describe, it, expect } from "vitest";
import { compactContext, headroomSaved, packToBudget, TRIM_MARKER } from "../headroom";

describe("compactContext", () => {
  it("strips trailing whitespace and collapses internal double spaces", () => {
    expect(compactContext("Mara   is  here.   ")).toBe("Mara is here.");
  });

  it("collapses 3+ blank lines into a single blank line", () => {
    expect(compactContext("A\n\n\n\n\nB")).toBe("A\n\nB");
  });

  it("is lossless — never drops identical lines (two entities may share text)", () => {
    // Distinct characters can legitimately have identical descriptions; keep both.
    const input = "Mara wants to clear her name.\nKessler blocks her.\nMara wants to clear her name.";
    expect(compactContext(input)).toBe(input);
  });

  it("preserves every structural line and ordering", () => {
    const input = "PLOTS:\n- a\nPLOTS:\n- b";
    expect(compactContext(input)).toBe("PLOTS:\n- a\nPLOTS:\n- b");
  });

  it("trims leading and trailing blank lines", () => {
    expect(compactContext("\n\nReal content\n\n")).toBe("Real content");
  });

  it("is idempotent", () => {
    const messy = "A  B \n\n\n\nA  B \nC";
    const once = compactContext(messy);
    expect(compactContext(once)).toBe(once);
  });

  it("returns empty string for empty input", () => {
    expect(compactContext("")).toBe("");
  });
});

describe("headroomSaved", () => {
  it("reports a positive saving when there is redundancy to remove", () => {
    const text = "A long fact line about the world.\n\n\n\nA long fact line about the world.";
    const { before, after, saved } = headroomSaved(text);
    expect(saved).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
  });

  it("reports zero saving for already-compact text", () => {
    const text = "Tight line one.\nTight line two.";
    expect(headroomSaved(text).saved).toBe(0);
  });
});

describe("packToBudget", () => {
  const header = ["PROJECT: Demo"];
  const big = [Array.from({ length: 400 }, (_, i) => `big line ${i} ${"x".repeat(40)}`).join("\n")];
  const small = ["WORLD ELEMENTS:", "- The Ember Blade: a cold-fire sword"];

  it("keeps everything and adds no marker when it all fits", () => {
    const out = packToBudget([header, small], 10_000);
    expect(out).toContain("PROJECT: Demo");
    expect(out).toContain("The Ember Blade");
    expect(out).not.toContain(TRIM_MARKER);
  });

  it("always keeps the header even under a tiny budget", () => {
    const out = packToBudget([header, big], 1);
    expect(out).toContain("PROJECT: Demo");
    expect(out).toContain(TRIM_MARKER);
  });

  it("best-effort: skips an oversized section but still fits a smaller later one", () => {
    // Budget large enough for header+small but NOT for big. A stop-at-first-overflow
    // cutoff would drop `small` too; best-effort keeps it.
    const out = packToBudget([header, big, small], 60);
    expect(out).toContain("PROJECT: Demo");
    expect(out).toContain("The Ember Blade"); // survived despite `big` being skipped
    expect(out).not.toContain("big line 0");   // the oversized section was skipped
    expect(out).toContain(TRIM_MARKER);
  });

  it("is deterministic for identical input", () => {
    const a = packToBudget([header, big, small], 60);
    const b = packToBudget([header, big, small], 60);
    expect(a).toBe(b);
  });
});
