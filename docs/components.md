# Components

UI component hierarchy, how the panel system works, and how writing modes connect to API routes.

---

## Top-Level App Shell

```
src/app/project/[projectId]/page.tsx
  └─ GhostWriterApp.tsx  ← root component for the editor
      └─ WritingRoom.tsx  ← the ONE shell (see "WritingRoom" section below)
          └─ ToolbarPanel.tsx  ← reused on-demand as Actions-drawer content, not a second shell
```

`GhostWriterApp.tsx` holds the central state: which project, which chapter is open, which mode is selected, the current generation output, and the top-level dispatch `useEffect` that reads Studio deep-link query params on mount (see "Studio Route + Capability Deep-Link Routing" in `docs/architecture.md`).

**As of 2026-06-29 (commit `119fce2`), `WritingRoom` is the only shell** — the legacy always-visible `ToolbarPanel`-driven layout and the legacy `panels/ChapterEditor.tsx` panel system described in older versions of this doc were hard-deleted, along with the `writingRoomShell` GrowthBook flag. `ToolbarPanel` itself still exists and is still mounted, but only as the content of an on-demand Actions-drawer overlay inside `WritingRoom` — there is no parallel always-visible three-column layout anymore. See `docs/product-history.md` for why the redesign shipped as a second shell first and what the removal involved.

All AI calls go through `useAIActions(...)`, a thin composition of 5 hooks in `src/hooks/` (`useGeneration`, `useEntitySync`, `usePipelines`, `useProseTools`, plus the shared `ai-shared.ts` fetch wrapper) — see "Client-Side Hooks" in `docs/architecture.md` for the breakdown.

---

## Writing Mode Panels: `src/components/panels/toolbar/modes/`

Each panel component is self-contained: it manages its own form state, calls its API route, and renders the result. No shared state needed.

### Anatomy of a Mode Panel

Taking `WritePanel.tsx` as example:

```tsx
export function WritePanel({ projectId, chapterId }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [options, setOptions] = useState({ tone: "neutral", length: "medium" });

  async function generate() {
    setLoading(true);
    const res = await fetch("/api/ai/generate", {
      method: "POST",
      body: JSON.stringify({ projectId, chapterId, mode: "write", ...options })
    });
    const data = await res.json();
    if (res.ok) setResult(data.text);
    setLoading(false);
  }

  return (
    <div>
      {/* options UI */}
      <button onClick={generate} disabled={loading}>Generate</button>
      {result && <ResultDisplay text={result} onInsert={...} />}
    </div>
  );
}
```

All panels follow this shape:
1. Local form state for generation options
2. `fetch()` to the appropriate route
3. Loading state during generation
4. Result display with "Insert into chapter" button

---

## Creator Tool Panels: `src/components/panels/toolbar/tools/`

Same pattern as writing mode panels but calling creator tool routes:

| Panel | Route called |
|---|---|
| `TikTokNativePanel.tsx` | `/api/ai/tiktok-native` |
| `HookABPanel.tsx` | `/api/ai/hook-ab` |
| `DissectPanel.tsx` | `/api/ai/dissect-video` (+ polling `/status/[jobId]`) |
| `TrendAnglesPanel.tsx` | `/api/ai/trend-angles` |
| `ChannelAutopsyPanel.tsx` | `/api/ai/channel-autopsy` |
| `GuestIntelPanel.tsx` | `/api/ai/guest-intel` |
| `RetentionEditPanel.tsx` | `/api/ai/retention-edit` |
| `CreatorSEOPanel.tsx` | `/api/ai/creator-seo` |
| `RepurposePanel.tsx` | `/api/ai/repurpose` |
| `ScoreHookPanel.tsx` | `/api/ai/score-hook` |
| `TitleHookPanel.tsx` | `/api/ai/title-hook` |
| `ThumbnailConceptsPanel.tsx` | `/api/ai/thumbnail-concepts` |
| `PipelinePanel.tsx` | `/api/ai/pipeline` |
| `ResearchScaffoldPanel.tsx` | `/api/ai/research-scaffold` |
| `ProsePanel.tsx` | `/api/ai/prose` |
| `AltDraftPanel.tsx` | `/api/projects/[projectId]/chapters/[chapterId]/alt-draft` |
| `InfluencePanel.tsx` | `/api/work-packets/*`, `/api/research/work-packet` |
| `TrendNichePanel.tsx` | `/api/ai/trend-niche` |

### DissectPanel Polling Pattern

Video dissection is async (GitHub Actions). DissectPanel handles the polling:

