# Redesign Phase 2 Plan 1 of 2: Writing Room Shell Implementation Plan

**Status: COMPLETE (2026-06-12)** — all tasks implemented, vitest (12/12) and `npm run build` both green.

> **For agentic workers:** Execute inline task-by-task (no subagent dispatch for this plan — matches the pattern used for Phase 0/1). Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build the new "Writing Room" screen — a flag-gated replacement for the current toolbar+editor+world-bible layout that follows `ghostwriter-redesign.md`'s "One Path" design: a header with project name/format/chapter position/stage progress, the existing TipTap editor full-width, a collapsible read-only "Bible" glance rail, and a footer with an `Actions` button (slide-over containing the existing `ToolbarPanel`, for full feature parity) and a primary `Write` button. Ship it behind the `writingRoomShell` GrowthBook flag so the current `GhostWriterApp` layout remains the default until parity is confirmed (per spec §7: "Do NOT ship Phase 2 without the GrowthBook flag — the owner must be able to flip back").

**Architecture:** A new pure-presentational `src/components/WritingRoom.tsx` (~120 lines) receives `project`, `activeChap`, `updateProject`, `updateChapter`, `generating`, `generate`, `onOpenBible`, `onOpenActions` as props — no data fetching, no new hooks. `GhostWriterApp.tsx` reads `useFeatureIsOn(FLAGS.writingRoomShell)` and, when true: forces `mode`/`prompt` passed into `useAIActions` to `"write"` / a sensible fallback prompt (so the single `Write` button always has something to generate), collapses the World Bible panel by default, renders `WritingRoom` instead of the toolbar+chapter-list rail, and renders the existing `ToolbarPanel` inside a slide-over overlay triggered by Writing Room's `Actions` button (zero prop duplication — `ToolbarPanel`'s ~130-prop JSX block is extracted once into a `toolbarPanelElement` variable and reused by both branches). The Guide bar (Phase 1) stays mounted unconditionally above both layouts. The project's "current stage" (Idea/Structure/Draft/Polish/Export) is derived via a new exported `currentStage()` helper in `src/lib/guide/next-action.ts`, reusing the existing decision-ladder logic.

**Tech Stack:** TypeScript, React (Next.js App Router), `@growthbook/growthbook-react` (`useFeatureIsOn`), existing TipTap `ChapterEditor` (`src/components/editor/ChapterEditor.tsx`), Vitest.

**Background:** This is "Phase 2" from `ghostwriter-redesign.md` §6, split into two plans because of its size. This plan (1 of 2) builds the shell with an Actions-overlay bridge to the existing `ToolbarPanel` for immediate full feature parity. Plan 2 of 2 will replace the Actions overlay with a `/`-triggered slash menu generated from `MODE_REGISTRY`'s `slash`/`keywords` fields (added in Phase 0).

---

### Task 1: Add `STAGE_ORDER` and `currentStage()` to the Guide engine

**Files:**
- Modify: `src/lib/guide/next-action.ts`
- Test: `src/lib/guide/__tests__/next-action.test.ts`

- [x] **Step 1: Write the failing tests**

In `src/lib/guide/__tests__/next-action.test.ts`, update the import on line 3 from:

```typescript
import { nextAction, type GuideProject } from "../next-action";
```

to:

```typescript
import { nextAction, currentStage, STAGE_ORDER, type GuideProject } from "../next-action";
```

Then add a new `describe` block at the end of the file (after the closing `});` of the existing `describe("nextAction", ...)` block, i.e. after line 115):

```typescript

describe("currentStage", () => {
  it("returns 'idea' when there is no controlling idea", () => {
    expect(currentStage(base)).toBe("idea");
  });

  it("returns 'export' even when export-manuscript has been dismissed", () => {
    const project: GuideProject = {
      ...base,
      controllingIdea: "Premise.",
      characters: [{ id: "char-1" }],
      chapters: [{ id: "ch-1", title: "Chapter 1", wordCount: 600, sortOrder: 0 }],
      dismissedGuideIds: ["polish-review-ch-1", "export-manuscript"],
    };
    expect(nextAction(project)).toBeNull();
    expect(currentStage(project)).toBe("export");
  });

  it("matches the expected stage order", () => {
    expect(STAGE_ORDER).toEqual(["idea", "structure", "draft", "polish", "export"]);
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/guide/__tests__/next-action.test.ts`
Expected: FAIL — `currentStage` and `STAGE_ORDER` are not exported from `../next-action` (TS/import error).

