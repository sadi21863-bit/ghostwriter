import { describe, it, expect } from "vitest";
import { analyzeHumanize } from "@/lib/analysis/humanize";

describe("analyzeHumanize", () => {
  it("flags an assistant-voice opener", () => {
    const text = "Certainly! Here is the scene you requested, set in a quiet forest at dusk.";
    const report = analyzeHumanize(text);
    expect(report.flags.some((f) => f.label === "Assistant opener")).toBe(true);
    expect(report.score).toBeGreaterThan(0);
  });

  it("flags meta-commentary about writing the scene", () => {
    const text = "Let's dive into the scene. Maya walked through the door and looked around the room quietly, taking in every detail of the old house.";
    const report = analyzeHumanize(text);
    expect(report.flags.some((f) => f.label === "Meta-commentary")).toBe(true);
  });

  it("flags cutoff disclaimers", () => {
    const text = "The fight raged on through the night. To be continued in the next chapter.";
    const report = analyzeHumanize(text);
    expect(report.flags.some((f) => f.label === "Cutoff disclaimer")).toBe(true);
  });

  it("flags dense named-emotion-without-body", () => {
    const text = "She felt sad. He felt angry. They felt nervous. Everyone felt scared of what came next.";
    const report = analyzeHumanize(text);
    expect(report.flags.some((f) => f.label === "Named emotion, no body")).toBe(true);
  });

  it("does not flag a single incidental emotion word", () => {
    const text = "Marcus felt sad about the news, but he kept walking anyway, boots crunching over gravel toward the old house.";
    const report = analyzeHumanize(text);
    expect(report.flags.some((f) => f.label === "Named emotion, no body")).toBe(false);
  });

  it("flags copula-heavy formal AI constructions", () => {
    const text = "The old lighthouse serves as a reminder of the town's fishing past, and it stands as a testament to their resilience.";
    const report = analyzeHumanize(text);
    expect(report.flags.some((f) => f.label === "Formal AI construction")).toBe(true);
  });

  it("flags a generic wrap-up closing paragraph", () => {
    const text = "Rain fell on the empty street.\n\nIn the end, everyone learned something about themselves that day.";
    const report = analyzeHumanize(text);
    expect(report.flags.some((f) => f.label === "Generic closing wrap-up")).toBe(true);
  });

  it("scores well-written, grounded prose as clean", () => {
    const text = "Marcus set the cup down without a sound. Outside, the rain kept its own rhythm against the glass. He didn't look at her.";
    const report = analyzeHumanize(text);
    expect(report.score).toBe(0);
    expect(report.label).toBe("Clean");
  });

  it("handles empty input without throwing", () => {
    const report = analyzeHumanize("");
    expect(report.score).toBe(0);
    expect(report.flags).toEqual([]);
  });

  it("caps score at 100 and never goes negative", () => {
    const text = "Certainly! Let's dive into the scene. I hope this helps! To be continued. This powerful moment serves as a testament and plays a vital role and stands as a testament to everything. In the end, it all mattered.";
    const report = analyzeHumanize(text);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.label).toBe("Heavy AI tells");
  });
});
