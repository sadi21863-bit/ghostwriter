# Components

UI component hierarchy, how the panel system works, and how writing modes connect to API routes.

---

## Top-Level App Shell

```
src/app/project/[projectId]/page.tsx
  └─ GhostWriterApp.tsx  ← root component for the editor
      ├─ Left panel tabs (Chapters, Characters, Locations, etc.)
      ├─ ChapterEditor.tsx  ← center writing area
      ├─ ToolbarPanel.tsx   ← right panel with mode selector + active panel
      └─ CommandPalette.tsx ← ⌘K interface
```

`GhostWriterApp.tsx` holds the central state: which project, which chapter is open, which mode is selected, and what the current generation output is.

All AI calls go through `useAIActions(...)`, a thin composition of 5 hooks in `src/hooks/` (`useGeneration`, `useEntitySync`, `usePipelines`, `useProseTools`, plus the shared `ai-shared.ts` fetch wrapper) — see "Client-Side Hooks" in `docs/architecture.md` for the breakdown.

---

## Panel Architecture

The editor has three columns:

```
┌──────────────────────────────────────────────────────────┐
│  Left Panel      │  Editor (center)   │  Right Panel     │
│                  │                    │                    │
│  World Bible     │  ChapterEditor     │  ToolbarPanel     │
│  Characters      │  (TipTap editor)   │  ├─ Mode selector │
│  Locations       │                    │  └─ Active panel  │
│  Plot Threads    │                    │                    │
│  Story Health    │                    │                    │
│  Trends          │                    │                    │
└──────────────────────────────────────────────────────────┘
```

### Left Panel Tabs

| Tab | Component | What it shows |
|---|---|---|
| Chapters | Panel in GhostWriterApp | Chapter list, create/reorder/delete |
| Characters | WorldBiblePanel | Character cards with full profiles |
| Locations | WorldBiblePanel | Location cards |
| Plot Threads | WorldBiblePanel | Thread tracker with status |
| Story Health | StoryHealthPanel | Arc heatmap, tension curve, theme tracker |
| Trends | (Creator Pro) | YouTube/Instagram trend tools |
| Series | SeriesPipelinePanel | Series planner and bible |
| Export | ExportPanel | DOCX, blurb, query letter |

### Right Panel (ToolbarPanel)

The right panel is a mode selector + the active mode's panel:

```
ToolbarPanel.tsx
  ├─ Mode grid (26 mode buttons)
  └─ Active panel (conditionally rendered)
      ├─ modes/ (26 writing mode panels)
      └─ tools/ (18 creator tool panels)
```

Each mode button click sets `activeMode` in state, which swaps in the corresponding panel component.

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

## Comic Studio: `src/components/ComicStudio.tsx`

Full-screen comic panel generator:

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

## "One Path, Five Stages" UI Redesign (behind GrowthBook flags — `writingRoomShell` ON, `homeRedesign` OFF)

An alternative shell that replaces the toolbar-driven editor above with a guided, stage-based flow. Gated behind two GrowthBook flags — `writingRoomShell` (`writing_room_shell`) and `homeRedesign` (`home_redesign`). As of 2026-06-15, **`writingRoomShell` is enabled in production** — `GhostWriterApp` renders `WritingRoom` (not the legacy toolbar flow described above) for all users. `homeRedesign` remains **OFF**, so the dashboard architecture above is still what users see at `/dashboard`.

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
- **Story Bible:** `src/components/StoryBible.tsx` is a full-screen Cast/World/Threads CRUD overlay. `src/lib/ai/entity-extraction.ts` (`matchEntities`/`diffEntity`) auto-extracts entity updates from generated `write`-mode text, surfaced via `EntitySuggestionsChip`.
- **Beat detection:** `classifyBeat()` in `src/lib/modes/classify.ts` matches a drafted beat's text against each of the 23 `LIBRARY_MODES`' keyword lists; `BeatDetectionChip` surfaces the best match in the Draft stage.
- **Dismissal state:** `projects.dismissedGuideIds` (jsonb array) persists which guide suggestions a user has dismissed.

---

## LSP Warning: "Props must be serializable"

TypeScript/LSP may warn about function props being passed between `'use client'` components. These are **pre-existing false positives** — `tsc --noEmit` exits 0 and the app compiles and runs correctly.

The warnings appear because:
- The `'use client'` boundary detection in some versions of the Next.js TS plugin incorrectly flags function props between two client components (not across a server→client boundary)
- The actual compile and runtime behavior is correct

**Ground truth:** `tsc --noEmit` exit code. Not the LSP warning count.