- [x] **Step 3: Implement `STAGE_ORDER` and `currentStage`**

In `src/lib/guide/next-action.ts`, after the `GuideAction` type definition (after line 18, before `export interface GuideChapter`), add:

```typescript

export const STAGE_ORDER: readonly GuideStage[] = ["idea", "structure", "draft", "polish", "export"];
```

Then, after the `nextAction` function (after its closing `}` on line 46, before `function computeAction`), add:

```typescript

/**
 * Returns the project's current stage in the Idea -> Structure -> Draft ->
 * Polish -> Export ladder, independent of whether the matching Guide
 * suggestion has been dismissed. Used to render the writing room's stage
 * progress indicator.
 */
export function currentStage(project: GuideProject): GuideStage {
  return computeAction(project)?.stage ?? "draft";
}
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/guide/__tests__/next-action.test.ts`
Expected: PASS — all tests including the 3 new `currentStage` tests (12 total).

---

### Task 2: Add the `writingRoomShell` GrowthBook flag

**Files:**
- Modify: `src/lib/growthbook.ts:15-23`

- [x] **Step 1: Add the flag entry**

In `src/lib/growthbook.ts`, the `FLAGS` const is:

```typescript
export const FLAGS = {
  craftLibrary:        "craft_library",
  constellationView:   "constellation_view",
  draftBranching:      "draft_branching",
  readerMode:          "reader_mode",
  commandPalette:      "command_palette",
  adaptiveOnboarding:  "adaptive_onboarding",
  newDesignTokens:     "new_design_tokens",
} as const;
```

Replace with:

```typescript
export const FLAGS = {
  craftLibrary:        "craft_library",
  constellationView:   "constellation_view",
  draftBranching:      "draft_branching",
  readerMode:          "reader_mode",
  commandPalette:      "command_palette",
  adaptiveOnboarding:  "adaptive_onboarding",
  newDesignTokens:     "new_design_tokens",
  writingRoomShell:    "writing_room_shell",
} as const;
```

- [x] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0 (no new errors).

This flag defaults to "off" everywhere (no GrowthBook experiment configured for it yet), so `useFeatureIsOn(FLAGS.writingRoomShell)` returns `false` until the owner creates and enables the feature in the GrowthBook dashboard — keeping the current layout as the default, satisfying spec §7.

---

### Task 3: Create `WritingRoom.tsx`

**Files:**
- Create: `src/components/WritingRoom.tsx`

- [x] **Step 1: Write the component**

