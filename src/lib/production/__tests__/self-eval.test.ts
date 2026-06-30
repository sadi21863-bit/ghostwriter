import { describe, it, expect } from "vitest";
import { scoreShot, nextLoopAction, retryHint, EVAL_DIMENSIONS, EVAL_WEIGHTS } from "../self-eval";
import { enforceBudgetCap } from "@/lib/capabilities/cost";

describe("EVAL_WEIGHTS", () => {
  it("covers 7 dimensions that sum to 1", () => {
    expect(EVAL_DIMENSIONS).toHaveLength(7);
    const sum = EVAL_DIMENSIONS.reduce((s, k) => s + EVAL_WEIGHTS[k], 0);
    expect(sum).toBeCloseTo(1, 5);
  });
});

describe("scoreShot", () => {
  it("computes a weighted overall and clamps to 0..1", () => {
    const s = scoreShot({ promptAdherence: 1, characterConsistency: 1, continuity: 1, technicalQuality: 1, pacing: 1, coverage: 1, aesthetics: 1 });
    expect(s.overall).toBeCloseTo(1, 5);
  });
  it("identifies the weakest dimension (drives the retry hint)", () => {
    const s = scoreShot({ promptAdherence: 0.9, characterConsistency: 0.2, continuity: 0.8, technicalQuality: 0.8, pacing: 0.8, coverage: 0.8, aesthetics: 0.8 });
    expect(s.weakest).toBe("characterConsistency");
  });
  it("treats missing dimensions as 0", () => {
    const s = scoreShot({ promptAdherence: 1 });
    expect(s.overall).toBeCloseTo(EVAL_WEIGHTS.promptAdherence, 5);
  });
});

describe("nextLoopAction", () => {
  const good = scoreShot({ promptAdherence: 1, characterConsistency: 1, continuity: 1, technicalQuality: 1, pacing: 1, coverage: 1, aesthetics: 1 });
  const bad = scoreShot({ promptAdherence: 0.2 });

  it("accepts when overall meets the threshold", () => {
    expect(nextLoopAction(good, 1, { threshold: 0.7, maxAttempts: 2 })).toBe("accept");
  });
  it("retries a poor result while attempts remain", () => {
    expect(nextLoopAction(bad, 1, { threshold: 0.7, maxAttempts: 2 })).toBe("retry");
  });
  it("stops a poor result once the attempt budget is spent", () => {
    expect(nextLoopAction(bad, 2, { threshold: 0.7, maxAttempts: 2 })).toBe("stop");
  });
});

describe("retryHint", () => {
  it("returns a targeted instruction for the weakest dimension", () => {
    const s = scoreShot({ promptAdherence: 0.9, characterConsistency: 0.1, continuity: 0.9, technicalQuality: 0.9, pacing: 0.9, coverage: 0.9, aesthetics: 0.9 });
    expect(retryHint(s).toLowerCase()).toContain("character reference");
  });
});

describe("enforceBudgetCap", () => {
  it("allows any run when no cap is set", () => {
    expect(enforceBudgetCap(100, undefined).allowed).toBe(true);
    expect(enforceBudgetCap(100, 0).allowed).toBe(true);
  });
  it("blocks a run that exceeds the cap, with a reason", () => {
    const d = enforceBudgetCap(2.5, 1.5);
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain("2.50");
    expect(d.reason).toContain("1.50");
  });
  it("allows a run within the cap", () => {
    expect(enforceBudgetCap(1.0, 1.5).allowed).toBe(true);
  });
});
