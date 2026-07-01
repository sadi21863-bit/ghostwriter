// Guards against the exact failure mode found repeatedly during the 2026-06-17/18
// port audits: a fully-built feature component with zero imports anywhere in the
// live render path, silently unreachable for real users (e.g. SprintMode, ArcHeatMap/
// TensionCurve/ConstellationView before they were wired into StoryInsightsPanel).
//
// This is a static source-text check, not a real render test — it can't model
// every indirection (e.g. "is this inside an `if (writingRoomEnabled)` branch"),
// but it catches the case that actually happened multiple times: a component
// that's imported NOWHERE in the files that make up the live shell.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const COMPONENTS_DIR = join(__dirname, "..");

// Every file that's part of the live (writingRoomShell-on) render path, directly
// or via the Actions-drawer/ToolbarPanel indirection that GhostWriterApp wires up
// regardless of which shell is active.
const LIVE_SHELL_FILES = [
  "GhostWriterApp.tsx",
  "WritingRoom.tsx",
  "StoryInsightsPanel.tsx",
  "stages/IdeaStageView.tsx",
  "stages/StructureStageView.tsx",
  "stages/PolishStageView.tsx",
  "stages/ExportStageView.tsx",
  "panels/ToolbarPanel.tsx",
  "ProductionStudio.tsx",
];

// Maintained list: feature components that must be reachable from a live user.
// If you build a new top-level feature component and it's not in this list,
// add it here once it's wired in — that's what makes this test catch the next one.
const MUST_BE_REACHABLE = [
  "StageRoleRail",
  "BeatSheetPanel",
  "EditorNotesPanel",
  "ProductionPipelineBar",
  "InspirationLibrary",
  "AudioNovelPanel",
  "SprintMode",
  "StoryInsightsPanel",
  "ArcHeatMap",
  "TensionCurve",
  "ConstellationView",
  "StoryBible",
  "ComicStudio",
  "ProductionStudio",
  "GuideBar",
  "EntitySuggestionsChip",
  "ChapterPlanPanel",
];

describe("live shell reachability", () => {
  const combinedSource = LIVE_SHELL_FILES
    .map((f) => readFileSync(join(COMPONENTS_DIR, f), "utf-8"))
    .join("\n");

  it.each(MUST_BE_REACHABLE)("%s is imported somewhere in the live shell's file tree", (name) => {
    // Static `import { X } from "..."` / `import X from "..."`
    const staticImport = new RegExp(`import[^;]*\\b${name}\\b[^;]*from`).test(combinedSource);
    // Dynamic `import("@/components/X")`, including the `dynamic(() => import(...))` pattern
    const dynamicImport = new RegExp(`import\\(['"][^'"]*${name}[^'"]*['"]\\)`).test(combinedSource);
    expect(staticImport || dynamicImport, `${name} is not imported (static or dynamic) by any of: ${LIVE_SHELL_FILES.join(", ")}`).toBe(true);
  });
});

// Regression guard for the 2026-06-29 dual-shell consolidation: there is now ONE
// render path (WritingRoom). The legacy toolbar-driven shell, its feature flag, and
// the legacy editor must stay deleted — if any of these reappears, the dual-shell
// debt is back. (This is the "don't resurrect the old shell" guard.)
describe("legacy shell stays deleted", () => {
  const appSource = readFileSync(join(COMPONENTS_DIR, "GhostWriterApp.tsx"), "utf-8");

  it("GhostWriterApp no longer branches on a writingRoomEnabled flag", () => {
    expect(appSource).not.toMatch(/writingRoomEnabled/);
    expect(appSource).not.toMatch(/FLAGS\.writingRoomShell/);
  });

  it("GhostWriterApp no longer imports the legacy panels/ChapterEditor", () => {
    expect(appSource).not.toMatch(/from ["']@\/components\/panels\/ChapterEditor["']/);
  });

  it("the legacy panels/ChapterEditor.tsx file is gone", () => {
    const legacyEditor = join(COMPONENTS_DIR, "panels/ChapterEditor.tsx");
    expect(existsSync(legacyEditor)).toBe(false);
  });

  it("the writingRoomShell flag is removed from the FLAGS registry", () => {
    const flagsSource = readFileSync(join(COMPONENTS_DIR, "../lib/growthbook.ts"), "utf-8");
    expect(flagsSource).not.toMatch(/writingRoomShell/);
    expect(flagsSource).not.toMatch(/writing_room_shell/);
  });
});