Create `src/components/WritingRoom.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { ChapterEditor } from "@/components/editor/ChapterEditor";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import { getChapterLabel } from "@/lib/formats";
import { currentStage, STAGE_ORDER, type GuideStage } from "@/lib/guide/next-action";

const STAGE_LABELS: Record<GuideStage, string> = {
  idea: "Idea",
  structure: "Structure",
  draft: "Draft",
  polish: "Polish",
  export: "Export",
};

interface WritingRoomProps {
  project: any;
  activeChap: any;
  updateProject: (fn: (p: any) => any) => void;
  updateChapter: (field: string, value: any) => void;
  generating: boolean;
  generate: () => Promise<void>;
  onOpenBible: () => void;
  onOpenActions: () => void;
}

export default function WritingRoom({
  project, activeChap, updateProject, updateChapter,
  generating, generate, onOpenBible, onOpenActions,
}: WritingRoomProps) {
  const [bibleOpen, setBibleOpen] = useState(true);

  useEffect(() => {
    if (window.innerWidth < 900) setBibleOpen(false);
  }, []);

  const sortedChapters = [...(project.chapters || [])].sort((a: any, b: any) => a.sortOrder - b.sortOrder);
  const chapIndex = sortedChapters.findIndex((c: any) => c.id === activeChap.id);
  const stage = currentStage({
    controllingIdea: project.controllingIdea,
    characters: project.characters || [],
    chapters: project.chapters || [],
    dismissedGuideIds: project.dismissedGuideIds,
  });
  const stageIdx = STAGE_ORDER.indexOf(stage);

  const goToChapter = (i: number) => {
    const target = sortedChapters[i];
    if (target) updateProject((p: any) => ({ ...p, activeChapter: target.id }));
  };

  const handleEditorChange = (json: string, wordCount: number) => {
    updateChapter("content", json);
    updateChapter("wordCount", wordCount);
    fetch(`/api/projects/${project.id}/chapters/${activeChap.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: json }),
    }).catch(() => {});
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ flexShrink: 0, borderBottom: `1px solid ${co.border}`, padding: "10px 20px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: co.text }}>{project.name}</span>
          <span style={{ fontSize: 11, color: co.muted }}>{project.format}</span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: co.muted }}>
            <button style={{ ...sBtnSm, padding: "2px 8px" }} disabled={chapIndex <= 0} onClick={() => goToChapter(chapIndex - 1)}>‹</button>
            <span>{getChapterLabel(project.format)} {chapIndex + 1} of {sortedChapters.length}: {activeChap.title}</span>
            <button style={{ ...sBtnSm, padding: "2px 8px" }} disabled={chapIndex < 0 || chapIndex >= sortedChapters.length - 1} onClick={() => goToChapter(chapIndex + 1)}>›</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, fontSize: 11 }}>
          {STAGE_ORDER.map((s, i) => (
            <span key={s} style={{
              padding: "2px 8px", borderRadius: 6,
              fontWeight: i === stageIdx ? 700 : 400,
              color: i < stageIdx ? co.green : i === stageIdx ? co.accent : co.muted,
              background: i === stageIdx ? co.accentBg : "transparent",
            }}>
              {i < stageIdx ? "✓ " : ""}{STAGE_LABELS[s]}
            </span>
          ))}
        </div>
      </div>

      {/* Body: editor + bible glance rail */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <ChapterEditor
          content={activeChap.content ?? ""}
          onChange={handleEditorChange}
          placeholder="Begin writing..."
          autoFocus
        />

        <div style={{ width: bibleOpen ? 190 : 36, minWidth: bibleOpen ? 190 : 36, borderLeft: `1px solid ${co.border}`, background: co.surface, transition: "width 0.2s", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: bibleOpen ? "space-between" : "center", alignItems: "center", padding: "8px" }}>
            {bibleOpen && <span style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1 }}>Bible</span>}
            <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 14 }} onClick={() => setBibleOpen(o => !o)}>{bibleOpen ? "▶" : "◀"}</button>
          </div>
          {bibleOpen && (
            <div style={{ flex: 1, overflow: "auto", padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 14 }}>
              <BibleSection title="Characters" items={(project.characters || []).map((c: any) => c.name)} />
              <BibleSection title="Locations" items={(project.locations || []).map((l: any) => l.name)} />
              <BibleSection title="Threads" items={(project.plotThreads || []).map((t: any) => t.name)} />
              <button style={{ ...sBtnSm, marginTop: "auto" }} onClick={onOpenBible}>Open bible →</button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ flexShrink: 0, borderTop: `1px solid ${co.border}`, padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button style={sBtnSm} onClick={onOpenActions}>Actions</button>
        <button style={{ ...sBtn, opacity: generating ? 0.6 : 1 }} disabled={generating} onClick={() => generate()}>
          {generating ? "Writing…" : "Write"}
        </button>
      </div>
    </div>
  );
}

function BibleSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: co.muted }}>None yet</div>
      ) : (
        items.map((name, i) => <div key={i} style={{ fontSize: 12, color: co.text, padding: "2px 0" }}>{name}</div>)
      )}
    </div>
  );
}
```

- [x] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0 (no new errors).

---

### Task 4: Wire `WritingRoom` into `GhostWriterApp.tsx` behind the flag

**Files:**
- Modify: `src/components/GhostWriterApp.tsx`

- [x] **Step 1: Add imports**

In `src/components/GhostWriterApp.tsx`, find (lines 13-14):

```typescript
import { GuideBar } from "@/components/GuideBar";
import { nextAction, type GuideAction } from "@/lib/guide/next-action";
```

Replace with:

```typescript
import { GuideBar } from "@/components/GuideBar";
import { nextAction, type GuideAction } from "@/lib/guide/next-action";
import { useFeatureIsOn } from "@growthbook/growthbook-react";
import { FLAGS } from "@/lib/growthbook";
import WritingRoom from "@/components/WritingRoom";
```

- [x] **Step 2: Add `writingRoomEnabled` and `actionsOpen` state**

Find (line 70):

```typescript
  const [resendSent, setResendSent] = useState(false);
