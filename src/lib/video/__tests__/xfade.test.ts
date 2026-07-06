import { describe, it, expect } from "vitest";
import { buildXfadeFilterComplex } from "../xfade";

describe("buildXfadeFilterComplex", () => {
  it("chains a single xfade for 2 clips, offset = first duration minus transition", () => {
    const result = buildXfadeFilterComplex([5, 5], 0.5);
    expect(result.finalLabel).toBe("vout");
    expect(result.filterComplex).toBe("[0:v][1:v]xfade=transition=fade:duration=0.5:offset=4.500[vout]");
  });

  it("chains 2 transitions for 3 clips, shrinking the running total by the transition each time", () => {
    const result = buildXfadeFilterComplex([5, 5, 5], 0.5);
    // step 1: offset = 5 - 0.5 = 4.5, cumulative becomes 5 + 5 - 0.5 = 9.5
    // step 2 (final): offset = 9.5 - 0.5 = 9.0
    expect(result.filterComplex).toBe(
      "[0:v][1:v]xfade=transition=fade:duration=0.5:offset=4.500[v1];" +
      "[v1][2:v]xfade=transition=fade:duration=0.5:offset=9.000[vout]"
    );
  });

  it("handles uneven clip durations correctly", () => {
    const result = buildXfadeFilterComplex([10, 3, 6], 1);
    // step 1: offset = 10 - 1 = 9, cumulative = 10 + 3 - 1 = 12
    // step 2 (final): offset = 12 - 1 = 11
    expect(result.filterComplex).toBe(
      "[0:v][1:v]xfade=transition=fade:duration=1:offset=9.000[v1];" +
      "[v1][2:v]xfade=transition=fade:duration=1:offset=11.000[vout]"
    );
  });

  it("clamps the transition duration down when a clip is too short for the requested transition", () => {
    // shortest clip is 1s; an unclamped 0.5s transition would be fine here,
    // but a clip of 1s with a requested 2s transition must be clamped to
    // at most 40% of the shortest clip (0.4s) to avoid a negative offset.
    const result = buildXfadeFilterComplex([1, 5], 2);
    expect(result.filterComplex).toBe("[0:v][1:v]xfade=transition=fade:duration=0.4:offset=0.600[vout]");
  });

  it("throws when fewer than 2 durations are given", () => {
    expect(() => buildXfadeFilterComplex([5], 0.5)).toThrow(/at least 2/);
    expect(() => buildXfadeFilterComplex([], 0.5)).toThrow(/at least 2/);
  });
});
