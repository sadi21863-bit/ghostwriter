# Studio Phase 2 — Per-Tool Deep-Link Routing (Sub-project A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route 4 Story Graph capabilities that currently fall into the generic Actions-drawer catch-all — `tension_curve`, `arc_heatmap`, `prose_fix`, `editor_review` — directly to their existing UI (a pre-selected tab in `StoryInsightsPanel`/`StoryHealthPanel`, or the Polish stage), from both the Studio route's URL-based deep link and a direct click inside the writing room.

**Architecture:** `capabilityAction()` gains 3 new `CapabilityActionResult` variants for these 4 capability ids. Both existing consumers (`studioDeepLink()` for the Studio → writing-room URL round trip, `StageRoleRail` for direct in-writing-room clicks) get new branches handling those variants. Two state owners: `tension_curve`/`arc_heatmap`/`editor_review` state lives in `WritingRoom` itself (self-contained for direct clicks, 2 new incoming props for the deep-link path); `prose_fix`'s `showStoryHealth` state lives in `GhostWriterApp` (1 new outgoing prop bubbles direct clicks up, the deep-link path is already native there).

**Tech Stack:** TypeScript, Next.js App Router, React, Vitest, Playwright.

## Global Constraints

- `villain_pov` and `refine` are explicitly OUT OF SCOPE — both have zero UI today, deferred to future sub-projects B/C. No task in this plan touches them; `refine`'s existing `openActions` test case (`src/lib/capabilities/__tests__/actions.test.ts`, `it("any other tool → openActions", ...)` using `id: "refine"`) MUST still pass unmodified after this plan.
- Zero change to any of the 5 already-working `CapabilityActionResult` outcomes (`selectMode`, `openComicStudio`, `openProductionStudio`, `openActions`, plus `upgrade`/`hint`/`noop`).
- The `editor_review`/creator-format visibility gap (registry says `story_and_creator`, `EditorNotesPanel` is gated by `isStoryFormat`) is a known, accepted limitation — do NOT fix it in this plan.
- Missing or unrecognized `?tab=` values must fall through to a safe default (`"arc"` for insights), never be passed through as an invalid string to a component prop.
- The existing one-shot query-param scrub (`window.history.replaceState(null, "", window.location.pathname)` in `GhostWriterApp`'s dispatch `useEffect`) already strips all query params after dispatch — no new scrub code needed.
- `StoryInsightsPanel`/`StoryHealthPanel` are conditionally rendered (`insightsOpen && (...)` / `showStoryHealth && (...)`), so changing `initialTab` while already open needs a `key` prop to force a remount — both mounts must use `key={<tab-state>}`.
- No new database tables, no new API routes, no new dependencies.
- TDD for all pure-logic tasks (Tasks 1, 2); UI/wiring tasks (3-6) have no isolated unit tests, matching this codebase's established convention for these exact files — verified via `tsc --noEmit` and the E2E task (Task 7).

---

### Task 1: `capabilityAction()` — 3 new action types

**Files:**
- Modify: `src/lib/capabilities/actions.ts`
- Test: `src/lib/capabilities/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: nothing new — pure function, same `Capability`/`CapabilityAvailability` inputs.
- Produces: `CapabilityActionResult` gains `{ type: "openInsights"; tab: "arc" | "tension" }`, `{ type: "openStoryHealth"; tab: "validator" }`, `{ type: "openPolishStage" }` — Tasks 2 and 4 both consume these exact type names/shapes.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/capabilities/__tests__/actions.test.ts`, inside the existing `describe("capabilityAction", ...)` block (after the last `it(...)`, before the closing `});`):

```ts
  it("tension_curve → openInsights with tab 'tension'", () => {
    const c = cap({ kind: "tool", id: "tension_curve" });
    expect(capabilityAction(c, AVAIL)).toEqual({ type: "openInsights", tab: "tension" });
  });

  it("arc_heatmap → openInsights with tab 'arc'", () => {
    const c = cap({ kind: "tool", id: "arc_heatmap" });
    expect(capabilityAction(c, AVAIL)).toEqual({ type: "openInsights", tab: "arc" });
  });

  it("prose_fix → openStoryHealth with tab 'validator'", () => {
    const c = cap({ kind: "tool", id: "prose_fix" });
    expect(capabilityAction(c, AVAIL)).toEqual({ type: "openStoryHealth", tab: "validator" });
  });

  it("editor_review → openPolishStage", () => {
    const c = cap({ kind: "tool", id: "editor_review" });
    expect(capabilityAction(c, AVAIL)).toEqual({ type: "openPolishStage" });
  });

  it("refine is unaffected — still falls through to openActions", () => {
    const c = cap({ kind: "tool", id: "refine" });
    expect(capabilityAction(c, AVAIL)).toEqual({ type: "openActions" });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```
npx vitest run src/lib/capabilities/__tests__/actions.test.ts
```
Expected: the 5 new tests FAIL (the 4 new capability ids currently fall through to `openActions`; the `refine` test passes already but is included as an explicit regression guard).

- [ ] **Step 3: Add the 3 new variants and branches**

In `src/lib/capabilities/actions.ts`, replace the `CapabilityActionResult` type:

```ts
export type CapabilityActionResult =
  | { type: "upgrade"; gate: FeatureGate }
  | { type: "hint"; reason: "missing_segmind_key" | "missing_openai_key" }
  | { type: "selectMode"; mode: string }
  | { type: "openComicStudio" }
  | { type: "openProductionStudio" }
  | { type: "openInsights"; tab: "arc" | "tension" }
  | { type: "openStoryHealth"; tab: "validator" }
  | { type: "openPolishStage" }
  | { type: "openActions" }
  | { type: "noop" };
```

Add a new map constant after the existing `PRODUCTION_TOOL_IDS` line:

```ts
const INSIGHTS_TAB_MAP: Record<string, "arc" | "tension"> = {
  arc_heatmap: "arc",
  tension_curve: "tension",
};
```

Replace the body of `capabilityAction()`:

```ts
export function capabilityAction(cap: Capability, availability: CapabilityAvailability): CapabilityActionResult {
  if (!availability.available) {
    if (availability.reason === "upgrade_required" && cap.gate) return { type: "upgrade", gate: cap.gate };
    if (availability.reason === "missing_segmind_key") return { type: "hint", reason: "missing_segmind_key" };
    if (availability.reason === "missing_openai_key") return { type: "hint", reason: "missing_openai_key" };
    return { type: "noop" };
  }
  if (cap.kind === "mode") return { type: "selectMode", mode: cap.id };
  if (cap.id === "comic_generate") return { type: "openComicStudio" };
  if (PRODUCTION_TOOL_IDS.has(cap.id)) return { type: "openProductionStudio" };
  if (cap.id in INSIGHTS_TAB_MAP) return { type: "openInsights", tab: INSIGHTS_TAB_MAP[cap.id] };
  if (cap.id === "prose_fix") return { type: "openStoryHealth", tab: "validator" };
  if (cap.id === "editor_review") return { type: "openPolishStage" };
  return { type: "openActions" };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```
npx vitest run src/lib/capabilities/__tests__/actions.test.ts
```
Expected: all tests PASS (5 new + all pre-existing tests in the file, unmodified).

- [ ] **Step 5: Run typecheck**

```
npx tsc --noEmit
```
Expected: no errors (existing `switch (action.type)` blocks in `studio-deeplink.ts`/`StageRoleRail.tsx` will now show non-exhaustive-switch warnings if strict exhaustiveness is enforced there, but since neither uses a `default: assertNever(action)` pattern today, this will NOT fail typecheck yet — Tasks 2 and 4 add the missing cases).

- [ ] **Step 6: Commit**

```bash
git add src/lib/capabilities/actions.ts src/lib/capabilities/__tests__/actions.test.ts
git commit -m "feat: add openInsights/openStoryHealth/openPolishStage capability actions"
```

---

### Task 2: `studioDeepLink()` — 3 new query-string branches

**Files:**
- Modify: `src/lib/graph/studio-deeplink.ts`
- Test: `src/lib/graph/__tests__/studio-deeplink.test.ts`

**Interfaces:**
- Consumes: `CapabilityActionResult`'s `openInsights`/`openStoryHealth`/`openPolishStage` variants from Task 1.
- Produces: `studioDeepLink(projectId, action)` returns `/project/{id}?studioOpen=insights&tab={tab}`, `/project/{id}?studioOpen=story-health&tab=validator`, `/project/{id}?studioOpen=polish` for these 3 action types — Task 6 (`GhostWriterApp`'s dispatch) parses exactly these query shapes.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/graph/__tests__/studio-deeplink.test.ts`, inside the existing `describe("studioDeepLink", ...)` block (after the last `it(...)`, before the closing `});`):

```ts
  it("builds a studioOpen=insights&tab=tension param for openInsights (tension)", () => {
    expect(studioDeepLink("proj1", { type: "openInsights", tab: "tension" }))
      .toBe("/project/proj1?studioOpen=insights&tab=tension");
  });
  it("builds a studioOpen=insights&tab=arc param for openInsights (arc)", () => {
    expect(studioDeepLink("proj1", { type: "openInsights", tab: "arc" }))
      .toBe("/project/proj1?studioOpen=insights&tab=arc");
  });
  it("builds a studioOpen=story-health&tab=validator param for openStoryHealth", () => {
    expect(studioDeepLink("proj1", { type: "openStoryHealth", tab: "validator" }))
      .toBe("/project/proj1?studioOpen=story-health&tab=validator");
  });
  it("builds a studioOpen=polish param for openPolishStage", () => {
    expect(studioDeepLink("proj1", { type: "openPolishStage" }))
      .toBe("/project/proj1?studioOpen=polish");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```
npx vitest run src/lib/graph/__tests__/studio-deeplink.test.ts
```
Expected: the 4 new tests FAIL — TypeScript will actually refuse to compile the test file until Step 3 lands (the `switch` in `studioDeepLink` doesn't have cases for the new action types, so passing them is a type error against the current `CapabilityActionResult` union) OR, since the union already includes them after Task 1, the `switch` falls through with no matching `case` and no `default`, making the function return `undefined` implicitly for those 3 new types — either way, the tests fail as expected.

- [ ] **Step 3: Add the 3 new cases**

In `src/lib/graph/studio-deeplink.ts`, replace the `switch` body inside `studioDeepLink()`:

```ts
export function studioDeepLink(projectId: string, action: CapabilityActionResult): string | null {
  const base = `/project/${projectId}`;
  switch (action.type) {
    case "selectMode": return `${base}?studioMode=${encodeURIComponent(action.mode)}`;
    case "openComicStudio": return `${base}?studioOpen=comic`;
    case "openProductionStudio": return `${base}?studioOpen=production`;
    case "openInsights": return `${base}?studioOpen=insights&tab=${action.tab}`;
    case "openStoryHealth": return `${base}?studioOpen=story-health&tab=${action.tab}`;
    case "openPolishStage": return `${base}?studioOpen=polish`;
    case "openActions": return `${base}?studioOpen=actions`;
    case "upgrade":
    case "hint":
    case "noop":
      return null;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```
npx vitest run src/lib/graph/__tests__/studio-deeplink.test.ts
```
Expected: all tests PASS (4 new + all pre-existing tests in the file, unmodified).

- [ ] **Step 5: Run typecheck**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/graph/studio-deeplink.ts src/lib/graph/__tests__/studio-deeplink.test.ts
git commit -m "feat: add insights/story-health/polish query params to studioDeepLink"
```

---

### Task 3: `StoryInsightsPanel` + `StoryHealthPanel` — `initialTab` prop

**Files:**
- Modify: `src/components/StoryInsightsPanel.tsx`
- Modify: `src/components/panels/StoryHealthPanel.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `StoryInsightsPanel` accepts an optional `initialTab?: "arc" | "tension" | "relationships"` prop; `StoryHealthPanel` accepts an optional `initialTab?: "validator" | "dead-scenes" | "theme" | "tension" | "transport" | "promises" | "heatmap" | "checkpoints" | "audit"` prop. Both default to their current hardcoded initial tab when the prop is omitted — Tasks 5 and 6 pass these props in.

This task has no isolated unit test — matches this codebase's established pattern for these two files (neither has a test file today; verified by typecheck + the E2E task).

- [ ] **Step 1: Add `initialTab` to `StoryInsightsPanel`**

In `src/components/StoryInsightsPanel.tsx`, replace the `Props` interface and the function signature/first line:

```ts
interface Props {
  projectId: string;
  initialTab?: Tab;
}

export function StoryInsightsPanel({ projectId, initialTab }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "arc");
```

(The `type Tab = "arc" | "tension" | "relationships";` declaration above `Props` is unchanged — `initialTab` reuses it.)

- [ ] **Step 2: Add `initialTab` to `StoryHealthPanel`**

In `src/components/panels/StoryHealthPanel.tsx`, replace the `StoryHealthPanelProps` interface and the function signature/first line:

```ts
interface StoryHealthPanelProps {
  project: any;
  projectId: string;
  activeChapContent: string;
  onClose: () => void;
  onApplyFix?: (content: string) => void;
  initialTab?: "validator" | "dead-scenes" | "theme" | "tension" | "transport" | "promises" | "heatmap" | "checkpoints" | "audit";
}

export function StoryHealthPanel({ project, projectId, activeChapContent, onClose, onApplyFix, initialTab }: StoryHealthPanelProps) {
  const [tab, setTab] = useState<"validator" | "dead-scenes" | "theme" | "tension" | "transport" | "promises" | "heatmap" | "checkpoints" | "audit">(initialTab ?? "validator");
```

- [ ] **Step 3: Run typecheck**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/StoryInsightsPanel.tsx src/components/panels/StoryHealthPanel.tsx
git commit -m "feat: add initialTab prop to StoryInsightsPanel and StoryHealthPanel"
```

---

### Task 4: `StageRoleRail` — direct-click routing for the 3 new action types

**Files:**
- Modify: `src/components/StageRoleRail.tsx`

**Interfaces:**
- Consumes: `CapabilityActionResult`'s `openInsights`/`openStoryHealth`/`openPolishStage` variants from Task 1.
- Produces: `StageRoleRailProps` gains `onOpenInsights: (tab: "arc" | "tension") => void`, `onOpenStoryHealth: (tab: "validator") => void`, `onOpenPolishStage: () => void` — Task 5 (`WritingRoom`) passes these in at all 3 mount points.

This task has no isolated unit test — matches this codebase's established pattern (no test file exists for `StageRoleRail.tsx` today; verified by typecheck + the E2E task).

- [ ] **Step 1: Add the 3 new props and switch cases**

In `src/components/StageRoleRail.tsx`, replace the `StageRoleRailProps` interface:

```ts
interface StageRoleRailProps {
  funnelStage: FunnelStage;
  format: string;
  onSelectMode: (mode: GenerationMode) => void;
  onOpenActions: () => void;
  onOpenComicStudio: () => void;
  onOpenProductionStudio: () => void;
  onOpenInsights: (tab: "arc" | "tension") => void;
  onOpenStoryHealth: (tab: "validator") => void;
  onOpenPolishStage: () => void;
  onUpgradeRequired: (feature: string) => void;
}
```

Replace the function signature's destructured params:

```ts
export default function StageRoleRail({
  funnelStage, format,
  onSelectMode, onOpenActions, onOpenComicStudio, onOpenProductionStudio,
  onOpenInsights, onOpenStoryHealth, onOpenPolishStage,
  onUpgradeRequired,
}: StageRoleRailProps) {
```

Replace the `switch (action.type)` block inside `handle()`:

```ts
    const action = capabilityAction(cap, { available: cap.available, reason: cap.reason });
    switch (action.type) {
      case "selectMode": onSelectMode(action.mode as GenerationMode); break;
      case "openComicStudio": onOpenComicStudio(); break;
      case "openProductionStudio": onOpenProductionStudio(); break;
      case "openInsights": onOpenInsights(action.tab); break;
      case "openStoryHealth": onOpenStoryHealth(action.tab); break;
      case "openPolishStage": onOpenPolishStage(); break;
      case "openActions": onOpenActions(); break;
      case "upgrade": onUpgradeRequired(action.gate); break;
      case "hint":
        toast.info(action.reason === "missing_segmind_key"
          ? "Add your Segmind API key in Settings to use this."
          : "Add your OpenAI API key in Settings to use this.");
        break;
      case "noop": break;
    }
```

- [ ] **Step 2: Run typecheck**

```
npx tsc --noEmit
```
Expected: errors will appear in `src/components/WritingRoom.tsx` (the 3 existing `<StageRoleRail .../>` mounts are now missing 3 required props) — this is expected; Task 5 fixes it. Confirm the errors are ONLY in `WritingRoom.tsx` and reference the 3 new prop names, not any other unrelated error.

- [ ] **Step 3: Commit**

```bash
git add src/components/StageRoleRail.tsx
git commit -m "feat: wire openInsights/openStoryHealth/openPolishStage into StageRoleRail"
```

---

### Task 5: `WritingRoom` — local state, deep-link props, and StageRoleRail wiring

**Files:**
- Modify: `src/components/WritingRoom.tsx`

**Interfaces:**
- Consumes: `StoryInsightsPanel`'s `initialTab` prop (Task 3); `StageRoleRail`'s `onOpenInsights`/`onOpenStoryHealth`/`onOpenPolishStage` props (Task 4).
- Produces: `WritingRoomProps` gains `deepLinkInsightsTab?: "arc" | "tension" | null`, `deepLinkStage?: GuideStage | null`, `onOpenStoryHealth: (tab: "validator") => void` — Task 6 (`GhostWriterApp`) passes the first two in and consumes the third.

This task has no isolated unit test — matches this codebase's established pattern for `WritingRoom.tsx` (no test file exists today; verified by typecheck + the E2E task, Task 7).

- [ ] **Step 1: Add the 3 new props to `WritingRoomProps` and the destructured params**

In `src/components/WritingRoom.tsx`, replace the `WritingRoomProps` interface (currently ending with `addChapter: () => Promise<void>;`):

```ts
interface WritingRoomProps {
  project: any;
  activeChap: any;
  updateProject: (fn: (p: any) => any) => void;
  updateChapter: (field: string, value: any) => void;
  generating: boolean;
  generate: (opts?: { insertViaEditor?: (text: string) => void; editorStream?: { start: () => void; delta: (t: string) => void; end: (full: string) => void } }) => Promise<void>;
  onOpenBible: () => void;
  onOpenActions: () => void;
  prompt: string;
  setPrompt: (value: string) => void;
  onSelectMode: (mode: GenerationMode) => void;
  onGuideRun: (action: GuideAction) => void;
  onGuideDismiss: (id: string) => void;
  qualityReview: QualityReview | null;
  onOpenProductionStudio: () => void;
  onOpenComicStudio: () => void;
  onOpenStoryHealth: (tab: "validator") => void;
  deepLinkInsightsTab?: "arc" | "tension" | null;
  deepLinkStage?: GuideStage | null;
  mode: string;
  setSavedMsg: (msg: string) => void;
  onUpgradeRequired: (feature: string) => void;
  onRegisterInsert?: (fn: (text: string) => void) => void;
  activeInfluence?: WorkPacket | null;
  onClearInfluence?: () => void;
  addChapter: () => Promise<void>;
}
```

Replace the function signature's destructured params:

```ts
export default function WritingRoom({
  project, activeChap, updateProject, updateChapter,
  generating, generate, onOpenBible, onOpenActions,
  prompt, setPrompt, onSelectMode,
  onGuideRun, onGuideDismiss, qualityReview, onOpenProductionStudio, onOpenComicStudio,
  onOpenStoryHealth, deepLinkInsightsTab, deepLinkStage,
  mode, setSavedMsg, onUpgradeRequired, onRegisterInsert,
  activeInfluence, onClearInfluence, addChapter,
}: WritingRoomProps) {
```

- [ ] **Step 2: Add local `insightsTab` state and the two deep-link `useEffect`s**

Add a new `useState` after the existing `const [insightsOpen, setInsightsOpen] = useState(false);` line:

```ts
  const [insightsTab, setInsightsTab] = useState<"arc" | "tension">("arc");
```

Add two new `useEffect`s after the existing `onRegisterInsert` `useEffect` (the one that registers `editorRef.current?.insertContent`):

```ts
  useEffect(() => {
    if (deepLinkInsightsTab) {
      setInsightsOpen(true);
      setInsightsTab(deepLinkInsightsTab);
    }
  }, [deepLinkInsightsTab]);

  useEffect(() => {
    if (deepLinkStage) {
      goToStage(deepLinkStage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkStage]);
```

`goToStage` is declared further down in the component body (after `stage`/`funnelStage`/`funnelIdx` are computed) — since this is a function component, hoisting order in the source doesn't affect runtime behavior as long as `goToStage` is defined before this `useEffect` actually RUNS (effects run after the full render, once all `const` declarations in the function body have executed), so placing this `useEffect` here (before `goToStage`'s own declaration further down) is safe. The eslint-disable comment matches the existing pattern already used in `GhostWriterApp.tsx`'s own deep-link dispatch effect for the same reason (referencing a function without listing it in the deps array, since it's stable within a render).

- [ ] **Step 3: Wire the 3 new callbacks into all 3 `StageRoleRail` mounts**

Replace all 3 existing `<StageRoleRail .../>` lines (in the `stage === "idea"`, `stage === "structure"`, and `guideStageToFunnel(stage) === "produce"` branches) with versions that add the 3 new props. The `idea` branch:

```tsx
            <StageRoleRail funnelStage="discover" format={project.format} onSelectMode={onSelectMode} onOpenActions={onOpenActions} onOpenComicStudio={onOpenComicStudio} onOpenProductionStudio={onOpenProductionStudio} onOpenInsights={(tab) => { setInsightsOpen(true); setInsightsTab(tab); }} onOpenStoryHealth={onOpenStoryHealth} onOpenPolishStage={() => goToStage("polish")} onUpgradeRequired={onUpgradeRequired} />
```

The `structure` branch:

```tsx
            <StageRoleRail funnelStage="shape" format={project.format} onSelectMode={onSelectMode} onOpenActions={onOpenActions} onOpenComicStudio={onOpenComicStudio} onOpenProductionStudio={onOpenProductionStudio} onOpenInsights={(tab) => { setInsightsOpen(true); setInsightsTab(tab); }} onOpenStoryHealth={onOpenStoryHealth} onOpenPolishStage={() => goToStage("polish")} onUpgradeRequired={onUpgradeRequired} />
```

The `produce` branch:

```tsx
            <StageRoleRail funnelStage="produce" format={project.format} onSelectMode={onSelectMode} onOpenActions={onOpenActions} onOpenComicStudio={onOpenComicStudio} onOpenProductionStudio={onOpenProductionStudio} onOpenInsights={(tab) => { setInsightsOpen(true); setInsightsTab(tab); }} onOpenStoryHealth={onOpenStoryHealth} onOpenPolishStage={() => goToStage("polish")} onUpgradeRequired={onUpgradeRequired} />
```

- [ ] **Step 4: Pass `initialTab` + `key` into the `StoryInsightsPanel` mount**

Replace the existing insights mount:

```tsx
            {insightsOpen && (
              <div style={{ marginTop: 8 }}>
                <StoryInsightsPanel projectId={project.id} />
              </div>
            )}
```

with:

```tsx
            {insightsOpen && (
              <div style={{ marginTop: 8 }}>
                <StoryInsightsPanel key={insightsTab} projectId={project.id} initialTab={insightsTab} />
              </div>
            )}
```

- [ ] **Step 5: Run typecheck**

```
npx tsc --noEmit
```
Expected: errors will appear in `src/components/GhostWriterApp.tsx` (the single `<WritingRoom .../>` mount is now missing the required `onOpenStoryHealth` prop) — expected; Task 6 fixes it. Confirm no errors remain within `WritingRoom.tsx` itself.

- [ ] **Step 6: Commit**

```bash
git add src/components/WritingRoom.tsx
git commit -m "feat: wire insights/story-health/polish-stage deep-link routing into WritingRoom"
```

---

### Task 6: `GhostWriterApp` — dispatch branches, new state, and prop threading

**Files:**
- Modify: `src/components/GhostWriterApp.tsx`

**Interfaces:**
- Consumes: `studioDeepLink()`'s new query-param shapes (Task 2, for reference — this task reads the URL directly, doesn't call `studioDeepLink` itself); `WritingRoom`'s `deepLinkInsightsTab`/`deepLinkStage`/`onOpenStoryHealth` props (Task 5); `StoryHealthPanel`'s `initialTab` prop (Task 3).
- Produces: nothing new for later tasks — this is the final integration point for the deep-link path.

This task has no isolated unit test — matches this codebase's established pattern for `GhostWriterApp.tsx` (no test file exists today; verified by typecheck + the E2E task, Task 7).

- [ ] **Step 1: Import `GuideStage`**

In `src/components/GhostWriterApp.tsx`, replace the existing `next-action` import line:

```ts
import { nextAction, type GuideAction, type GuideStage } from "@/lib/guide/next-action";
```

- [ ] **Step 2: Add 3 new `useState` declarations**

Add after the existing `const [chapterPlanChapterId, setChapterPlanChapterId] = useState<string | null>(null);` line:

```ts
  const [deepLinkInsightsTab, setDeepLinkInsightsTab] = useState<"arc" | "tension" | null>(null);
  const [deepLinkStage, setDeepLinkStage] = useState<GuideStage | null>(null);
  const [storyHealthInitialTab, setStoryHealthInitialTab] = useState<"validator" | "dead-scenes" | "theme" | "tension" | "transport" | "promises" | "heatmap" | "checkpoints" | "audit">("validator");
```

- [ ] **Step 3: Add 3 new branches to the existing dispatch `useEffect`**

Replace the existing dispatch `useEffect` body:

```ts
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const studioMode = params.get("studioMode");
    const studioOpen = params.get("studioOpen");
    if (studioMode) {
      setMode(studioMode);
      setActionsOpen(true);
    } else if (studioOpen === "comic") {
      setShowComicStudio(true);
      setActionsOpen(true);
    } else if (studioOpen === "production") {
      setShowProductionStudio(true);
      setActionsOpen(true);
    } else if (studioOpen === "insights") {
      const tab = params.get("tab");
      setDeepLinkInsightsTab(tab === "arc" || tab === "tension" ? tab : "arc");
    } else if (studioOpen === "story-health") {
      setStoryHealthInitialTab("validator");
      setShowStoryHealth(true);
    } else if (studioOpen === "polish") {
      setDeepLinkStage("polish");
    } else if (studioOpen === "actions") {
      setActionsOpen(true);
    }
    window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 4: Add `onOpenStoryHealth` to `handleSlashCommand`'s sibling — pass a bound callback into `WritingRoom`, and add the 3 new props to the `<WritingRoom .../>` mount**

Replace the existing `<WritingRoom .../>` mount:

```tsx
      <WritingRoom
        project={project}
        activeChap={activeChap}
        updateProject={projectState.updateProject}
        updateChapter={projectState.updateChapter}
        generating={aiActions.generating}
        generate={aiActions.generate}
        onOpenBible={() => setStoryBibleOpen(true)}
        onOpenActions={() => setActionsOpen(true)}
        prompt={prompt}
        setPrompt={setPrompt}
        onSelectMode={handleSelectMode}
        onGuideRun={handleGuideRun}
        onGuideDismiss={handleGuideDismiss}
        qualityReview={aiActions.qualityReview}
        onOpenProductionStudio={() => { setShowProductionStudio(true); setActionsOpen(true); }}
        onOpenComicStudio={() => { setShowComicStudio(true); setActionsOpen(true); }}
        onOpenStoryHealth={(tab) => { setStoryHealthInitialTab(tab); setShowStoryHealth(true); }}
        deepLinkInsightsTab={deepLinkInsightsTab}
        deepLinkStage={deepLinkStage}
        mode={mode}
        setSavedMsg={setSavedMsg}
        onUpgradeRequired={(f) => setUpgradeRequired(f as FeatureGate)}
        onRegisterInsert={(fn) => { insertIntoEditorRef.current = fn; }}
        activeInfluence={activeInfluence}
        onClearInfluence={() => setActiveInfluence(null)}
        addChapter={projectState.addChapter}
      />
```

- [ ] **Step 5: Add `key` + `initialTab` to the `StoryHealthPanel` mount**

Replace the existing mount:

```tsx
      {showStoryHealth && (
        <StoryHealthPanel
          project={project}
          projectId={project.id}
          activeChapContent={activeChap?.content || ""}
          onClose={() => setShowStoryHealth(false)}
          onApplyFix={(content: string) => projectState.updateChapter("content", content)}
        />
      )}
```

with:

```tsx
      {showStoryHealth && (
        <StoryHealthPanel
          key={storyHealthInitialTab}
          project={project}
          projectId={project.id}
          activeChapContent={activeChap?.content || ""}
          onClose={() => setShowStoryHealth(false)}
          onApplyFix={(content: string) => projectState.updateChapter("content", content)}
          initialTab={storyHealthInitialTab}
        />
      )}
```

- [ ] **Step 6: Run typecheck**

```
npx tsc --noEmit
```
Expected: no errors anywhere in the project.

- [ ] **Step 7: Run the full test suite**

```
npm test
```
Expected: all tests pass, no regressions.

- [ ] **Step 8: Commit**

```bash
git add src/components/GhostWriterApp.tsx
git commit -m "feat: dispatch insights/story-health/polish deep links in GhostWriterApp"
```

---

### Task 7: E2E verification — all 4 deep-link paths, live

**Files:**
- Modify: `e2e/studio-phase1.spec.ts`

**Interfaces:**
- Consumes: the full deep-link path built in Tasks 1-6 (`?studioOpen=insights&tab=tension`, `?studioOpen=insights&tab=arc`, `?studioOpen=story-health&tab=validator`, `?studioOpen=polish`).
- Produces: nothing for later tasks — this is the final verification.

- [ ] **Step 1: Add the 4 new deep-link checks**

In `e2e/studio-phase1.spec.ts`, update the doc-comment header — replace:

```ts
 *  7. ?studioOpen=comic deep-link opens Comic Studio in the Actions drawer
 *  8. ?studioOpen=production deep-link opens Production Studio in the Actions drawer
 */
```

with:

```ts
 *  7. ?studioOpen=comic deep-link opens Comic Studio in the Actions drawer
 *  8. ?studioOpen=production deep-link opens Production Studio in the Actions drawer
 *  9. ?studioOpen=insights&tab=tension deep-link opens Story Insights on the Tension Curve tab
 *  10. ?studioOpen=insights&tab=arc deep-link opens Story Insights on the Character Arc tab
 *  11. ?studioOpen=story-health&tab=validator deep-link opens Story Health on the Scene Validator tab
 *  12. ?studioOpen=polish deep-link switches the writing room to the Polish stage
 */
```

Add 4 new blocks after the existing `?studioOpen=production` check (after `expect(page.url()).not.toContain("studioOpen");` and before the closing `});` of the `test(...)` block):

All 3 tab buttons in `StoryInsightsPanel` (Arc/Tension/Relationships) are always rendered regardless of which is active — only their `background-color` differs (`co.accent` = `#818cf8` solid when active, `"transparent"` — which browsers compute as `rgba(0, 0, 0, 0)` — when inactive, per `src/components/StoryInsightsPanel.tsx`'s `background: tab === t.id ? co.accent : "transparent"`). So merely checking a tab button is *visible* would pass regardless of which tab the deep link actually selected (all 3 are always in the DOM) — the assertion must check background-color specifically to prove `initialTab` took effect rather than defaulting:

```ts
    // ── 8. ?studioOpen=insights&tab=tension deep link ─────────────────────────
    await page.goto(`/project/${projectId}?studioOpen=insights&tab=tension`, { waitUntil: "load", timeout: 90_000 });
    const tensionTabBtn = page.getByRole("button", { name: "Tension Curve" });
    const arcTabBtn = page.getByRole("button", { name: "Character Arc" });
    await expect(tensionTabBtn).toBeVisible({ timeout: 20_000 });
    // The deep-linked tab (tension) must be the ACTIVE one (non-transparent bg);
    // the default tab (arc) must be inactive (transparent) — proves the deep
    // link overrode StoryInsightsPanel's own default rather than merely opening
    // the panel with its usual "arc" starting tab.
    await expect(tensionTabBtn).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(arcTabBtn).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    expect(page.url()).not.toContain("studioOpen");

    // ── 9. ?studioOpen=insights&tab=arc deep link ──────────────────────────────
    await page.goto(`/project/${projectId}?studioOpen=insights&tab=arc`, { waitUntil: "load", timeout: 90_000 });
    const arcTabBtn2 = page.getByRole("button", { name: "Character Arc" });
    await expect(arcTabBtn2).toBeVisible({ timeout: 20_000 });
    // "arc" is StoryInsightsPanel's own default, so this alone can't prove the
    // deep link (vs. the default) drove it — check 8 already proved the
    // non-default "tension" case works, which is the meaningful discriminator.
    await expect(arcTabBtn2).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    expect(page.url()).not.toContain("studioOpen");

    // ── 10. ?studioOpen=story-health&tab=validator deep link ───────────────────
    // "validator" is StoryHealthPanel's own pre-existing default tab, so — unlike
    // check 8 — this can't prove the tab param itself took effect vs. defaulting.
    // What IS new and worth proving: ?studioOpen=story-health opens StoryHealthPanel
    // at all via a Studio deep link, which was not possible before this plan (the
    // only prior path was the in-session slash command).
    await page.goto(`/project/${projectId}?studioOpen=story-health&tab=validator`, { waitUntil: "load", timeout: 90_000 });
    await expect(page.getByRole("button", { name: "Scene Validator" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Declare 2\+ purposes/i)).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toContain("studioOpen");

    // ── 11. ?studioOpen=polish deep link ────────────────────────────────────────
    await page.goto(`/project/${projectId}?studioOpen=polish`, { waitUntil: "load", timeout: 90_000 });
    // The Produce funnel stage pill (which covers both Polish and Export in the
    // 4-stage funnel view) should be highlighted; PolishStageView's own content
    // (the "Editor Review" section from EditorNotesPanel) should be reachable.
    await expect(page.getByText(/Editor Review/i)).toBeVisible({ timeout: 20_000 });
    expect(page.url()).not.toContain("studioOpen");
```

- [ ] **Step 2: Run the full E2E test live against a running dev server**

```
E2E_TEST_EMAIL=<existing-test-account-email> E2E_TEST_PASSWORD=<existing-test-account-password> npx playwright test e2e/studio-phase1.spec.ts --timeout=180000 --reporter=list
```
Expected: `1 passed`. If the exact `"rgba(0, 0, 0, 0)"` string doesn't match this Next.js/React version's computed style output, run `page.evaluate(() => getComputedStyle(document.querySelector('button')).backgroundColor)` against a known-inactive tab button first to confirm the real transparent-background string, then use that exact value — do not loosen the assertion back to a mere visibility check, since (per the comment above) that would make the check pass regardless of which tab is actually active.

- [ ] **Step 3: Run the full unit/integration suite**

```
npm test
```
Expected: all tests pass, no regressions.

- [ ] **Step 4: Run typecheck one final time**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add e2e/studio-phase1.spec.ts
git commit -m "test(e2e): verify insights/story-health/polish-stage deep-link paths"
```
