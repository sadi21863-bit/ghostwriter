# Phase 3 Plan 3 of 4: Polish & Export Stage Views Implementation Plan

> **STATUS: COMPLETE** (2026-06-14). All 6 tasks executed inline. Verification: `npx tsc --noEmit` exit 0 (clean); `npx vitest run src/lib/modes/__tests__ src/lib/guide/__tests__` → 4 files / 39 tests passed.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Polish and Export stage views to the WritingRoom stage router, surfacing the existing StoryHealthPanel / QualityReviewPanel / ExportPanel / ProductionStudio as one-click destinations from within the guided writing flow, per §2.4 of ghostwriter-redesign.md.

**Architecture:** Two new thin "funnel" stage-view components (`PolishStageView.tsx`, `ExportStageView.tsx`) mirror the pattern established by `StructureStageView.tsx` in Plan 2 — they read `nextAction(project)` to surface stage-relevant data (chapter title/word count, quality-review issue counts) and a single primary CTA that reuses GhostWriterApp's existing `handleGuideRun` / `handleGuideDismiss` handlers and global overlay state (`showStoryHealth`, `showExport`, `showProductionStudio`). No new overlays, no new flags, no schema changes.

**Tech Stack:** React/Next.js (existing `WritingRoom.tsx` stage router), TypeScript, existing `src/lib/guide/next-action.ts` types.

---

## Background: scope decision

§2.4 literally describes: "Polish = StoryHealthPanel + QualityReviewPanel merged into ONE report view, surfaced only when chapter >500 words. Export = ExportPanel + SeriesPipelinePanel/Higgsfield (Production Studio relocates here)."

Taken literally this is a ~2150-line merge across 5 existing files (StoryHealthPanel 760 lines/9 tabs, QualityReviewPanel 131 lines, ExportPanel 311 lines, SeriesPipelinePanel 276 lines nested inside ProductionStudio 706 lines) — a rewrite, not a stage view, and far out of proportion with Plan 2's ~150-line addition.

Research found the existing app infrastructure already implements almost everything needed — it's just not surfaced from inside the stage flow yet:

- `StoryHealthPanel` / `ExportPanel` already render as global full-screen overlays (`showStoryHealth` / `showExport` state in `GhostWriterApp.tsx`), unconditionally — independent of `writingRoomEnabled`. They already work in WritingRoom mode.
- `handleGuideRun(action)` (`GhostWriterApp.tsx:232-246`) already opens the right overlay for `action.run.mode === "story_health"` (sets `showStoryHealth`) and `"export"` (sets `showExport`) — exactly the `run.mode` values `nextAction(project)` returns for the polish and export stages respectively.
- `handleGuideDismiss(id)` (`GhostWriterApp.tsx:248-260`) already implements the "mark reviewed" PATCH of `dismissedGuideIds` — calling it with `polish-review-${chapterId}` advances `currentStage()` past Polish.
- `aiActions.qualityReview` already holds the non-blocking async `QualityReview` result, available for an inline Polish summary without re-running anything.
- `ProductionStudio` (with `SeriesPipelinePanel` nested inside, covering the Higgsfield series pipeline) is reachable via Actions overlay → ToolbarPanel → `showProductionStudio` toggle.

**Decision:** Scope this plan to two thin stage-view components that act as funnels into this existing infrastructure — same pattern as `StructureStageView.tsx` from Plan 2, which didn't reimplement outline generation, just provided a button that routes into the existing `outline` mode pipeline.

- "Merged into ONE report view" is satisfied by the Polish stage becoming the single entry point: an inline quick-signal (from `aiActions.qualityReview`) plus a one-click drill-down into the full 9-tab `StoryHealthPanel`.
- "Production Studio relocates here" is satisfied by a secondary CTA on the Export stage view that opens Production Studio (which already contains `SeriesPipelinePanel`), shown only for Higgsfield projects (`project.isHiggsfieldProject`).

No new GrowthBook flags — both stage views render inside the existing `writingRoomShell`-gated stage router (`WritingRoom.tsx`), which Plan 2 already wired up.

---

## File Structure

- Create: `src/components/stages/PolishStageView.tsx` — inline quality summary + CTA to open StoryHealthPanel + "mark reviewed" CTA.
- Create: `src/components/stages/ExportStageView.tsx` — manuscript summary + CTA to open ExportPanel + (Higgsfield only) CTA to open Production Studio.
- Modify: `src/components/panels/QualityReviewPanel.tsx` — export the `QualityReview` interface so it can be imported elsewhere.
- Modify: `src/components/WritingRoom.tsx` — extend `WritingRoomProps`, extend stage router for `"polish"` / `"export"`.
- Modify: `src/components/GhostWriterApp.tsx` — pass 4 new props to `<WritingRoom>`.

---

## Tasks

### Task 1: Export the QualityReview type

**Files:**
- Modify: `src/components/panels/QualityReviewPanel.tsx`

- [ ] Step 1: Change `interface QualityReview {` to `export interface QualityReview {`. No other changes.

- [ ] Step 2: Run `npx tsc --noEmit` from the `ghostwriter` directory. Expect: same errors as before this change (this step only adds an export keyword, nothing should newly break).

