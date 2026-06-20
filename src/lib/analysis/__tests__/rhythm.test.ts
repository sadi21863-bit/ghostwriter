import { describe, it, expect } from "vitest";
import { analyzeProseRhythm } from "@/lib/analysis/rhythm";

describe("analyzeProseRhythm", () => {
  it("flags monotonous rhythm when many consecutive sentences are near-identical length", () => {
    const sentence = "The dog ran fast across the field today.";
    const text = Array(7).fill(sentence).join(" ");
    const report = analyzeProseRhythm(text);
    expect(report.flags.some((f) => f.label === "Monotonous rhythm")).toBe(true);
  });

  it("flags repeated sentence openers", () => {
    const text = Array(6).fill("Suddenly the door creaked open in the dark hallway.").join(" ");
    const report = analyzeProseRhythm(text);
    expect(report.flags.some((f) => f.label === "Repeated openers")).toBe(true);
  });

  it("flags adverb spray when -ly adverbs are dense", () => {
    const text = "She quickly and quietly and carefully and silently and slowly walked across the room nervously.";
    const report = analyzeProseRhythm(text);
    expect(report.flags.some((f) => f.label === "Adverb spray")).toBe(true);
  });

  it("does not flag well-varied prose", () => {
    const text = "Rain hit the window. Marcus didn't move. Three years of silence had taught him patience he never wanted, the kind that settles into bone and stays. He waited.";
    const report = analyzeProseRhythm(text);
    expect(report.flags.some((f) => f.label === "Monotonous rhythm")).toBe(false);
  });

  it("handles empty input without throwing", () => {
    const report = analyzeProseRhythm("");
    expect(report.sentenceCount).toBe(0);
    expect(report.flags).toEqual([]);
  });
});
