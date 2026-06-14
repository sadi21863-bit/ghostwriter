# Phase 3 Plan 4 of 4: Creator Variant Distribution Implementation Plan

> **STATUS: COMPLETE** (2026-06-14) — All 11 tasks executed. `npx tsc --noEmit` exit 0, no errors. `npx vitest run src/lib/modes/__tests__ src/lib/guide/__tests__` → 4 files / 41 tests passed. Phase 3 (§2.1-§2.5 of `ghostwriter-redesign.md`) is now fully complete.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the WritingRoom stage shell creator-aware per §2.5 of `ghostwriter-redesign.md`: fix the Guide ladder so creator-format projects (which never get seeded `characters`) can progress past "Idea", relabel the five stage pills for creator formats (Angle / Outline-Hooks / Script / Retention edit / Publish pack), and surface up to 3 relevant creator tool-panel widgets per stage with a "More →" escape hatch into the existing Actions overlay.

**Architecture:** Two parts. Part A fixes `src/lib/guide/next-action.ts` so `GuideProject` carries `format`, and the "no characters yet → stuck on Idea" check is skipped for creator formats (`isCreatorFormat`). Part B adds creator-only "tool row" JSX to `IdeaStageView`, `StructureStageView`, `PolishStageView`, and the Draft-stage body in `WritingRoom`, each rendering 2-3 already-self-contained tool-panel widgets (e.g. `TrendNichePanel`, `HookABPanel`, `RetentionEditPanel`) plus a "More →" button that opens the existing Actions/ToolbarPanel overlay (which still contains all 16 tools, unchanged). No new overlays, no new flags, no schema changes — same "thin funnel" pattern as Plans 2-3.

**Tech Stack:** React/Next.js (existing `WritingRoom.tsx` stage router + stage view components), TypeScript, existing tool-panel components under `src/components/panels/toolbar/tools/`, `src/lib/formats.ts` (`isCreatorFormat`), `src/lib/guide/next-action.ts`.

---

## Background

### §2.5 of ghostwriter-redesign.md, verbatim

```
### 2.5 Creator variant
If `project.format` is a creator format, the same five stages render with creator labels
(Idea → Angle, Structure → Outline/Hooks, Draft → Script, Polish → Retention edit,
Export → Publish pack) and the 18 creator tool panels are distributed into those stages:
- Angle stage: TrendNiche, TrendAngles, GuestIntel, ChannelAutopsy, Dissect
- Hooks stage: TitleHook, HookAB, ScoreHook, ThumbnailConcepts
- Script stage: TikTokNative, Repurpose, ResearchScaffold
- Retention stage: RetentionEdit, Influence, CreatorSEO, Prose
Each stage shows its tools as at most 3 buttons + "More".
```

**Known discrepancy (not blocking):** the spec says "18 creator tool panels" but names only 16. All 16 named tools were located during research; the spec's own "at most 3 buttons + More" rule means the remainder always has a path via "More →" regardless.

### Why the ladder fix is required first

`POST /api/projects` (`src/app/api/projects/route.ts`) seeds every new project — **regardless of format** — with only a `Chapter 1` row; `controllingIdea` is unset and `characters` is empty. `computeAction()` in `next-action.ts` has:

```ts
if (project.characters.length === 0) {
  return { id: "idea-characters", stage: "idea", ... };
}
```

This means **any** project with zero characters is permanently stuck at stage `"idea"` — including creator-format projects, which never get characters seeded and have no "Story Bible characters" concept in the UI. Without a fix, §2.5's stage distribution is meaningless: creator projects would never reach "Outline/Hooks", "Script", etc. Fix: skip this check when `isCreatorFormat(project.format)`.

### Tool distribution decision (final)

12 of the 16 named tools are fully self-contained "button + own state + own modal + own API call" widgets that self-gate to `null` based on `format`/`mode`/`prompt`/`content` props (confirmed by reading each). These can be mounted a second time in a stage view with zero shared state. The remaining 4 (`Dissect`, `ScoreHook`, `Influence`, `Prose`) need state lifted from `ToolbarPanel`/`useAIActions`/editor-selection and are NOT mounted directly — they remain reachable only via "More →" (the existing Actions overlay, which is unchanged and still contains all 16).

Per-stage selection (≤3 direct + "More →" on every stage, including Script, since some self-gated panels may render `null` depending on live `mode`/`content`):

- **Angle** (`IdeaStageView`): `TrendNichePanel`, `TrendAnglesPanel`, `ChannelAutopsyPanel` + More (covers GuestIntel, Dissect)
- **Outline/Hooks** (`StructureStageView`): `HookABPanel`, `ThumbnailConceptsPanel`, `TitleHookPanel` + More (covers ScoreHook)
- **Script** (`WritingRoom` Draft-stage body, right rail): `TikTokNativePanel`, `RepurposePanel`, `ResearchScaffoldPanel` + More
- **Retention edit** (`PolishStageView`): `RetentionEditPanel`, `CreatorSEOPanel` + More (covers Influence, Prose)
- **Publish pack** (`ExportStageView`): no tools row, per spec

