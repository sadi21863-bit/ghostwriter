# Per-Chapter "Plan Next Chapter" Guide Rung — Design Spec

**Status:** Approved design, pre-implementation
**Date:** 2026-07-01

## Context

The Guide Engine (`src/lib/guide/next-action.ts`) drives a priority ladder — `computeAction()` returns the single next suggestion for the Idea → Structure → Draft → Polish → Export flow. Today, the moment any chapter has 0 words, the ladder jumps straight from "Generate outline" to **"Start writing"** — there is no planning step for an individual chapter.

Two planning systems already exist and were the starting point for this design:

1. **Beat Sheet** (`story_plans` table, kind `"beat_sheet"`, `src/app/api/projects/[projectId]/story-plans/route.ts`, `BeatSheetPanel.tsx`) — a whole-story plan: AI-generated or arc-preset-scaffolded beats, each with label/summary/purpose/character+thread links and an optional `chapterId`. Surfaced in the Structure (Shape) stage. Each beat has a "Draft this →" button that hands the beat's summary to the Writer flow via `onSelectMode("write")` + `setPrompt(...)`. The `story_plans` table is deliberately generic/kind-tagged so new plan kinds can join without a migration.

2. **Scene Blueprint** (`src/lib/ai/scene-blueprint.ts`, `buildSceneBlueprint`) — a Haiku pre-pass that turns a next-scene request + story context into a tight GOAL/OBSTACLE/TURN/CHANGE/SENSORY/EXIT blueprint, injected into the Write prompt. Research-backed (eqbench longform, SNAP) as the single biggest lever against generic prose. Currently gated behind the `sceneBlueprint` GrowthBook flag (default OFF), fully ephemeral, and invisible — the user never sees or edits it.

Competitor research (`docs/2026-06-25-competitor-research-all-text-formats.md`) confirms GhostWriter's planning depth is already at parity-or-ahead of Sudowrite/NovelAI (World Bible, promise ledger, scene blueprint). This feature is not a competitive catch-up — it is a UX/workflow win that makes already-built planning machinery visible and actionable at the one place it's currently missing: per-chapter, right before drafting.

## Goals

