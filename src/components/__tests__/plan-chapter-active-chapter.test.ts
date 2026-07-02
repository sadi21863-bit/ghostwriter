import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("plan_chapter Guide branch switches the active chapter", () => {
  it("GhostWriterApp's plan_chapter branch updates project.activeChapter, matching the draft-rung branch", () => {
    // Regression guard: without this, "Draft this chapter →" in ChapterPlanPanel
    // generates into whatever chapter was already active, not the one that was
    // just planned — the same bug class as CLAUDE.md's "AI wrote everything into
    // one chapter" history. The fix is to switch activeChapter as soon as the
    // plan_chapter branch fires, exactly like the write-mode branch below it does.
    const src = readFileSync(join(__dirname, "..", "GhostWriterApp.tsx"), "utf-8");
    const branchStart = src.indexOf('runMode === "plan_chapter"');
    expect(branchStart).toBeGreaterThan(-1);

    // End the slice at the very next statement after the plan_chapter if-block
    // closes (setMode(runMode), the start of the fallback write-mode path) —
    // NOT at the more distant "if (resolveInitiative" marker used by an earlier
    // version of this test, which also swept in the sibling draft-mode branch's
    // OWN identical "activeChapter: runChapterId" line and made the assertion
    // pass whether or not the plan_chapter branch itself had the fix.
    const nextStatementStart = src.indexOf("setMode(runMode)", branchStart);
    const branchBlock = src.slice(branchStart, nextStatementStart);

    expect(branchBlock).toContain("activeChapter: runChapterId");
  });
});
