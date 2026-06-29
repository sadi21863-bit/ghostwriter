import { describe, it, expect } from "vitest";
import { chapterApprovalSummary } from "../approval";

describe("chapterApprovalSummary", () => {
  it("counts approved vs total and lists unapproved titles", () => {
    const r = chapterApprovalSummary([
      { title: "One", reviewStatus: "approved" },
      { title: "Two", reviewStatus: "draft" },
      { title: "Three", reviewStatus: "in_review" },
    ]);
    expect(r.total).toBe(3);
    expect(r.approved).toBe(1);
    expect(r.unapproved).toEqual(["Two", "Three"]);
    expect(r.allApproved).toBe(false);
  });

  it("treats a missing reviewStatus as draft (unapproved)", () => {
    const r = chapterApprovalSummary([{ title: "X" } as any]);
    expect(r.approved).toBe(0);
    expect(r.unapproved).toEqual(["X"]);
  });

  it("allApproved is true only when every chapter is approved (and there is at least one)", () => {
    expect(chapterApprovalSummary([{ title: "A", reviewStatus: "approved" }]).allApproved).toBe(true);
    expect(chapterApprovalSummary([]).allApproved).toBe(false);
  });
});
