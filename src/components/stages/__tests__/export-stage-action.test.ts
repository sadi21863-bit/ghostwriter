// Regression test for the launch-blocking export-routing bug (2026-06-20):
// ExportStageView's "Open Export →" button used to compute its action via
// nextAction({...}) — the same ladder-driven suggestion engine the GuideBar
// uses — falling back to a literal export action only when the ladder
// returned null. Since the ladder almost always has SOME earlier suggestion
// to make (an under-threshold chapter, an undismissed story-health check),
// clicking the button routed to whatever that suggestion was instead of
// opening export: Story Health, a different chapter, or nothing at all.
//
// The fix makes the button's action a fixed constant, never derived from
// project state. This is a static source-text check (matches the existing
// live-shell-reachability.test.ts convention — no RTL/jsdom in this repo)
// that guards against the dynamic-action pattern creeping back in.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = readFileSync(join(__dirname, "..", "ExportStageView.tsx"), "utf-8");

describe("ExportStageView export action", () => {
  it("does not import the nextAction ladder function", () => {
    // Only the GuideAction type should be imported from next-action — never
    // the nextAction() function itself, which would let the button's
    // behavior depend on project state again.
    expect(/import\s*\{[^}]*\bnextAction\b[^}]*\}\s*from\s*["']@\/lib\/guide\/next-action["']/.test(SOURCE)).toBe(false);
  });

  it("wires the Open Export button to a fixed action, not a computed one", () => {
    expect(SOURCE).toContain('onClick={() => onGuideRun(EXPORT_ACTION)}');
  });

  it("defines EXPORT_ACTION as a module-level constant with run.mode export", () => {
    expect(/const EXPORT_ACTION:\s*GuideAction\s*=\s*\{[^]*?run:\s*\{\s*mode:\s*"export"\s*\}/.test(SOURCE)).toBe(true);
  });
});