### Scope decision: stage *pill* labels only

§2.5's label remapping (Idea→Angle etc.) is implemented as a `CREATOR_STAGE_LABELS` map applied to the stage-progress pills at the top of `WritingRoom`. The in-page section headers inside each stage view (e.g. `IdeaStageView`'s "Premise" heading) are left unchanged — they read fine for creator content too ("Premise" = the video's angle/premise, "Structure" = the outline) and changing them would widen the diff without functional benefit. Consistent with Plan 3's precedent of favoring thin funnels over rewrites.

### Known limitation, documented not fixed

`REVIEW_THRESHOLD = 500` (words) gates the Polish/Retention stage. Short-form creator formats (TikTok Script, Instagram Reel, ~150 words) may never cross this threshold and could perpetually sit in "draft"/Script via the `keep-writing-*` branch, rarely reaching Retention/Publish. This is a known limitation of the existing ladder, out of scope for this plan (changing `REVIEW_THRESHOLD` risks the 39 passing tests in `next-action.test.ts` and is a separate design decision).

---

## File Structure

- Modify: `src/lib/guide/next-action.ts` — add `format: string` to `GuideProject`; skip the `characters.length === 0` branch for creator formats.
- Modify: `src/lib/guide/__tests__/next-action.test.ts` — add `format: "Novel"` to the `base` fixture and the two fixtures that don't use `base`; add 2 new tests for creator-format ladder behavior.
- Modify: `src/components/WritingRoom.tsx` — add `CREATOR_STAGE_LABELS`, select labels by `isCreatorFormat(project.format)`, pass `format` to `currentStage()`, accept 3 new props (`mode`, `setSavedMsg`, `onUpgradeRequired`), thread new props to stage views, add a "Script tools" row to the Draft-stage right rail.
- Modify: `src/components/GhostWriterApp.tsx` — add `format: project?.format ?? ""` to the `nextAction()` call (+ dependency), pass `mode`, `setSavedMsg`, `onUpgradeRequired` to `<WritingRoom>`.
- Modify: `src/components/stages/IdeaStageView.tsx` — add Angle tools row (TrendNiche, TrendAngles, ChannelAutopsy + More), accept `prompt`, `setPrompt`, `onUpgradeRequired`, `onOpenActions`.
- Modify: `src/components/stages/StructureStageView.tsx` — add Outline/Hooks tools row (HookAB, ThumbnailConcepts, TitleHook + More) to both return branches, accept `prompt`, `mode`, `topic`, `setSavedMsg`, `onUpgradeRequired`, `onOpenActions`.
- Modify: `src/components/stages/PolishStageView.tsx` — add Retention tools row (RetentionEdit, CreatorSEO + More), accept `mode`, `content`, `updateProject`, `setSavedMsg`, `onUpgradeRequired`, `onOpenActions`; add `format` to its `nextAction()` call.
- Modify: `src/components/stages/ExportStageView.tsx` — add `format` to its `nextAction()` call only (no UI change).

---

## Tasks

### Task 1: Fix the Guide ladder for creator-format projects

**Files:**
- Modify: `src/lib/guide/next-action.ts`

- [ ] Step 1: Add the import and extend `GuideProject`. Change:

```ts
import type { GenerationMode } from "@/lib/modes/registry";
```

to:

```ts
import type { GenerationMode } from "@/lib/modes/registry";
import { isCreatorFormat } from "@/lib/formats";
```

  and change:

```ts
export interface GuideProject {
  controllingIdea?: string;
  characters: { id: string }[];
  chapters: GuideChapter[];
  dismissedGuideIds?: string[];
}
```

  to:

```ts
export interface GuideProject {
  format: string;
  controllingIdea?: string;
  characters: { id: string }[];
  chapters: GuideChapter[];
  dismissedGuideIds?: string[];
}
```

- [ ] Step 2: Skip the characters check for creator formats. Change:

```ts
  if (project.characters.length === 0) {
    return {
      id: "idea-characters",
      stage: "idea",
      message: "You have a premise — now sketch your main characters.",
      cta: "Brainstorm characters",
      run: { mode: "brainstorm", prompt: `Suggest 3 main characters (name, role, core want and need) for this story: ${project.controllingIdea}` },
    };
  }
```

  to:

```ts
  if (project.characters.length === 0 && !isCreatorFormat(project.format)) {
    return {
      id: "idea-characters",
      stage: "idea",
      message: "You have a premise — now sketch your main characters.",
      cta: "Brainstorm characters",
      run: { mode: "brainstorm", prompt: `Suggest 3 main characters (name, role, core want and need) for this story: ${project.controllingIdea}` },
    };
  }
```

- [ ] Step 3: Run `npx tsc --noEmit` from the `ghostwriter` directory. Expect: new errors at every call site that constructs a `GuideProject`-shaped object without `format` — `next-action.test.ts`, `WritingRoom.tsx`, `GhostWriterApp.tsx`, `PolishStageView.tsx`, `ExportStageView.tsx`. These are fixed in Tasks 2-6.

---

### Task 2: Add `format` to the test fixtures and add creator-format ladder tests

**Files:**
- Modify: `src/lib/guide/__tests__/next-action.test.ts`

- [ ] Step 1: Add `format` to the shared `base` fixture. Change:

```ts
const base: GuideProject = {
  controllingIdea: "",
  characters: [],
  chapters: [],
  dismissedGuideIds: [],
};
```

  to:

```ts
const base: GuideProject = {
  format: "Novel",
  controllingIdea: "",
  characters: [],
  chapters: [],
  dismissedGuideIds: [],
};
```

- [ ] Step 2: Add `format: "Novel"` to the two `getContinueChapterId` fixtures that don't spread `base`. In the `"returns the action's chapterId when the Guide's suggestion targets a chapter"` test, change:

```ts
    const action = nextAction({
      controllingIdea: "Premise.",
      characters: [{ id: "char-1" }],
      chapters,
      dismissedGuideIds: [],
    });
```

  to:

```ts
    const action = nextAction({
      format: "Novel",
      controllingIdea: "Premise.",
      characters: [{ id: "char-1" }],
      chapters,
      dismissedGuideIds: [],
    });
```

  In the `"falls back to the first chapter by sortOrder when the action has no chapterId"` test, change:

```ts
    const action = nextAction({
      controllingIdea: "",
      characters: [],
      chapters,
      dismissedGuideIds: [],
    });
```

  to:

```ts
    const action = nextAction({
      format: "Novel",
      controllingIdea: "",
      characters: [],
      chapters,
      dismissedGuideIds: [],
    });
```

- [ ] Step 3: Add two new tests to the `describe("nextAction", ...)` block, immediately after the `"suggests brainstorming characters once a premise exists but no characters"` test (after its closing `});` around line 25):

```ts
  it("skips the characters check for creator-format projects and goes straight to outlining", () => {
    const action = nextAction({
      ...base,
      format: "YouTube Long-form",
      controllingIdea: "A productivity channel premise.",
      characters: [],
      chapters: [{ id: "ch-1", title: "Chapter 1", wordCount: 0, sortOrder: 0 }],
    });
    expect(action?.id).toBe("structure-outline");
    expect(action?.stage).toBe("structure");
  });

  it("still requires characters for non-creator formats with the same premise", () => {
    const action = nextAction({
      ...base,
      format: "Novel",
      controllingIdea: "A productivity channel premise.",
      characters: [],
      chapters: [{ id: "ch-1", title: "Chapter 1", wordCount: 0, sortOrder: 0 }],
    });
    expect(action?.id).toBe("idea-characters");
    expect(action?.stage).toBe("idea");
  });
```

- [ ] Step 4: Run `npx tsc --noEmit`. Expect: errors remaining only in `WritingRoom.tsx`, `GhostWriterApp.tsx`, `PolishStageView.tsx`, `ExportStageView.tsx` (the non-test call sites), fixed in Tasks 3-6.

- [ ] Step 5: Run `npx vitest run src/lib/guide/__tests__`. Expect: FAIL at this point (the non-test call sites don't compile yet is a `tsc` concern, not a `vitest` one — but if `tsc` errors block this, that's expected; otherwise expect 6 files / 41 tests passed, i.e. the original 39 plus these 2 new ones). If `vitest` runs despite the `tsc` errors elsewhere (it type-checks per-file via esbuild, not project-wide), this should already be 41/41 green. Either way, don't block on the other files' `tsc` errors — they're addressed next.

---

### Task 3: Thread `format` through `GhostWriterApp.tsx`'s `nextAction()` call

**Files:**
- Modify: `src/components/GhostWriterApp.tsx:126-131`

- [ ] Step 1: Change:

```ts
  const guideAction = useMemo(() => nextAction({
    controllingIdea: project?.controllingIdea,
    characters: project?.characters || [],
    chapters: project?.chapters || [],
    dismissedGuideIds: project?.dismissedGuideIds,
  }), [project?.controllingIdea, project?.characters, project?.chapters, project?.dismissedGuideIds]);
```

  to:

```ts
  const guideAction = useMemo(() => nextAction({
    format: project?.format ?? "",
    controllingIdea: project?.controllingIdea,
    characters: project?.characters || [],
    chapters: project?.chapters || [],
    dismissedGuideIds: project?.dismissedGuideIds,
  }), [project?.format, project?.controllingIdea, project?.characters, project?.chapters, project?.dismissedGuideIds]);
```

- [ ] Step 2: Run `npx tsc --noEmit`. Expect: this file's `nextAction` error is gone; errors remain in `WritingRoom.tsx`, `PolishStageView.tsx`, `ExportStageView.tsx` plus new errors in `GhostWriterApp.tsx` once `<WritingRoom>`'s props are extended in Task 7 (not yet — at this point `GhostWriterApp.tsx` should have no NEW errors beyond what existed before this task).

---

### Task 4: Thread `format` through `PolishStageView.tsx` and `ExportStageView.tsx`

**Files:**
- Modify: `src/components/stages/PolishStageView.tsx`
- Modify: `src/components/stages/ExportStageView.tsx`

- [ ] Step 1: In `PolishStageView.tsx`, change:

```ts
  const action = nextAction({
    controllingIdea: project.controllingIdea,
    characters: project.characters || [],
    chapters: project.chapters || [],
    dismissedGuideIds: project.dismissedGuideIds,
  })!;
```

  to:

```ts
  const action = nextAction({
    format: project.format,
    controllingIdea: project.controllingIdea,
    characters: project.characters || [],
    chapters: project.chapters || [],
    dismissedGuideIds: project.dismissedGuideIds,
  })!;
```

- [ ] Step 2: In `ExportStageView.tsx`, apply the identical change (same `nextAction({...})` shape, add `format: project.format,` as the first field).

- [ ] Step 3: Run `npx tsc --noEmit`. Expect: errors remain only in `WritingRoom.tsx` (its own `currentStage()` call, fixed in Task 5).

---

### Task 5: Thread `format` through `WritingRoom.tsx`'s `currentStage()` call and add `CREATOR_STAGE_LABELS`

**Files:**
- Modify: `src/components/WritingRoom.tsx`

- [ ] Step 1: Update the `formats` import. Change:

```ts
import { getChapterLabel } from "@/lib/formats";
```

  to:

```ts
import { getChapterLabel, isCreatorFormat } from "@/lib/formats";
```

- [ ] Step 2: Add `format` to the `currentStage()` call. Change:

```ts
  const stage = currentStage({
    controllingIdea: project.controllingIdea,
    characters: project.characters || [],
    chapters: project.chapters || [],
    dismissedGuideIds: project.dismissedGuideIds,
  });
```

  to:

```ts
  const stage = currentStage({
    format: project.format,
    controllingIdea: project.controllingIdea,
    characters: project.characters || [],
    chapters: project.chapters || [],
    dismissedGuideIds: project.dismissedGuideIds,
  });
```

- [ ] Step 3: Add `CREATOR_STAGE_LABELS` and select between the two label maps. Change:

```ts
const STAGE_LABELS: Record<GuideStage, string> = {
  idea: "Idea",
  structure: "Structure",
  draft: "Draft",
  polish: "Polish",
  export: "Export",
};
```

  to:

```ts
const STAGE_LABELS: Record<GuideStage, string> = {
  idea: "Idea",
  structure: "Structure",
  draft: "Draft",
  polish: "Polish",
  export: "Export",
};

const CREATOR_STAGE_LABELS: Record<GuideStage, string> = {
  idea: "Angle",
  structure: "Outline/Hooks",
  draft: "Script",
  polish: "Retention edit",
  export: "Publish pack",
};
```

- [ ] Step 4: In the render, select the label map and use it for the pills. Change:

```tsx
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
```

  to:

```tsx
        <div style={{ display: "flex", gap: 4, fontSize: 11 }}>
          {STAGE_ORDER.map((s, i) => (
            <span key={s} style={{
              padding: "2px 8px", borderRadius: 6,
              fontWeight: i === stageIdx ? 700 : 400,
              color: i < stageIdx ? co.green : i === stageIdx ? co.accent : co.muted,
              background: i === stageIdx ? co.accentBg : "transparent",
            }}>
              {i < stageIdx ? "✓ " : ""}{stageLabels[s]}
            </span>
          ))}
        </div>
```

  and add the `stageLabels` selection just above the `return (` statement (after `handleEditorChange`):

```ts
  const stageLabels = isCreatorFormat(project.format) ? CREATOR_STAGE_LABELS : STAGE_LABELS;
```

- [ ] Step 5: Run `npx tsc --noEmit`. Expect: exit 0, no output (all `GuideProject`/`format` errors resolved).

---

### Task 6: Add 3 new props to `WritingRoomProps` and thread them from `GhostWriterApp`

**Files:**
- Modify: `src/components/WritingRoom.tsx`
- Modify: `src/components/GhostWriterApp.tsx`

- [ ] Step 1: In `WritingRoom.tsx`, extend `WritingRoomProps`. Add these 3 lines immediately after `onOpenProductionStudio: () => void;`:

```ts
  mode: string;
  setSavedMsg: (msg: string) => void;
  onUpgradeRequired: (feature: string) => void;
```

- [ ] Step 2: Destructure the new props. Change:

```ts
export default function WritingRoom({
  project, activeChap, updateProject, updateChapter,
  generating, generate, onOpenBible, onOpenActions,
  prompt, setPrompt, onSelectMode,
  onGuideRun, onGuideDismiss, qualityReview, onOpenProductionStudio,
}: WritingRoomProps) {
```

  to:

```ts
export default function WritingRoom({
  project, activeChap, updateProject, updateChapter,
  generating, generate, onOpenBible, onOpenActions,
  prompt, setPrompt, onSelectMode,
  onGuideRun, onGuideDismiss, qualityReview, onOpenProductionStudio,
  mode, setSavedMsg, onUpgradeRequired,
}: WritingRoomProps) {
```

- [ ] Step 3: In `GhostWriterApp.tsx`, add the 3 props to the `<WritingRoom>` call site (`GhostWriterApp.tsx:496-512`). Change:

```tsx
            onGuideRun={handleGuideRun}
            onGuideDismiss={handleGuideDismiss}
            qualityReview={aiActions.qualityReview}
            onOpenProductionStudio={() => { setShowProductionStudio(true); setActionsOpen(true); }}
          />
```

  to:

```tsx
            onGuideRun={handleGuideRun}
            onGuideDismiss={handleGuideDismiss}
            qualityReview={aiActions.qualityReview}
            onOpenProductionStudio={() => { setShowProductionStudio(true); setActionsOpen(true); }}
            mode={mode}
            setSavedMsg={setSavedMsg}
            onUpgradeRequired={(f) => setUpgradeRequired(f as FeatureGate)}
          />
```

- [ ] Step 4: Run `npx tsc --noEmit`. Expect: exit 0, no output. (The new props aren't consumed yet in this task — `mode`, `setSavedMsg`, `onUpgradeRequired` will show as "declared but never read" only if `noUnusedParameters`/`noUnusedLocals` is on; if `tsc` reports unused-variable errors here, that's expected to resolve once Tasks 7-10 consume them. If it does error and blocks progress, proceed to Task 7 immediately — don't add placeholder usages.)

---

### Task 7: Add the Angle tools row to `IdeaStageView`

**Files:**
- Modify: `src/components/stages/IdeaStageView.tsx`
- Modify: `src/components/WritingRoom.tsx`

- [ ] Step 1: In `IdeaStageView.tsx`, add imports. Change:

```tsx
// src/components/stages/IdeaStageView.tsx
"use client";
import { useState } from "react";
import { co, sBtn, sBtnSm, sTextarea } from "@/lib/styles";
```

  to:

```tsx
// src/components/stages/IdeaStageView.tsx
"use client";
import { useState } from "react";
import { co, sBtn, sBtnSm, sTextarea } from "@/lib/styles";
import { isCreatorFormat } from "@/lib/formats";
import { TrendNichePanel } from "@/components/panels/toolbar/tools/TrendNichePanel";
import { TrendAnglesPanel } from "@/components/panels/toolbar/tools/TrendAnglesPanel";
import { ChannelAutopsyPanel } from "@/components/panels/toolbar/tools/ChannelAutopsyPanel";
```

- [ ] Step 2: Extend `IdeaStageViewProps` and the function signature. Change:

```tsx
interface IdeaStageViewProps {
  project: any;
  updateProject: (fn: (p: any) => any) => void;
  onOpenBible: () => void;
}

export default function IdeaStageView({ project, updateProject, onOpenBible }: IdeaStageViewProps) {
```

  to:

```tsx
interface IdeaStageViewProps {
  project: any;
  updateProject: (fn: (p: any) => any) => void;
  onOpenBible: () => void;
  prompt: string;
  setPrompt: (value: string) => void;
  onUpgradeRequired: (feature: string) => void;
  onOpenActions: () => void;
}

export default function IdeaStageView({ project, updateProject, onOpenBible, prompt, setPrompt, onUpgradeRequired, onOpenActions }: IdeaStageViewProps) {
```

- [ ] Step 3: Add the Angle tools row at the end of the content `<div>`, immediately before the closing `</div>` of `<div style={{ maxWidth: 560, width: "100%" }}>` (i.e. after the `editing ? (...) : (...)` block's closing `)}`):

```tsx
        {isCreatorFormat(project.format) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 20, paddingTop: 16, borderTop: `1px solid ${co.border}` }}>
            <TrendNichePanel format={project.format} projectId={project.id} setPrompt={setPrompt} onUpgradeRequired={onUpgradeRequired} />
            <TrendAnglesPanel format={project.format} prompt={prompt} setPrompt={setPrompt} onUpgradeRequired={onUpgradeRequired} />
            <ChannelAutopsyPanel format={project.format} onUpgradeRequired={onUpgradeRequired} />
            <button style={sBtnSm} onClick={onOpenActions}>More →</button>
          </div>
        )}
```

- [ ] Step 4: In `WritingRoom.tsx`, pass the new props at the `IdeaStageView` call site. Change:

```tsx
      {stage === "idea" ? (
        <IdeaStageView project={project} updateProject={updateProject} onOpenBible={onOpenBible} />
      ) : stage === "structure" ? (
```

  to:

```tsx
      {stage === "idea" ? (
        <IdeaStageView project={project} updateProject={updateProject} onOpenBible={onOpenBible} prompt={prompt} setPrompt={setPrompt} onUpgradeRequired={onUpgradeRequired} onOpenActions={onOpenActions} />
      ) : stage === "structure" ? (
```

- [ ] Step 5: Run `npx tsc --noEmit`. Expect: exit 0, no output.

---

### Task 8: Add the Outline/Hooks tools row to `StructureStageView`

**Files:**
- Modify: `src/components/stages/StructureStageView.tsx`
- Modify: `src/components/WritingRoom.tsx`

- [ ] Step 1: Add imports. Change:

```tsx
// src/components/stages/StructureStageView.tsx
"use client";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import { parseBeatList } from "@/lib/modes/beats";
import type { GenerationMode } from "@/lib/modes/registry";
```

  to:

```tsx
// src/components/stages/StructureStageView.tsx
"use client";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import { parseBeatList } from "@/lib/modes/beats";
import type { GenerationMode } from "@/lib/modes/registry";
import { isCreatorFormat } from "@/lib/formats";
import { HookABPanel } from "@/components/panels/toolbar/tools/HookABPanel";
import { ThumbnailConceptsPanel } from "@/components/panels/toolbar/tools/ThumbnailConceptsPanel";
import { TitleHookPanel } from "@/components/panels/toolbar/tools/TitleHookPanel";
```

- [ ] Step 2: Extend `StructureStageViewProps` and the function signature. Change:

```tsx
interface StructureStageViewProps {
  project: any;
  setPrompt: (value: string) => void;
  onSelectMode: (mode: GenerationMode) => void;
}

export default function StructureStageView({ project, setPrompt, onSelectMode }: StructureStageViewProps) {
```

  to:

```tsx
interface StructureStageViewProps {
  project: any;
  setPrompt: (value: string) => void;
  onSelectMode: (mode: GenerationMode) => void;
  prompt: string;
  mode: string;
  topic: string;
  setSavedMsg: (msg: string) => void;
  onUpgradeRequired: (feature: string) => void;
  onOpenActions: () => void;
}

export default function StructureStageView({ project, setPrompt, onSelectMode, prompt, mode, topic, setSavedMsg, onUpgradeRequired, onOpenActions }: StructureStageViewProps) {
```

- [ ] Step 3: Add the tools row to the "no outline yet" branch. Change:

```tsx
  if (!beats) {
    return (
      <div style={{ flex: 1, overflow: "auto", padding: "32px 24px", display: "flex", justifyContent: "center" }}>
        <div style={{ maxWidth: 560, width: "100%", textAlign: "center", paddingTop: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
            Structure
          </div>
          <p style={{ fontSize: 14, color: co.muted, lineHeight: 1.6, marginBottom: 16 }}>
            No outline yet. Generate a chapter-by-chapter beat list to map out the story before you start drafting.
          </p>
          <button style={sBtn} onClick={handleGenerateOutline}>Generate outline →</button>
        </div>
      </div>
    );
  }
```

  to:

```tsx
  if (!beats) {
    return (
      <div style={{ flex: 1, overflow: "auto", padding: "32px 24px", display: "flex", justifyContent: "center" }}>
        <div style={{ maxWidth: 560, width: "100%", textAlign: "center", paddingTop: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
            Structure
          </div>
          <p style={{ fontSize: 14, color: co.muted, lineHeight: 1.6, marginBottom: 16 }}>
            No outline yet. Generate a chapter-by-chapter beat list to map out the story before you start drafting.
          </p>
          <button style={sBtn} onClick={handleGenerateOutline}>Generate outline →</button>
          {isCreatorFormat(project.format) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 20 }}>
              <HookABPanel format={project.format} projectId={project.id} onUpgradeRequired={onUpgradeRequired} />
              <ThumbnailConceptsPanel format={project.format} onUpgradeRequired={onUpgradeRequired} />
              <TitleHookPanel format={project.format} mode={mode} prompt={prompt} topic={topic} setSavedMsg={setSavedMsg} onUpgradeRequired={onUpgradeRequired} />
              <button style={sBtnSm} onClick={onOpenActions}>More →</button>
            </div>
          )}
        </div>
      </div>
    );
  }
```

- [ ] Step 4: Add the same tools row to the main (beats-exist) branch, after the "Regenerate outline" button. Change:

```tsx
        <button style={{ ...sBtnSm, marginTop: 16 }} onClick={handleGenerateOutline}>Regenerate outline</button>
      </div>
    </div>
  );
}
```

  to:

```tsx
        <button style={{ ...sBtnSm, marginTop: 16 }} onClick={handleGenerateOutline}>Regenerate outline</button>
        {isCreatorFormat(project.format) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 20, paddingTop: 16, borderTop: `1px solid ${co.border}` }}>
            <HookABPanel format={project.format} projectId={project.id} onUpgradeRequired={onUpgradeRequired} />
            <ThumbnailConceptsPanel format={project.format} onUpgradeRequired={onUpgradeRequired} />
            <TitleHookPanel format={project.format} mode={mode} prompt={prompt} topic={topic} setSavedMsg={setSavedMsg} onUpgradeRequired={onUpgradeRequired} />
            <button style={sBtnSm} onClick={onOpenActions}>More →</button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] Step 5: In `WritingRoom.tsx`, pass the new props at the `StructureStageView` call site. Change:

```tsx
      ) : stage === "structure" ? (
        <StructureStageView project={project} setPrompt={setPrompt} onSelectMode={onSelectMode} />
      ) : stage === "polish" ? (
```

  to:

```tsx
      ) : stage === "structure" ? (
        <StructureStageView project={project} setPrompt={setPrompt} onSelectMode={onSelectMode} prompt={prompt} mode={mode} topic={activeChap.title} setSavedMsg={setSavedMsg} onUpgradeRequired={onUpgradeRequired} onOpenActions={onOpenActions} />
      ) : stage === "polish" ? (
```

- [ ] Step 6: Run `npx tsc --noEmit`. Expect: exit 0, no output.

---

### Task 9: Add the Retention tools row to `PolishStageView`

**Files:**
- Modify: `src/components/stages/PolishStageView.tsx`
- Modify: `src/components/WritingRoom.tsx`

- [ ] Step 1: Add imports. Change:

```tsx
// src/components/stages/PolishStageView.tsx
"use client";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import { nextAction, type GuideAction } from "@/lib/guide/next-action";
import type { QualityReview } from "@/components/panels/QualityReviewPanel";
```

  to:

```tsx
// src/components/stages/PolishStageView.tsx
"use client";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import { nextAction, type GuideAction } from "@/lib/guide/next-action";
import type { QualityReview } from "@/components/panels/QualityReviewPanel";
import { isCreatorFormat } from "@/lib/formats";
import { RetentionEditPanel } from "@/components/panels/toolbar/tools/RetentionEditPanel";
import { CreatorSEOPanel } from "@/components/panels/toolbar/tools/CreatorSEOPanel";
```

- [ ] Step 2: Extend `PolishStageViewProps` and the function signature. Change:

```tsx
interface PolishStageViewProps {
  project: any;
  qualityReview: QualityReview | null;
  onGuideRun: (action: GuideAction) => void;
  onGuideDismiss: (id: string) => void;
}

export default function PolishStageView({ project, qualityReview, onGuideRun, onGuideDismiss }: PolishStageViewProps) {
```

  to:

```tsx
interface PolishStageViewProps {
  project: any;
  qualityReview: QualityReview | null;
  onGuideRun: (action: GuideAction) => void;
  onGuideDismiss: (id: string) => void;
  mode: string;
  content: string;
  updateProject: (fn: (p: any) => any) => void;
  setSavedMsg: (msg: string) => void;
  onUpgradeRequired: (feature: string) => void;
  onOpenActions: () => void;
}

export default function PolishStageView({ project, qualityReview, onGuideRun, onGuideDismiss, mode, content, updateProject, setSavedMsg, onUpgradeRequired, onOpenActions }: PolishStageViewProps) {
```

- [ ] Step 3: Add the Retention tools row after the existing CTA buttons. Change:

```tsx
        <div style={{ display: "flex", gap: 8 }}>
          <button style={sBtn} onClick={() => onGuideRun(action)}>Open full story health report →</button>
          <button style={sBtnSm} onClick={() => onGuideDismiss(action.id)}>Mark as reviewed</button>
        </div>
      </div>
    </div>
  );
}
```

  to:

```tsx
        <div style={{ display: "flex", gap: 8 }}>
          <button style={sBtn} onClick={() => onGuideRun(action)}>Open full story health report →</button>
          <button style={sBtnSm} onClick={() => onGuideDismiss(action.id)}>Mark as reviewed</button>
        </div>

        {isCreatorFormat(project.format) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 16, paddingTop: 16, borderTop: `1px solid ${co.border}` }}>
            <RetentionEditPanel format={project.format} mode={mode} content={content} setSavedMsg={setSavedMsg} updateProject={updateProject} onUpgradeRequired={onUpgradeRequired} />
            <CreatorSEOPanel format={project.format} mode={mode} content={content} onUpgradeRequired={onUpgradeRequired} />
            <button style={sBtnSm} onClick={onOpenActions}>More →</button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] Step 4: In `WritingRoom.tsx`, pass the new props at the `PolishStageView` call site. Change:

```tsx
      ) : stage === "polish" ? (
        <PolishStageView project={project} qualityReview={qualityReview} onGuideRun={onGuideRun} onGuideDismiss={onGuideDismiss} />
      ) : stage === "export" ? (
```

  to:

```tsx
      ) : stage === "polish" ? (
        <PolishStageView project={project} qualityReview={qualityReview} onGuideRun={onGuideRun} onGuideDismiss={onGuideDismiss} mode={mode} content={activeChap.content} updateProject={updateProject} setSavedMsg={setSavedMsg} onUpgradeRequired={onUpgradeRequired} onOpenActions={onOpenActions} />
      ) : stage === "export" ? (
```

- [ ] Step 5: Run `npx tsc --noEmit`. Expect: exit 0, no output.

---

### Task 10: Add the Script tools row to the Draft-stage right rail in `WritingRoom`

**Files:**
- Modify: `src/components/WritingRoom.tsx`

- [ ] Step 1: Add imports for the 3 Script-stage tool panels. Change:

```ts
import { currentStage, STAGE_ORDER, type GuideStage, type GuideAction } from "@/lib/guide/next-action";
```

  to (keep this line as-is) and instead add the new imports immediately after the existing `import ExportStageView from "@/components/stages/ExportStageView";` line:

```ts
import ExportStageView from "@/components/stages/ExportStageView";
import { TikTokNativePanel } from "@/components/panels/toolbar/tools/TikTokNativePanel";
import { RepurposePanel } from "@/components/panels/toolbar/tools/RepurposePanel";
import { ResearchScaffoldPanel } from "@/components/panels/toolbar/tools/ResearchScaffoldPanel";
```

- [ ] Step 2: Add the Script tools section to the right rail, before the `BibleSection` components. Change:

```tsx
            {bibleOpen && (
              <div style={{ flex: 1, overflow: "auto", padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 14 }}>
                <BibleSection title="Characters" items={(project.characters || []).map((c: any) => c.name)} />
                <BibleSection title="Locations" items={(project.locations || []).map((l: any) => l.name)} />
                <BibleSection title="Threads" items={(project.plotThreads || []).map((t: any) => t.name)} />
                <button style={{ ...sBtnSm, marginTop: "auto" }} onClick={onOpenBible}>Open bible →</button>
              </div>
            )}
```

  to:

```tsx
            {bibleOpen && (
              <div style={{ flex: 1, overflow: "auto", padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 14 }}>
                {isCreatorFormat(project.format) && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Script tools</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <TikTokNativePanel format={project.format} onUpgradeRequired={onUpgradeRequired} />
                      <RepurposePanel format={project.format} mode={mode} content={activeChap.content} niche={project.creatorBible?.niche} channelVoice={project.creatorBible?.channelVoice} setSavedMsg={setSavedMsg} updateProject={updateProject} onUpgradeRequired={onUpgradeRequired} />
                      <ResearchScaffoldPanel format={project.format} mode={mode} prompt={prompt} topic={activeChap.title} setSavedMsg={setSavedMsg} updateProject={updateProject} onUpgradeRequired={onUpgradeRequired} />
                      <button style={sBtnSm} onClick={onOpenActions}>More →</button>
                    </div>
                  </div>
                )}
                <BibleSection title="Characters" items={(project.characters || []).map((c: any) => c.name)} />
                <BibleSection title="Locations" items={(project.locations || []).map((l: any) => l.name)} />
                <BibleSection title="Threads" items={(project.plotThreads || []).map((t: any) => t.name)} />
                <button style={{ ...sBtnSm, marginTop: "auto" }} onClick={onOpenBible}>Open bible →</button>
              </div>
            )}
```

- [ ] Step 3: Run `npx tsc --noEmit`. Expect: exit 0, no output.

---

### Task 11: Final verification

- [ ] Step 1: Run `npx tsc --noEmit` from the `ghostwriter` directory. Expect: exit 0, no output.

- [ ] Step 2: Run `npx vitest run src/lib/modes/__tests__ src/lib/guide/__tests__`. Expect: 6 files / 41 tests passed (the original 39 from Plan 2/3, plus the 2 new creator-ladder tests from Task 2).

- [ ] Step 3: Mark this plan doc `> **STATUS: COMPLETE**` with the date and verification evidence (same pattern as Plans 2-3's docs).

- [ ] Step 4: Update `project-ghostwriter.md` and `MEMORY.md` in the memory directory to record Plan 4 (and therefore all of Phase 3) as complete, and report briefly to the user. Note in memory that Phase 3 (§2.1-§2.5) is now fully done, and that Phases 4-5 remain.
