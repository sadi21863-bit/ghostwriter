import { describe, it, expect } from "vitest";
import { summarizeBetaPanel } from "@/lib/editor/beta-reader-summary";

describe("summarizeBetaPanel", () => {
  it("summarizes an all-continue panel", () => {
    const result = summarizeBetaPanel([
      { persona: "a", verdict: "would_continue" },
      { persona: "b", verdict: "would_continue" },
      { persona: "c", verdict: "would_continue" },
    ]);
    expect(result).toEqual({
      continueCount: 3, mightStopCount: 0, dnfCount: 0,
      headline: "3 of 3 readers would keep going.",
    });
  });

  it("summarizes a mixed panel, prioritizing DNF in the headline", () => {
    const result = summarizeBetaPanel([
      { persona: "a", verdict: "would_continue" },
      { persona: "b", verdict: "might_stop" },
      { persona: "c", verdict: "would_dnf" },
    ]);
    expect(result).toEqual({
      continueCount: 1, mightStopCount: 1, dnfCount: 1,
      headline: "1 of 3 readers flagged a likely DNF point.",
    });
  });

  it("summarizes an all-DNF panel", () => {
    const result = summarizeBetaPanel([
      { persona: "a", verdict: "would_dnf" },
      { persona: "b", verdict: "would_dnf" },
    ]);
    expect(result).toEqual({
      continueCount: 0, mightStopCount: 0, dnfCount: 2,
      headline: "2 of 2 readers flagged a likely DNF point.",
    });
  });

  it("prioritizes might_stop over continue when there's no DNF", () => {
    const result = summarizeBetaPanel([
      { persona: "a", verdict: "would_continue" },
      { persona: "b", verdict: "might_stop" },
    ]);
    expect(result.headline).toBe("1 of 2 readers might stop reading here.");
  });

  it("handles a single-reader panel with correct singular grammar", () => {
    const result = summarizeBetaPanel([{ persona: "a", verdict: "would_dnf" }]);
    expect(result.headline).toBe("1 of 1 reader flagged a likely DNF point.");
  });

  it("handles an empty array edge case", () => {
    expect(summarizeBetaPanel([])).toEqual({
      continueCount: 0, mightStopCount: 0, dnfCount: 0,
      headline: "No reader responses to summarize.",
    });
  });
});