---

### Task 2: Create PolishStageView

**Files:**
- Create: `src/components/stages/PolishStageView.tsx`

- [ ] Step 1: Create the file with this content:

```tsx
// src/components/stages/PolishStageView.tsx
"use client";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import { nextAction, type GuideAction } from "@/lib/guide/next-action";
import type { QualityReview } from "@/components/panels/QualityReviewPanel";

interface PolishStageViewProps {
  project: any;
  qualityReview: QualityReview | null;
  onGuideRun: (action: GuideAction) => void;
  onGuideDismiss: (id: string) => void;
}

export default function PolishStageView({ project, qualityReview, onGuideRun, onGuideDismiss }: PolishStageViewProps) {
  const action = nextAction({
    controllingIdea: project.controllingIdea,
    characters: project.characters || [],
    chapters: project.chapters || [],
    dismissedGuideIds: project.dismissedGuideIds,
  })!;
  const chapter = (project.chapters || []).find((c: any) => c.id === action.run.chapterId);

  const issueCount = qualityReview
    ? qualityReview.ruleViolations.length + qualityReview.knowledgeViolations.length + qualityReview.slopMarkers.length
    : 0;
  const topIssue = qualityReview?.ruleViolations[0] ?? qualityReview?.knowledgeViolations[0] ?? qualityReview?.slopMarkers[0];

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "32px 24px", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 560, width: "100%" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
          Polish
        </div>
        <p style={{ fontSize: 14, color: co.text, lineHeight: 1.6, marginBottom: 4 }}>
          {chapter ? <>&ldquo;{chapter.title}&rdquo; — {chapter.wordCount} words</> : "This chapter is ready for a story health check."}
        </p>

        <div style={{ padding: "16px 18px", borderRadius: 10, border: `1px solid ${co.border}`, background: co.surface, margin: "12px 0 16px" }}>
          {qualityReview ? (
            issueCount > 0 ? (
              <>
                <p style={{ fontSize: 13, color: co.text, lineHeight: 1.6, marginTop: 0, marginBottom: topIssue ? 8 : 0 }}>
                  {issueCount} potential issue{issueCount === 1 ? "" : "s"} flagged — signal: {qualityReview.overallSignal}.
                </p>
                {topIssue && (
                  <p style={{ fontSize: 12, color: co.muted, lineHeight: 1.6, margin: 0 }}>
                    {topIssue.text || topIssue.violation || topIssue.suggestion}
                  </p>
                )}
              </>
            ) : (
              <p style={{ fontSize: 13, color: co.text, lineHeight: 1.6, margin: 0 }}>
                No quality issues flagged — signal: {qualityReview.overallSignal}.
              </p>
            )
          ) : (
            <p style={{ fontSize: 13, color: co.muted, lineHeight: 1.6, margin: 0 }}>
              No quality issues flagged yet.
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button style={sBtn} onClick={() => onGuideRun(action)}>Open full story health report →</button>
          <button style={sBtnSm} onClick={() => onGuideDismiss(action.id)}>Mark as reviewed</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] Step 2: Run `npx tsc --noEmit`. Expect: no NEW errors from this file (it's not imported anywhere yet, so it's only checked in isolation — any errors here are about this file's own types).

---

### Task 3: Create ExportStageView

**Files:**
- Create: `src/components/stages/ExportStageView.tsx`

- [ ] Step 1: Create the file with this content:

```tsx
// src/components/stages/ExportStageView.tsx
"use client";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import { nextAction, type GuideAction } from "@/lib/guide/next-action";

interface ExportStageViewProps {
  project: any;
  onGuideRun: (action: GuideAction) => void;
  onOpenProductionStudio: () => void;
}