```tsx
// Submit
const { jobId } = await fetch("/api/ai/dissect-video", { method: "POST", body: { url } }).then(r => r.json());

// Poll
const interval = setInterval(async () => {
  const { status, analysis } = await fetch(`/api/ai/dissect-video/status/${jobId}`).then(r => r.json());
  if (status === "complete") {
    setAnalysis(analysis);
    clearInterval(interval);
  }
  if (status === "failed") {
    setError("Analysis failed");
    clearInterval(interval);
  }
}, 5000); // poll every 5 seconds
```

---

## The Chapter Editor: `src/components/editor/ChapterEditor.tsx`

The editor wraps [TipTap](https://tiptap.dev) (a ProseMirror-based rich text editor):

- **Extensions used:** Document, Paragraph, Text, Bold, Italic, Heading, BulletList, OrderedList, HardBreak, History, Placeholder
- **Custom extension:** SlashCommandPalette — triggers `/write`, `/dialogue`, etc. inline
- **Auto-save:** Debounced 1000ms save on every keystroke to `/api/projects/[projectId]/chapters/[chapterId]`
- **Word count:** Tracked live from editor content

### Slash Commands

`src/components/editor/SlashCommandPalette.tsx` intercepts the `/` character in the editor and shows a command list. Each command maps to a mode panel opening in the right panel.

Available slash commands are defined in `src/lib/slash-commands/index.ts`.

---

## Audio Novel Panel: `src/components/AudioNovelPanel.tsx`

Shared component (extracted 2026-06-17 from the legacy chapters-sidebar's inline code) used by two call sites:
- `src/components/panels/ChapterEditor.tsx` (legacy chapters sidebar, unchanged behavior)
- `src/components/WritingRoom.tsx` (new shell — toggleable "🎧 Audio Novel" footer section, Draft/Polish stages)

Self-contained: takes `{ project, activeChap }`, owns its own audio/lipsync state. Generate button → `POST /api/audio/generate` → `<audio>` player once `audioUrl` is set → lipsync section appears once `audioExportId` exists (character-with-portrait selection → `POST /api/audio/lipsync` → manual "Check status" polling against `GET /api/audio/lipsync?audioExportId=`).

---

## Adapt Panel: `src/components/AdaptPanel.tsx`

Cross-format story conversion, opened from a "🎭 Adapt this story →" button in `ExportStageView` (gated `isStoryFormat`). v1 ships exactly one working conversion (Novel → Screenplay); the capability map (`ADAPT_TARGETS`, mirrored server-side as `ADAPT_CAPABILITY_MAP` in `/api/projects/[id]/adapt/route.ts`) shows every other target (Web Series, Comic, Higgsfield Series, Novelization) as disabled "Coming soon" cards, so the menu doesn't need rework as targets are added — only flip `enabled: true` in both places and add the conversion logic.

Flow: `POST /api/projects/[id]/adapt` creates a new linked project (`projects.adaptedFromProjectId`) and copies World Bible (characters/locations/plotThreads) into it as independent rows. The panel then loops `POST /api/projects/[newId]/adapt-chapter` once per source chapter, sequentially (never parallel — keeps `sortOrder` deterministic and avoids bursting the rate limiter), showing a progress bar between calls. Each chapter conversion is metered (1 credit, same as a normal `write` generation) — if the loop fails partway (quota hit, Claude error), already-converted chapters stay in the new project; nothing rolls back. `WritingRoom`'s header shows "Adapted from: {source name} →" when `project.adaptedFromProjectId` is set (resolved via a client-side fetch of the source project's name).

Full design rationale: `docs/superpowers/specs/2026-06-18-adapt-cross-format-design.md`.

`ExportStageView` itself now frames reaching this stage as a terminal celebratory state ("🎉 Your draft is complete") rather than a flat status line, with the Adapt button and a "+ Start your next story →" link (to `/dashboard`) alongside Export/Comic Studio/Production Studio — added 2026-06-18 once Adapt existed to point to (Item 9 of the originating UX doc was explicitly deferred until Item 5 shipped).

---

## Comic Studio: `src/components/ComicStudio.tsx`

Full-screen comic panel generator. Reachable from the legacy `ToolbarPanel` ("🎨 Comics" button, story formats only) **and**, since 2026-06-17, from `WritingRoom`'s Export stage ("🎨 Open Comic Studio →", same `isStoryFormat` gate) via the Actions-drawer mechanism — both paths render the same underlying `ToolbarPanel`/`ComicStudio` instance, there is no duplicate component.

```
ComicStudio.tsx
  ├─ Page list (left)
  ├─ Panel grid (center)
  │   ├─ Panel image (Segmind Soul 2.0 output)
  │   ├─ Panel description (AI-generated)
  │   └─ Dialogue bubbles (editable)
  └─ Controls (right)
      ├─ Layout selector (2-panel, 4-panel, 6-panel, splash)
      └─ Style controls (ink style, color mode)
```

---

## Production Studio: `src/components/ProductionStudio.tsx`

Shot list and video generation UI:

```
ProductionStudio.tsx
  ├─ Shot list (table)
  │   ├─ Scene description
  │   ├─ Camera preset selector (20 presets)
  │   ├─ Viral preset selector (15 presets)
  │   └─ Preview image thumbnail
  └─ Generation controls
      ├─ Preview Still (Soul 2.0)
      ├─ Animate (Higgsfield DoP)
      └─ Generate Video (text-to-video)
```

---

## Constellation View: `src/components/ConstellationView.tsx`

Character relationship graph using `@xyflow/react` (React Flow). Renders `characterRelationships` table data as an interactive node-edge graph. Nodes are character cards; edges are relationship types with color coding.

---

## Arc Heatmap: `src/components/ArcHeatMap.tsx`

Emotional arc visualization using Recharts. Plots per-chapter emotional intensity scores from the `arc-heatmap` route. Each chapter is a point on the X axis; emotional intensity on Y.

---

## Tension Curve: `src/components/TensionCurve.tsx`

Similar to ArcHeatMap but visualizing narrative tension. Data from `/api/projects/[projectId]/tension-curve`. Overlays multiple tension threads (plot thread A vs. plot thread B vs. overall).

---

## "One Path, Five Stages" UI Redesign — `WritingRoom` (the only shell as of 2026-06-29)

The guided, stage-based flow that replaced the legacy toolbar-driven editor. Originally shipped behind a `writingRoomShell` GrowthBook flag (enabled in production 2026-06-15); the flag and the legacy shell it toggled between were both removed 2026-06-29 (commit `119fce2`) once the redesign was confirmed feature-complete — `GhostWriterApp` now renders `WritingRoom` unconditionally. `homeRedesign` (`home_redesign`) remains a live flag, still **OFF** — the dashboard at `/dashboard` is unaffected by any of this.

```
src/components/
├─ Home.tsx              ← replaces the dashboard (homeRedesign flag)
├─ WritingRoom.tsx        ← replaces GhostWriterApp's toolbar flow (writingRoomShell flag)
│   ├─ stages/            ← Idea → Structure → Draft → Polish → Export stage components
│   ├─ GuideBar.tsx        ← surfaces nextAction() suggestions; guide_clicked/guide_dismissed events
│   ├─ SlashMenu.tsx       ← "/" command menu, routes into ToolbarPanel via an Actions overlay
│   ├─ BeatDetectionChip.tsx     ← classifyBeat() match against LIBRARY_MODES keywords (Draft stage)
│   ├─ EntitySuggestionsChip.tsx ← Story Bible field-update suggestions from generated text
│   └─ BraindumpModal.tsx
└─ StoryBible.tsx         ← full-screen Cast/World/Threads CRUD overlay (writingRoomShell-gated)
```

- **Stage ladder:** `currentStage(project)` / `nextAction(project)` in `src/lib/guide/next-action.ts` map a project's chapter-level progress onto Idea/Structure/Draft/Polish/Export. Creator-format projects (TikTok, YouTube, etc.) get remapped stage labels (Angle/Outline-Hooks/Script/Retention edit/Publish pack) with their own per-stage tool rows.
- **Stage navigation:** the displayed stage is `manualStage ?? currentStage(project)` — clicking any of the five progress pills in `WritingRoom`'s header sets `manualStage` and navigates there directly, overriding the auto-computed stage. Before 2026-06-17 the displayed stage was 100% auto-computed with no way back once it advanced (e.g. once any chapter passed the word-count threshold the view jumped to Export with no way to return to Draft for other chapters).
- **Chapter creation:** `WritingRoom`'s header has a "+ Add {chapter label}" button next to the `‹ ›` chapter-nav arrows, calling `useProjectState`'s `addChapter()`. This didn't exist before 2026-06-17 — `WritingRoom` had no way to create a chapter at all (only navigate between existing ones), which is why AI-generated content from a multi-beat outline would all land in chapter 1.
- **Story Bible:** `src/components/StoryBible.tsx` is a full-screen Cast/World/Threads CRUD overlay. `src/lib/ai/entity-extraction.ts` (`matchEntities`/`diffEntity`) auto-extracts entity updates from generated `write`-mode text, surfaced via `EntitySuggestionsChip`.
- **Beat detection:** `classifyBeat()` in `src/lib/modes/classify.ts` matches a drafted beat's text against each of the 23 `LIBRARY_MODES`' keyword lists; `BeatDetectionChip` surfaces the best match in the Draft stage.
- **Dismissal state:** `projects.dismissedGuideIds` (jsonb array) persists which guide suggestions a user has dismissed.
- **Audio Novel:** the shared `AudioNovelPanel` component (see below) is reachable from a toggleable "🎧 Audio Novel" button in `WritingRoom`'s footer (Draft/Polish stages) — added 2026-06-17, since it was previously only reachable via the legacy sidebar that `WritingRoom` never mounts.
- **Comic Studio:** the Export stage view has a "🎨 Open Comic Studio →" button that reuses the same Actions-drawer mechanism Production Studio already used (`setShowComicStudio(true); setActionsOpen(true)`) — added 2026-06-17 for the same reason as Audio Novel above.
- **Sprint Mode:** `src/components/SprintMode.tsx` (full-screen distraction-free timed writing) is reachable from a "🏃 Sprint Mode" button in `WritingRoom`'s footer (Draft stage) — added 2026-06-18, since it was previously only reachable via the legacy slash-command palette.
- **Story Insights:** `src/components/StoryInsightsPanel.tsx` (dynamically imported) bundles `ArcHeatMap`, `TensionCurve`, and `ConstellationView` behind tabs, reachable from a "📊 Story Insights" button in `WritingRoom`'s footer — added 2026-06-18. All three visualizations existed with working API routes but had zero imports anywhere before this. As of 2026-07-02 the toggle+panel are also reachable via a Story Graph capability click or a Studio deep-link (`?studioOpen=insights&tab=arc|tension`) — both routes seed `insightsTab` and set `insightsOpen`, and the button/panel render whenever `insightsOpen` is true, not just in Draft/Polish (see "Studio Route + Capability Deep-Link Routing" in `docs/architecture.md`).
- **Plan Next Chapter:** the Guide ladder (`nextAction()`, see below) gained a `plan-chapter` rung (2026-07-01) between `structure-outline` and `draft-chapter` — one Haiku `buildSceneBlueprint()` call wrapped as a single `StoryBeat`, shown in `ChapterPlanPanel.tsx` (mirrors `BeatSheetPanel`). Clicking "Draft this chapter →" from the plan switches `project.activeChapter` to the planned chapter before generating — this class of bug (AI drafting into whatever chapter happened to be active, not the one the user just planned) is the same one `docs/product-history.md`'s "AI wrote everything into one chapter" section describes; the plan-chapter rung shipped with its own regression test guarding it.
- **Continuous-drafting momentum:** when the active chapter is the last one (by `sortOrder`) and has `wordCount > 0`, `WritingRoom`'s footer shows a "Continue → Start next {chapter label}" banner that calls the same `addChapter()` as the header button — added 2026-06-18 so finishing a chapter doesn't require noticing a header button to keep going. Paired with a `next-action.ts` fix: dismissing the "ready to export?" suggestion now falls back to a real `keep-writing` suggestion instead of `nextAction()` going `null` forever (see `docs/gotchas.md`).

⚠️ **This redesign has a history of porting incompletely** — see `docs/product-history.md` for the full account of what got dropped (Add Chapter, Comic Studio, Audio Novel, Sprint Mode, Story Insights) when this shell first shipped, and the recommendation going forward. Before treating `WritingRoom` as feature-complete, check whether a capability you expect from the legacy shell below actually has an equivalent here. Also be aware that not every "orphaned" claim turns out to be true on inspection — see the 2026-06-18 port-audit section in `docs/product-history.md` for several confident audit findings that were wrong.

---

## LSP Warning: "Props must be serializable"

TypeScript/LSP may warn about function props being passed between `'use client'` components. These are **pre-existing false positives** — `tsc --noEmit` exits 0 and the app compiles and runs correctly.

The warnings appear because:
- The `'use client'` boundary detection in some versions of the Next.js TS plugin incorrectly flags function props between two client components (not across a server→client boundary)
- The actual compile and runtime behavior is correct

**Ground truth:** `tsc --noEmit` exit code. Not the LSP warning count.