```

Replace with:

```typescript
  const [resendSent, setResendSent] = useState(false);
  const writingRoomEnabled = useFeatureIsOn(FLAGS.writingRoomShell);
  const [actionsOpen, setActionsOpen] = useState(false);
```

- [x] **Step 3: Collapse the World Bible panel by default when the Writing Room is enabled**

Find (lines 99-100):

```typescript
    const tint = tintMap[mode] ?? "rgba(217,119,6,0.08)";
    document.documentElement.style.setProperty("--library-tint", tint);
  }, [mode]);
```

Replace with:

```typescript
    const tint = tintMap[mode] ?? "rgba(217,119,6,0.08)";
    document.documentElement.style.setProperty("--library-tint", tint);
  }, [mode]);

  useEffect(() => {
    if (writingRoomEnabled) setLeftCollapsed(true);
  }, [writingRoomEnabled]);
```

- [x] **Step 4: Force `mode`/`prompt` to "write" with a fallback prompt when the Writing Room is enabled**

Find (lines 116-136):

```typescript
  const guideAction = useMemo(() => nextAction({
    controllingIdea: project?.controllingIdea,
    characters: project?.characters || [],
    chapters: project?.chapters || [],
    dismissedGuideIds: project?.dismissedGuideIds,
  }), [project?.controllingIdea, project?.characters, project?.chapters, project?.dismissedGuideIds]);

  const aiActions = useAIActions({
    project: project || {},
    mode,
    prompt,
    activeChap,
    updateChapter: projectState.updateChapter,
    setErrorMsg,
    setSavedMsg,
    creatorBible: projectState.creatorBible,
    cohostVoice,
    setUpgradeRequired: (f) => setUpgradeRequired(f as FeatureGate),
    activeInfluence,
    activePatterns,
  });
```

Replace with:

```typescript
  const guideAction = useMemo(() => nextAction({
    controllingIdea: project?.controllingIdea,
    characters: project?.characters || [],
    chapters: project?.chapters || [],
    dismissedGuideIds: project?.dismissedGuideIds,
  }), [project?.controllingIdea, project?.characters, project?.chapters, project?.dismissedGuideIds]);

  const effectiveMode = writingRoomEnabled ? "write" : mode;
  const effectivePrompt = writingRoomEnabled
    ? (prompt.trim() || guideAction?.run.prompt || "Continue this scene.")
    : prompt;

  const aiActions = useAIActions({
    project: project || {},
    mode: effectiveMode,
    prompt: effectivePrompt,
    activeChap,
    updateChapter: projectState.updateChapter,
    setErrorMsg,
    setSavedMsg,
    creatorBible: projectState.creatorBible,
    cohostVoice,
    setUpgradeRequired: (f) => setUpgradeRequired(f as FeatureGate),
    activeInfluence,
    activePatterns,
  });