export default function ExportStageView({ project, onGuideRun, onOpenProductionStudio }: ExportStageViewProps) {
  const action = nextAction({
    controllingIdea: project.controllingIdea,
    characters: project.characters || [],
    chapters: project.chapters || [],
    dismissedGuideIds: project.dismissedGuideIds,
  })!;
  const chapters = project.chapters || [];
  const totalWords = chapters.reduce((sum: number, c: any) => sum + (c.wordCount || 0), 0);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "32px 24px", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 560, width: "100%" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
          Export
        </div>
        <p style={{ fontSize: 14, color: co.text, lineHeight: 1.6, marginBottom: 16 }}>
          {chapters.length} chapter{chapters.length === 1 ? "" : "s"}, {totalWords.toLocaleString()} words total. Ready to export.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={sBtn} onClick={() => onGuideRun(action)}>Open Export →</button>
          {project.isHiggsfieldProject && (
            <button style={sBtnSm} onClick={onOpenProductionStudio}>Open Production Studio →</button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] Step 2: Run `npx tsc --noEmit`. Expect: no NEW errors from this file.

---

### Task 4: Wire the two new stage views into WritingRoom's stage router

**Files:**
- Modify: `src/components/WritingRoom.tsx`

- [ ] Step 1: Update the import block at the top of the file. Replace:

```ts
import { currentStage, STAGE_ORDER, type GuideStage } from "@/lib/guide/next-action";
```

with:

```ts
import { currentStage, nextAction, STAGE_ORDER, type GuideStage, type GuideAction } from "@/lib/guide/next-action";
```

  (Note: `nextAction` and `type GuideAction` are new; this file doesn't call `nextAction` itself — the two new stage views do — but `GuideAction` is needed for the `onGuideRun` prop type below. `nextAction` is imported here for symmetry with the stage views and may be unused in this file; if `tsc`/eslint flags an unused import, remove `nextAction` from this line and keep only `currentStage, STAGE_ORDER, type GuideStage, type GuideAction`.)

  Then add two more imports immediately after the existing `import StructureStageView from "@/components/stages/StructureStageView";` line:

```ts
import PolishStageView from "@/components/stages/PolishStageView";
import ExportStageView from "@/components/stages/ExportStageView";
import type { QualityReview } from "@/components/panels/QualityReviewPanel";
```

- [ ] Step 2: Extend `WritingRoomProps`. Add these four lines to the interface immediately after `onSelectMode: (mode: GenerationMode) => void;`:

```ts
  onGuideRun: (action: GuideAction) => void;
  onGuideDismiss: (id: string) => void;
  qualityReview: QualityReview | null;
  onOpenProductionStudio: () => void;
```

- [ ] Step 3: Destructure the new props. In the component signature, change:

```ts
export default function WritingRoom({
  project, activeChap, updateProject, updateChapter,
  generating, generate, onOpenBible, onOpenActions,
  prompt, setPrompt, onSelectMode,
}: WritingRoomProps) {
```

  to:

```ts
export default function WritingRoom({
  project, activeChap, updateProject, updateChapter,
  generating, generate, onOpenBible, onOpenActions,
  prompt, setPrompt, onSelectMode,
  onGuideRun, onGuideDismiss, qualityReview, onOpenProductionStudio,
}: WritingRoomProps) {
```

- [ ] Step 4: Extend the stage-router ternary. Change:

```tsx
      {stage === "idea" ? (
        <IdeaStageView project={project} updateProject={updateProject} onOpenBible={onOpenBible} />
      ) : stage === "structure" ? (
        <StructureStageView project={project} setPrompt={setPrompt} onSelectMode={onSelectMode} />
      ) : (
```

  to:

```tsx
      {stage === "idea" ? (
        <IdeaStageView project={project} updateProject={updateProject} onOpenBible={onOpenBible} />
      ) : stage === "structure" ? (
        <StructureStageView project={project} setPrompt={setPrompt} onSelectMode={onSelectMode} />
      ) : stage === "polish" ? (
        <PolishStageView project={project} qualityReview={qualityReview} onGuideRun={onGuideRun} onGuideDismiss={onGuideDismiss} />
      ) : stage === "export" ? (
        <ExportStageView project={project} onGuideRun={onGuideRun} onOpenProductionStudio={onOpenProductionStudio} />
      ) : (
```

  The closing `)}` of the ternary chain and the editor+bible body in the final `(...)` branch are unchanged.

- [ ] Step 5: Run `npx tsc --noEmit`. Expect: errors now only in `GhostWriterApp.tsx` (missing the 4 new required props on `<WritingRoom>`), resolved in Task 5. If `nextAction` is reported unused in `WritingRoom.tsx`, remove it from the import per the note in Step 1.

---

### Task 5: Pass the new props from GhostWriterApp

**Files:**
- Modify: `src/components/GhostWriterApp.tsx:496-508`

- [ ] Step 1: In the `<WritingRoom ... />` call site, add the 4 new props after `onSelectMode={handleSelectMode}`:

```tsx
          <WritingRoom
            project={project}
            activeChap={activeChap}
            updateProject={projectState.updateProject}
            updateChapter={projectState.updateChapter}
            generating={aiActions.generating}
            generate={aiActions.generate}
            onOpenBible={() => setLeftCollapsed(false)}
            onOpenActions={() => setActionsOpen(true)}
            prompt={prompt}
            setPrompt={setPrompt}
            onSelectMode={handleSelectMode}
            onGuideRun={handleGuideRun}
            onGuideDismiss={handleGuideDismiss}
            qualityReview={aiActions.qualityReview}
            onOpenProductionStudio={() => { setShowProductionStudio(true); setActionsOpen(true); }}
          />
```

- [ ] Step 2: Run `npx tsc --noEmit`. Expect: exit 0, no output.

---

### Task 6: Final verification

- [ ] Step 1: Run `npx tsc --noEmit` from the `ghostwriter` directory. Expect: exit 0, no output.

- [ ] Step 2: Run `npx vitest run src/lib/modes/__tests__ src/lib/guide/__tests__`. Expect: same pass counts as Plan 2 (4 files / 39 tests), since this plan adds no new helper logic or tests — only presentational components and prop plumbing.

- [ ] Step 3: Mark this plan doc `> **STATUS: COMPLETE**` with the date and verification evidence (same pattern as Plan 2's doc).

- [ ] Step 4: Update `project-ghostwriter.md` and `MEMORY.md` in the memory directory to record Plan 3 as complete, and report briefly to the user.