1. A new Guide rung, `plan-chapter`, that fires when an undrafted chapter has no saved plan yet, offering **Idea** (generate a blueprint) / **Research** (surface what the chapter must honor) / **Skip** (go straight to drafting, today's behavior).
2. The scene blueprint becomes a visible, editable, **persisted** per-chapter artifact instead of an invisible flag-gated pre-pass — reusing the existing `story_plans` table via a new `kind: "chapter_plan"`.
3. Drafting from a saved chapter plan reuses the exact "Draft this →" wiring the Beat Sheet already has — zero new generation plumbing, zero change to `/api/ai/generate`.
4. Fully fail-open and self-limiting: dismissing or erroring out of planning never blocks drafting, and a chapter is offered planning at most until it's either planned or dismissed.

## Non-goals

- No new database table or new zod schema — reuses `story_plans` + `StoryBeat` exactly (one beat per chapter plan).
- No change to the Beat Sheet (`kind: "beat_sheet"`) generation path or panel.
- No change to `/api/ai/generate` or the `sceneBlueprint` flag's existing auto-injection behavior (the mild redundancy when both are on is accepted for v1 — see Known limitation below).
- No auto-firing of chapter planning (AI Initiative "Leads" is out of scope for this rung; it remains a manual Guide suggestion like all other rungs except the existing auto-fire behavior already in `GhostWriterApp`).

## Architecture

### A. Guide ladder — `src/lib/guide/next-action.ts`

`GuideProject` gains one new field:
```ts
export interface GuideProject {
  format: string;
  controllingIdea?: string;
  biggestChallenge?: string;
  characters: { id: string }[];
  chapters: GuideChapter[];
  dismissedGuideIds?: string[];
  plannedChapterIds?: string[]; // NEW — chapterIds with a saved kind:"chapter_plan" story_plans row
}
```

`GuideRunSpec.mode` gains one new pseudo-mode value (alongside the existing `"story_health"`/`"export"` pattern — not a real `GenerationMode`):
```ts
export type GuideRunSpec = {
  mode: GenerationMode | "story_health" | "export" | "plan_chapter";
  prompt?: string;
  chapterId?: string;
};
```

In `computeAction()`, insert a new branch **directly above** the existing `undrafted` draft-rung check. Dismissal is checked **inline** (`!dismissed.includes(...)`), matching the existing `polish-review-manuscript` pattern — this is what makes a dismissed plan-rung fall through to the draft rung below it, rather than just hiding the Guide bar entirely (the difference between the two existing dismissal patterns in this file: `draft-chapter-*`/`keep-writing-*` rungs return unconditionally and rely on `nextAction()`'s outer `dismissed.includes(action.id)` check to hide themselves with no fallthrough, while `polish-review-manuscript`/`export-manuscript` check dismissal inline so `computeAction()` moves on to the next rung. The plan-chapter rung MUST use the inline-check pattern, since "Skip" needs to reveal "Start writing" underneath it, not blank the Guide bar):

```ts
const undrafted = sortedChapters.find((c) => c.wordCount === 0);
if (undrafted) {
  const dismissed = project.dismissedGuideIds ?? [];
  const planned = project.plannedChapterIds ?? [];
  if (!planned.includes(undrafted.id) && !dismissed.includes(`plan-chapter-${undrafted.id}`)) {
    return {
      id: `plan-chapter-${undrafted.id}`,
      stage: "draft",
      message: `Before you draft "${undrafted.title}" — want a quick scene plan?`,
      cta: "Plan this chapter",
      run: { mode: "plan_chapter", chapterId: undrafted.id },
    };
  }
  return {
    id: `draft-chapter-${undrafted.id}`,
    stage: "draft",
    message: `Ready to draft "${undrafted.title}" — let's write the opening scene.`,
    cta: "Start writing",
    run: { mode: "write", prompt: `Write the opening scene for "${undrafted.title}".`, chapterId: undrafted.id },
  };
}
```

**Trigger condition:** fires for **every** undrafted chapter (chapter 1 included — simplest, most consistent), gated by "no saved plan yet" AND "not dismissed." Self-limiting and matches the promise made and approved earlier in this design (Section 3 — "Skip it... falls straight through to Start writing, today's behavior, zero regression"):
- User plans it → a `chapter_plan` row exists for that `chapterId` → `plannedChapterIds` includes it on next render → rung vanishes, draft rung takes over.
- User dismisses it (existing `×` / dismiss mechanism, unchanged) → `plan-chapter-${chapterId}` added to `dismissedGuideIds` → the inline check above is now false → `computeAction()` falls through to return the existing `draft-chapter-${undrafted.id}` rung, exactly as it does today for a chapter with no plan rung at all. Zero regression: a user who always dismisses the plan rung sees identical behavior to before this feature shipped.
- The user can also draft manually via the chapter's "Write" tool at any time regardless of Guide state — the Guide bar is a suggestion layer, never a gate.

### B. Guide dispatch — `src/components/GhostWriterApp.tsx`

`handleGuideRun` (around line 258) gains one new branch, following the existing pattern for `story_health`/`export`:
```ts
const { mode: runMode, prompt: runPrompt, chapterId: runChapterId } = action.run;
if (runMode === "story_health") { setShowStoryHealth(true); return; }
if (runMode === "export") { setShowExport(true); return; }
if (runMode === "plan_chapter") { setChapterPlanChapterId(runChapterId ?? null); setShowChapterPlan(true); return; }
```

`plannedChapterIds` is derived from a `GET /api/projects/[id]/story-plans` fetch (existing endpoint, unchanged signature) already needed to feed the panel — filtered client-side to `kind === "chapter_plan"` and mapped to each plan's single beat's `chapterId`. This fetch is folded into the existing project-load `useEffect` in `GhostWriterApp` (same place `nextAction()`'s other inputs are assembled at line ~128), so `nextAction()` itself stays a pure function with no new fetch inside it — same discipline as every other Guide input.

### C. Route — `src/app/api/projects/[projectId]/story-plans/route.ts` (extend `POST`)

Two new imports required: `chapters` added to the existing `import { projects, storyPlans } from "@/db/schema"` line, and `import { buildSceneBlueprint } from "@/lib/ai/scene-blueprint";`.

One new branch at the top of `POST`, alongside the existing `presetId` arc-preset branch:

```ts
const { prompt = "", title, presetId, kind, chapterId } = await req.json().catch(() => ({}));