```

- [x] **Step 5: Extract the existing `ToolbarPanel` JSX into a `toolbarPanelElement` variable**

Find (lines 225-239, the end of `handleGuideDismiss` through the start of `return`):

```typescript
  const handleGuideDismiss = (id: string) => {
    fetch("/api/events", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "guide_dismissed", properties: { actionId: id } }),
    }).catch(() => {});

    const next = [...(project.dismissedGuideIds ?? []), id];
    projectState.updateProject((p: any) => ({ ...p, dismissedGuideIds: next }));
    fetch(`/api/projects/${project.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissedGuideIds: next }),
    }).catch(() => {});
  };

  return (
```

Replace with (this is the existing `<ToolbarPanel ... />` props from lines 337-467, unchanged, lifted into a variable):

```typescript
  const handleGuideDismiss = (id: string) => {
    fetch("/api/events", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "guide_dismissed", properties: { actionId: id } }),
    }).catch(() => {});

    const next = [...(project.dismissedGuideIds ?? []), id];
    projectState.updateProject((p: any) => ({ ...p, dismissedGuideIds: next }));
    fetch(`/api/projects/${project.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissedGuideIds: next }),
    }).catch(() => {});
  };

  const toolbarPanelElement = (
    <ToolbarPanel
      project={project}
      higgsfieldKey={higgsfieldKey}
      mode={mode}
      setMode={setMode}
      activeChap={activeChap}
      updateChapter={projectState.updateChapter}
      prompt={prompt}
      setPrompt={setPrompt}
      expandedPrompt={expandedPrompt}
      setExpandedPrompt={setExpandedPrompt}
      showAgents={showAgents}
      setShowAgents={setShowAgents}
      showComicStudio={showComicStudio}
      setShowComicStudio={setShowComicStudio}
      showProductionStudio={showProductionStudio}
      setShowProductionStudio={setShowProductionStudio}
      generating={aiActions.generating}
      genTarget={aiActions.genTarget}
      streamText={aiActions.streamText}
      setStreamText={aiActions.setStreamText}
      undoStack={aiActions.undoStack}
      undoGeneration={aiActions.undoGeneration}
      pipelineRunning={aiActions.pipelineRunning}
      pipelineResults={aiActions.pipelineResults}
      setPipelineResults={aiActions.setPipelineResults}
      expandedAgent={aiActions.expandedAgent}
      setExpandedAgent={aiActions.setExpandedAgent}
      activePipelineId={aiActions.activePipelineId}
      runPipeline={aiActions.runPipeline}
      usePipelineOutput={aiActions.usePipelineOutput}
      selectedText={aiActions.selectedText}
      setSelectedText={aiActions.setSelectedText}
      setSelectedRange={aiActions.setSelectedRange}
      proseLoading={aiActions.proseLoading}
      proseResult={aiActions.proseResult}
      setProseResult={aiActions.setProseResult}
      runProse={aiActions.runProse}
      replaceSelection={aiActions.replaceSelection}
      hookScore={aiActions.hookScore}
      hookScoring={aiActions.hookScoring}
      scoreHook={aiActions.scoreHook}
      generate={aiActions.generate}
      expandBeat={aiActions.expandBeat}
      generateDialogue={aiActions.generateDialogue}
      updateProject={projectState.updateProject}
      handleTextareaSelect={aiActions.handleTextareaSelect}
      setSavedMsg={setSavedMsg}
      dialogueCharA={dialogueCharA}
      setDialogueCharA={setDialogueCharA}
      dialogueCharB={dialogueCharB}
      setDialogueCharB={setDialogueCharB}
      cohostVoice={cohostVoice}
      setCohostVoice={setCohostVoice}
      dialogueArchetype={dialogueArchetype}
      setDialogueArchetype={setDialogueArchetype}
      combatStyleA={combatStyleA}
      setCombatStyleA={setCombatStyleA}
      combatStyleB={combatStyleB}
      setCombatStyleB={setCombatStyleB}
      generateCombat={aiActions.generateCombat}
      emotionalEmotion={emotionalEmotion}
      setEmotionalEmotion={setEmotionalEmotion}
      atmosphereEnvironment={atmosphereEnvironment}
      setAtmosphereEnvironment={setAtmosphereEnvironment}
      tensionType={tensionType}
      setTensionType={setTensionType}
      generateEmotionalScene={aiActions.generateEmotionalScene}
      generateAtmosphere={aiActions.generateAtmosphere}
      generateTension={aiActions.generateTension}
      horrorArchetype={horrorArchetype}
      setHorrorArchetype={setHorrorArchetype}
      generateHorror={aiActions.generateHorror}
      comedyArchetype={comedyArchetype}
      setComedyArchetype={setComedyArchetype}
      generateComedy={aiActions.generateComedy}
      mysteryArchetype={mysteryArchetype}
      setMysteryArchetype={setMysteryArchetype}
      generateMystery={aiActions.generateMystery}
      romanceArchetype={romanceArchetype}
      setRomanceArchetype={setRomanceArchetype}
      generateRomance={aiActions.generateRomance}
      actionArchetype={actionArchetype}
      setActionArchetype={setActionArchetype}
      generateAction={aiActions.generateAction}
      monologueArchetype={monologueArchetype}
      setMonologueArchetype={setMonologueArchetype}
      generateMonologue={aiActions.generateMonologue}
      voiceProfile={voiceProfile}
      setVoiceProfile={setVoiceProfile}
      generateVoice={aiActions.generateVoice}
      thrillerArchetype={thrillerArchetype}
      setThrillerArchetype={setThrillerArchetype}
      generateThriller={aiActions.generateThriller}
      sportsArchetype={sportsArchetype}
      setSportsArchetype={setSportsArchetype}
      generateSports={aiActions.generateSports}
      settingArchetype={settingArchetype}
      setSettingArchetype={setSettingArchetype}
      generateSetting={aiActions.generateSetting}
      historicalArchetype={historicalArchetype}
      setHistoricalArchetype={setHistoricalArchetype}
      generateHistorical={aiActions.generateHistorical}
      scitechArchetype={scitechArchetype}
      setScitechArchetype={setScitechArchetype}
      generateScitech={aiActions.generateScitech}
      ethicsArchetype={ethicsArchetype}
      setEthicsArchetype={setEthicsArchetype}
      generateEthics={aiActions.generateEthics}
      endingsArchetype={endingsArchetype}
      setEndingsArchetype={setEndingsArchetype}
      generateEndings={aiActions.generateEndings}
      isekaiArchetype={isekaiArchetype}
      setIsekaiArchetype={setIsekaiArchetype}
      generateIsekai={aiActions.generateIsekai}
      generateInterrogation={aiActions.generateInterrogation}
      generateChase={aiActions.generateChase}
      compositionLayers={compositionLayers}
      setCompositionLayers={setCompositionLayers}
      generateComposition={aiActions.generateComposition}
      setUpgradeRequired={(f) => setUpgradeRequired(f as FeatureGate)}
      onShowStoryHealth={() => setShowStoryHealth(true)}
      onShowExport={() => setShowExport(true)}
      onSlashCommand={handleSlashCommand}
      skillSuggestion={skillSuggestion}
      onSkillSuggestionChange={setSkillSuggestion}
      onDismissSkillSuggestion={() => setSkillSuggestion(null)}
      onAcceptSkillSuggestion={handleAcceptSkillSuggestion}
      activeInfluence={activeInfluence}
      setActiveInfluence={setActiveInfluence}
      activePatterns={activePatterns}
      setActivePatterns={setActivePatterns}
    />
  );

  return (
```

- [x] **Step 6: Branch the toolbar/editor area on `writingRoomEnabled`**

Find the block (lines 335-500, the `gw-toolbar-panel` div through the closing `<ChapterEditor ... />`):

```typescript
      <div className={`gw-toolbar-panel${mobileToolbarOpen ? " mobile-open" : ""}`}>
      <ToolbarPanel
        project={project}
        higgsfieldKey={higgsfieldKey}
        mode={mode}
```

This is the start of the block being replaced — the full old block runs from this `<div className="gw-toolbar-panel...">` line through the closing `/>` of `<ChapterEditor ... />` (the block ending in `setUpgradeRequired={(f) => setUpgradeRequired(f as FeatureGate)}\n      />` for ChapterEditor, immediately followed by a blank line and `{showStoryHealth && (`).

Replace the entire block (from `<div className={\`gw-toolbar-panel...` through the `<ChapterEditor ... />` closing tag, inclusive) with:

```typescript
      {writingRoomEnabled ? (
        <>
          <WritingRoom
            project={project}
            activeChap={activeChap}
            updateProject={projectState.updateProject}
            updateChapter={projectState.updateChapter}
            generating={aiActions.generating}
            generate={aiActions.generate}
            onOpenBible={() => setLeftCollapsed(false)}
            onOpenActions={() => setActionsOpen(true)}
          />
          {actionsOpen && (
            <div
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 1500, display: "flex", justifyContent: "flex-end" }}
              onClick={() => setActionsOpen(false)}
            >
              <div
                style={{ width: 420, maxWidth: "100%", height: "100%", background: co.surface, overflow: "auto", position: "relative" }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setActionsOpen(false)}
                  style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", fontSize: 22, lineHeight: 1, cursor: "pointer", color: co.muted, zIndex: 1 }}
                  aria-label="Close"
                >
                  ×
                </button>
                {toolbarPanelElement}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className={`gw-toolbar-panel${mobileToolbarOpen ? " mobile-open" : ""}`}>
          {toolbarPanelElement}
          </div>

          {/* Mobile toolbar toggle — hidden on desktop via CSS */}
          <button
            className="mobile-toolbar-toggle"
            onClick={() => setMobileToolbarOpen(p => !p)}
            style={{
              display: 'none',
              position: 'fixed', bottom: 24, right: 24, zIndex: 200,
              width: 52, height: 52, borderRadius: '50%',
              background: 'var(--color-accent)', color: '#fff', border: 'none',
              cursor: 'pointer', fontSize: 22,
              alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}
          >
            {mobileToolbarOpen ? '✕' : '☰'}
          </button>

          <ChapterEditor
            project={project}
            updateProject={projectState.updateProject}
            updateChapter={projectState.updateChapter}
            addChapter={projectState.addChapter}
            deleteChapter={projectState.deleteChapter}
            moveChapter={projectState.moveChapter}
            rightCollapsed={rightCollapsed}
            setRightCollapsed={setRightCollapsed}
            passiveSuggestions={projectState.passiveSuggestions}
            setPassiveSuggestions={projectState.setPassiveSuggestions}
            setUpgradeRequired={(f) => setUpgradeRequired(f as FeatureGate)}
          />
        </>
      )}
```

- [x] **Step 7: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0 (no new errors — pre-existing "Props must be serializable" warnings for function props between client components are expected false positives per `CLAUDE.md`).

---

### Final Verification

- [x] **Run the guide engine unit tests:**

Run: `npx vitest run src/lib/guide/__tests__/next-action.test.ts`
Expected: PASS (12 tests).

- [x] **Run the full production build:**

Run: `npm run build`
Expected: exit 0, all routes compile successfully (no new errors vs. the Phase 1 build baseline).

- [x] **Confirm `GhostWriterApp.tsx` is unchanged in line count terms relevant to the eventual replacement ceiling.**

`GhostWriterApp.tsx` itself will grow slightly (new imports, state, the `toolbarPanelElement` extraction adds a variable declaration around the existing prop list, plus the new conditional branch and `WritingRoom`/overlay JSX). The spec's "under 350 lines" target (§8) applies to the *eventual* `GhostWriterApp.tsx` replacement after Phase 5 deletes the 26 mode panels and the `ToolbarPanel`/Actions-overlay bridge is replaced by Plan 2's slash menu — not to this intermediate flag-gated state. No action needed here beyond noting this in the plan's final status.

---

## Self-Review Notes

- **Spec coverage:** Header (project name · format · position · stage progress) ✅ (`WritingRoom` header). Guide bar ✅ (already mounted globally, untouched). Editor (TipTap full-width, reuses `src/components/editor/ChapterEditor.tsx`) ✅. Bible rail (collapsible 190px, read-only glance, "Open bible" button, collapsed by default on small screens via the `window.innerWidth < 900` check) ✅. Footer (`Actions` left, `Write` primary right) ✅. GrowthBook flag gate, default off, old layout preserved ✅ (Task 2 + Task 4 Steps 2-6). Slash menu generated from `MODE_REGISTRY` is explicitly deferred to Plan 2 of 2 (the `Actions` button opens the existing `ToolbarPanel` overlay instead, for immediate full parity).
- **Design laws (§1):** Rule of three — footer has exactly 2 buttons (`Actions`, `Write`); header has prev/next chapter nav + stage strip (informational, not "primary choices"). Guide bar still shows exactly one suggestion (unchanged from Phase 1). Progressive disclosure — Bible rail starts as a glance, "Open bible →" expands the full `WorldBiblePanel`. One primary button (`Write`) — `Actions` uses `sBtnSm` (secondary style), `Write` uses `sBtn` (primary/accent style).
- **No commit steps included**, per standing project policy (all work stays uncommitted in the working tree until the user explicitly asks).
