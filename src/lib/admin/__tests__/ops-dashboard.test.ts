import { describe, it, expect } from "vitest";
import { rankEventCounts, formatUsd, formatCompact } from "../ops-dashboard";

describe("rankEventCounts", () => {
  it("sorts events by count descending", () => {
    const ranked = rankEventCounts({ guide_clicked: 5, guide_dismissed: 20, share_created: 12 });
    expect(ranked).toEqual([
      { event: "guide_dismissed", count: 20 },
      { event: "share_created", count: 12 },
      { event: "guide_clicked", count: 5 },
    ]);
  });

  it("returns an empty array for an empty record", () => {
    expect(rankEventCounts({})).toEqual([]);
  });
});

describe("formatUsd", () => {
  it("formats with a dollar sign and 2 decimals", () => {
    expect(formatUsd(12.3456)).toBe("$12.35");
  });

  it("formats zero", () => {
    expect(formatUsd(0)).toBe("$0.00");
  });
});

describe("formatCompact", () => {
  it("leaves small numbers as-is", () => {
    expect(formatCompact(847)).toBe("847");
  });

  it("compacts thousands", () => {
    expect(formatCompact(12345)).toBe("12.3k");
  });

  it("compacts millions", () => {
    expect(formatCompact(2_500_000)).toBe("2.5M");
  });
});