if (kind === "chapter_plan") {
  if (!chapterId) return NextResponse.json({ error: "chapterId is required for a chapter plan." }, { status: 400 });
  // The project query above only loads `with: { characters, plotThreads }` — chapters
  // are not included, so look the chapter up directly rather than assuming it's on `project`.
  const chapter = await db.query.chapters.findFirst({
    where: and(eq(chapters.id, chapterId), eq(chapters.projectId, projectId)),
  });
  if (!chapter) return NextResponse.json({ error: "Chapter not found." }, { status: 404 });

  const staticContext = cast.map((c: any) => `${c.name}: ${c.personality ?? ""}`).join("\n");
  const blueprint = await buildSceneBlueprint({
    prompt: prompt || `Plan the next scene for "${chapter.title}".`,
    staticContext,
    format: project.format,
  });
  if (!blueprint) return NextResponse.json({ error: "Couldn't draft a scene plan. Try again." }, { status: 500 });

  const beats = encodeStoryBeats([{
    id: crypto.randomUUID(),
    order: 1,
    label: chapter.title,
    summary: blueprint,
    purpose: "rising",
    characterIds: [],
    threadIds: [],
    chapterId,
  }]);
  const [plan] = await db.insert(storyPlans).values({
    projectId, kind: "chapter_plan", title: `Plan: ${chapter.title}`, beats,
  }).returning();
  return NextResponse.json({ plan });
}
```

`buildSceneBlueprint` is imported from `@/lib/ai/scene-blueprint` (existing export, unchanged signature). The existing `beat_sheet`/`presetId` paths below this branch are completely untouched — this is purely an early-return `if`.

`GET`/`PATCH`/`DELETE` are unchanged — `PATCH` (edit the blueprint text) and `DELETE` (discard a plan) already work generically for any `kind` since they operate on `planId`.

### D. Research pane (derived, not persisted)

When the user picks "Research" in `ChapterPlanPanel`, the panel fetches (client-side, on-demand, not stored):
- `buildPromiseLedger(projectId, "preserve")` — via a small read-only endpoint, OR reuse `story-state`/`story-plans` GET if promise data is already exposed there. **Implementation note for the plan:** the simplest correct option is a tiny new `GET /api/projects/[projectId]/chapter-research?chapterId=` route that returns `{ openPromises: string, priorChapterSummary: string }` — `openPromises` from `buildPromiseLedger(projectId, "preserve")`, `priorChapterSummary` from the previous chapter's existing summary field (already on `GuideChapter`/chapter row). No new AI call — pure DB read + the existing fail-open ledger helper.
- Shown as a read-only info block beside the editable blueprint. Never blocks the Idea/blueprint flow if it fails to load (fetch failure → empty pane, silent).

### E. UI — `src/components/ChapterPlanPanel.tsx` (new)

- Props: `{ projectId: string; chapterId: string; chapterTitle: string; onClose(): void; onSelectMode(mode): void; setPrompt(p: string): void }` — same shape of dependency `BeatSheetPanel` already takes for its "Draft this →" wiring.
- On open: `GET /api/projects/[id]/story-plans`, filter to the `chapter_plan` row for this `chapterId` (if any).
- Empty state: **"Idea"** button (`POST .../story-plans { kind: "chapter_plan", chapterId }`) and **"Research"** button (fetches the research pane, no persistence) and **"Skip"** (calls `onClose()` — the Guide's existing dismiss path already recorded the dismissal before opening this panel is not required, since `onRun` in `GuideBar` doesn't dismiss; the panel's own "Skip" button calls the existing `handleGuideDismiss(action.id)` path via a prop, exactly mirroring the `×` button's behavior).
- Once a plan exists: shows the editable blueprint text (textarea, debounced `PATCH .../story-plans { planId, beats }` matching `BeatSheetPanel`'s existing debounce pattern), the research pane (if fetched), and a **"Draft this chapter →"** button that calls `onSelectMode("write")` + `setPrompt(blueprintText)` + `onClose()` — identical in shape to `BeatSheetPanel`'s per-beat draft button.
- Mounted in `GhostWriterApp` next to the other overlay panels (`showStoryHealth`, `showExport` pattern). **Not** gated by `isStoryFormat` or `isCreatorFormat` — the existing `undrafted`/draft-chapter rung it sits beside in the ladder has no such gate today (creator-format "chapters," e.g. Episodes, already flow through the same draft rung), so the plan-chapter rung follows the same, already-established, format-agnostic behavior for consistency.

## Data flow

```
Guide ladder: undrafted chapter + no chapter_plan → "plan-chapter" rung
  → user clicks "Plan this chapter" → handleGuideRun("plan_chapter") → ChapterPlanPanel opens

ChapterPlanPanel (empty state):
  "Idea"     → POST /story-plans {kind:"chapter_plan", chapterId} → buildSceneBlueprint → one StoryBeat → story_plans row
  "Research" → GET /chapter-research?chapterId= → buildPromiseLedger(preserve) + prior chapter summary → read-only pane
  "Skip"     → handleGuideDismiss(action.id) → dismissedGuideIds → falls through, Guide bar goes quiet for this chapter

ChapterPlanPanel (plan exists):
  edit blueprint → debounced PATCH /story-plans {planId, beats}
  "Draft this chapter →" → onSelectMode("write") + setPrompt(blueprintText) → existing Writer flow (unchanged)

Next Guide render: plannedChapterIds now includes chapterId → plan rung no longer fires → draft rung (if still undrafted) or nothing (if drafted)
```

## Error handling

- `buildSceneBlueprint` returns `""` on any internal error (already fail-open) → POST route returns `500 "Couldn't draft a scene plan. Try again."` — panel shows a retry button, chapter remains undrafted and plannable, nothing is silently lost.
- `chapter-research` fetch failure → research pane renders empty/hidden; blueprint flow is entirely unaffected.
- `story_plans` GET failure in `GhostWriterApp` → `plannedChapterIds` defaults to `[]` → worst case, the plan rung is offered again for an already-planned chapter (safe, non-destructive — user just sees the panel with the existing plan once GET succeeds).
- Corrupt persisted beat → `decodeStoryBeats` is already lenient (drops bad beats) → panel shows empty state, "Idea" button offered again.
- `PATCH` with malformed `beats` → `encodeStoryBeats` throws → existing 400 path, unchanged.

## Known limitation (accepted for v1)

If a user has the `sceneBlueprint` GrowthBook flag ON *and* drafts from a saved chapter plan, they get both the saved plan (via the Write prompt) and the server's own auto-blueprint pre-pass (`buildSceneBlueprint` called again inside `/api/ai/generate`) — mildly redundant since both push the same scene direction from the same underlying helper. Not harmful (both are directionally aligned, not contradictory), and out of scope for v1. A natural follow-up: have `/api/ai/generate` skip its own auto-blueprint call when the incoming prompt already carries a `SCENE BLUEPRINT —` marker line (the exact string `buildSceneBlueprint` already prefixes its output with).

## Testing

1. **Guide ladder** (extend `src/lib/guide/__tests__/next-action.test.ts`):
   - `plan-chapter` rung fires for an undrafted chapter with `plannedChapterIds` not containing its id.
   - `plan-chapter` rung does NOT fire (draft rung fires instead) when `plannedChapterIds` includes the chapter's id.
   - `plan-chapter` rung fires for chapter 1 specifically (no special-casing).
   - Dismissing `plan-chapter-{id}` (via `dismissedGuideIds`) causes `computeAction()`/`nextAction()` to fall through and return the `draft-chapter-{id}` rung instead (not `null`) — matching the inline-dismissal-check pattern used by `polish-review-manuscript`, and confirming zero regression versus pre-feature behavior.
   - `currentStage()` still reports `"draft"` for both the plan-chapter and draft-chapter rungs (no stage-ladder regression).
2. **Route** (extend `src/app/api/projects/[projectId]/story-plans/__tests__/route.test.ts`):
   - POST with `{ kind: "chapter_plan", chapterId }` calls `buildSceneBlueprint` (mocked) and persists one `StoryBeat` with the correct `chapterId`/`label`/`summary`.
   - POST with `kind: "chapter_plan"` and no `chapterId` → 400.
   - POST with `kind: "chapter_plan"` and an unknown `chapterId` → 404.
   - `buildSceneBlueprint` returning `""` → 500, no row inserted.
   - Existing `beat_sheet`/`presetId` paths unchanged (regression check — existing tests must still pass unmodified).
3. **New route** (`src/app/api/projects/[projectId]/chapter-research/__tests__/route.test.ts`): returns `openPromises` from `buildPromiseLedger(projectId, "preserve")` (mocked) + `priorChapterSummary`; ownership 404; fail-open (ledger throwing doesn't 500 the whole research fetch since `buildPromiseLedger` itself is fail-open).
4. **Reachability:** add `ChapterPlanPanel` to `live-shell-reachability.test.ts` MUST_BE_REACHABLE once mounted in `GhostWriterApp`.
5. Full suite + `tsc --noEmit` green; zero change to existing generation behavior, zero change to the Beat Sheet path.

## Files

- Modify: `src/lib/guide/next-action.ts` (+ `plannedChapterIds` on `GuideProject`, `"plan_chapter"` in `GuideRunSpec.mode`, new rung branch in `computeAction()`) + its test
- Modify: `src/app/api/projects/[projectId]/story-plans/route.ts` (+ `chapter_plan` branch in `POST`) + its test
- Create: `src/app/api/projects/[projectId]/chapter-research/route.ts` (+ its test)
- Create: `src/components/ChapterPlanPanel.tsx`
- Modify: `src/components/GhostWriterApp.tsx` (+ `plannedChapterIds` derivation, `plan_chapter` branch in `handleGuideRun`, mount `ChapterPlanPanel`) + reachability test

## Success criteria

- A user hits an undrafted chapter, sees "Plan this chapter" instead of jumping straight to "Start writing," and can generate/edit/draft-from a visible scene blueprint — or skip straight to writing exactly as before.
- The scene blueprint's research-backed planning value (previously invisible and flag-gated) is now a real, user-facing, per-chapter artifact.
- Zero change to the Beat Sheet, `/api/ai/generate`, or any existing test's behavior; `tsc` clean; full suite green.
