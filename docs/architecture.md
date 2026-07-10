# Architecture

How GhostWriter works end-to-end: layers, data flow, and how all the pieces connect.

---

## The Three-Layer Model

```
┌─────────────────────────────────────────────────┐
│  UI Layer                                        │
│  React components in src/components/             │
│  Panel-per-mode design — each mode is a panel   │
└───────────────────┬─────────────────────────────┘
                    │ fetch()
┌───────────────────▼─────────────────────────────┐
│  API Layer                                       │
│  Next.js 16 App Router route handlers            │
│  src/app/api/                                    │
│  All auth, ownership, rate limiting, AI calls    │
└───────────────────┬─────────────────────────────┘
                    │ SQL via Drizzle
┌───────────────────▼─────────────────────────────┐
│  Data Layer                                      │
│  Neon PostgreSQL (serverless Postgres)           │
│  Drizzle ORM — schema in src/db/schema.ts        │
└─────────────────────────────────────────────────┘
```

**Rule:** The UI layer never talks to the database or to Anthropic directly. Every AI call and every DB mutation goes through an API route. This keeps API keys server-side and ownership checks in one place.

---

## Request Lifecycle (AI Generation)

A full AI generation request from user click to streamed response:

```
1. User clicks "Generate" in WritePanel.tsx
   │
2. Component calls fetch("/api/ai/generate", { method: "POST", body: { ... } })
   │
3. Route handler: src/app/api/ai/generate/route.ts
   ├─ getRequiredSession()        → 401 if not logged in
   ├─ checkAiRateLimit(userId)    → 429 if over limit
   ├─ getUserTier(userId)         → subscription tier
   ├─ LIBRARY_MODES gate          → 403 if free tier + library mode
   ├─ overrideModel = MODELS.fast → if free tier (Haiku routing)
   ├─ canAccessFeature(tier, ...) → 403 if not subscribed
   ├─ AIisms check (if project.aiismsCheck && Story Pro+)
   ├─ buildSeriesUniverseContext() → series chain or universe canon injection
   └─ build context →
   │
4. context-builder.ts assembles the prompt context:
   ├─ Project header (title, format, genres, tone, logline)
   ├─ Style DNA (if reference works exist — 6 style attributes)
   ├─ Voice fingerprint (if 3+ chapters — 10 stylometric constraints)
   ├─ Characters (filtered by contextVisibility: always/mentioned/never)
   ├─ Locations (same compression logic)
   ├─ Plot threads
   ├─ Story memories (priority-scored, capped at 8)
   └─ Recent chapter summaries (last 3)
   │
5. engine.ts selects mode system prompt + calls Anthropic SDK
   ├─ Static context (mode instructions + genre rules) → cache_control: ephemeral
   ├─ Dynamic context (project data) → no cache
   └─ anthropic.messages.create({ model: MODELS.default, ... })
   │
6. Response streamed back to component
   └─ Panel renders result
```

---

## Project Context Assembly

The most important function in the codebase is `buildContextString()` in `src/lib/ai/context-builder.ts`. Every AI generation call passes through it. It assembles:

### What gets injected

```
[PROJECT HEADER]
Title: The Hollow Path
Format: Novel | Genres: Literary Fiction, Thriller
Tone: Melancholic, tense | POV: Third-person limited

[STYLE DNA]  ← only when reference works exist
Voice: Sparse declarative sentences...
Structure: Non-linear, fragmented...
[+ 4 more attributes]

[CHARACTERS]
━━ Maya Patel (Protagonist) ━━    ← alwaysInContext=true → full detail
Role, personality, desires, fears, arc, NVC profile, language patterns...

━━ The Informant (Minor) ━━       ← alwaysInContext=false → one-liner
Unnamed contact. Appears in Ch.3.

[LOCATIONS]  ← same compression logic

[PLOT THREADS]
• The missing journalist (open)
• Maya's estranged father (dormant)

[STORY MEMORIES]  ← priority-scored, max 8
[p=3] Maya shot Roshan in 2019 (Ch.4, character_decision)
[p=2] The safe house address is 44 Elm Street (Ch.2, event)

[CHAPTER SUMMARIES]  ← last 3
Ch.5: Maya discovers the envelope...
```

### Memory priority scoring

```typescript
score = weight[category] + recencyBonus
// category weights: character_decision=3, event=2, general=1
// recencyBonus: most recent chapter gets +2, one chapter back gets +1
// Hard cap: top 8 by score
```

This means the AI always gets the most plot-critical, most recent facts, without the context window ballooning on long projects.

### Mode-Aware Context Policy

`buildStaticContext`/`buildDynamicContext`/`buildContext` accept an optional `mode` (and `tier` for the static budget). Each `MODE_REGISTRY` entry carries a `contextPolicy` (`needsCharacters`/`needsLocations`/`needsMemories`/`needsPlotThreads`/`needsRealism`/`charDepth: "full"|"brief"`) that gates which of the sections above are included — e.g. `horror`/`combat`/`action` skip story memories and plot threads in favor of realism injection; `brainstorm`/`outline`/`atmosphere` use brief one-line character summaries. Calls with no `mode` (quick-start, alt-draft) fall back to the pre-policy "include everything" behavior. See `docs/ai-engine.md` for the full policy table.

---

## Prompt Caching Strategy

Anthropic's prompt caching (ephemeral blocks, 5-minute TTL) is applied to the static half of every prompt:

```
System message structure:
┌─────────────────────────────────────────┐
│ CACHED BLOCK (ephemeral cache_control)  │
│ Mode system prompt (e.g. "You are a    │
│ professional dialogue writer...")       │
│ Genre rules                             │
│ Format rules                            │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ UNCACHED BLOCK                          │
│ Project context (title, characters,     │
│ memories, summaries — changes per user) │
└─────────────────────────────────────────┘
```

The cached block is identical across all users using the same mode, so it amortizes across the entire user base. The uncached block is user-specific and always fresh.

---

## Model Tier Strategy

All model selections are centralized in `src/lib/ai/engine.ts`:

```typescript
export const MODELS = {
  fast:    "claude-haiku-4-5-20251001",   // lightweight tasks
  default: "claude-sonnet-5",             // most generation
  quality: "claude-opus-4-8",             // deep reasoning
};
```

**Dynamic imports** — panels loaded lazily (not in main bundle):
`StoryHealthPanel`, `ExportPanel`, `AltDraftPanel`, `SprintMode`, `UpgradePrompt`, `CommandPalette`, `QualityReviewPanel`, `WorldBiblePanel`, `ToolbarPanel`, `StoryBible`

**MODELS.fast** — used for:
- All free-tier generation (overrideModel routing)
- Chapter summarization
- Story memory extraction
- Comic panel description
- Scene validation (lightweight pass/fail)
- Transportation check (continuity check)
- Trend angle generation

**MODELS.default** — used for:
- All paid prose generation (Write, Dialogue, Combat, etc.)
- Creator tools (hooks, TikTok, SEO, trends, guest intel)
- Export copy (blurb, query letter)
- Analysis routes (theme tracker, tension curve, character evolution)

**MODELS.quality** — reserved for:
- Composition mode (multi-layer mixing — needs nuanced judgment)
- Any future high-stakes analysis

Every route file imports `{ MODELS }` from `@/lib/ai/engine`. There are zero hardcoded model strings in route handlers.

---

## Client-Side Hooks: `useAIActions`

`GhostWriterApp.tsx` calls a single `useAIActions(...)` hook, but the implementation is a thin (~67 line) composition of 5 focused hooks in `src/hooks/`:

| Hook | Responsibility |
|---|---|
| `ai-shared.ts` | Shared `callAI()` fetch wrapper + `buildNeighbourContext()` — not a hook itself, imported by the others |
| `useGeneration.ts` | Core `generate()` (brainstorm/outline/write + 23 library modes), undo stack, quality check + entity-extraction fire-and-forget calls |
| `useEntitySync.ts` | Auto-extraction suggestion state (`entitySuggestions`, `acceptEntitySuggestion`, `rejectEntitySuggestion`) |
| `usePipelines.ts` | Multi-agent pipeline mode (`/api/ai/pipeline`) |
| `useProseTools.ts` | Prose sub-operations (expand/tighten/show-dont-tell/subtext/rewrite) |

`useAIActions.ts` wires shared state (`undoStack`, `streamText`, `buildFullContext`) and spreads each sub-hook's exports — callers see one hook with the same surface as before the split.

---

## Authentication Flow

```
User submits form / clicks login
        │
NextAuth.js credential provider
        │
  ├─ Email/password → bcrypt.compare() → session JWT
  └─ OAuth providers (if configured) → account table
        │
Session stored in database (sessions table)
        │
API routes call getRequiredSession()
  └─ getServerSession() → throws NextResponse 401 if null
```

Every protected API route starts with:
```typescript
const session = await getRequiredSession();
// execution never reaches the next line if unauthenticated
```

---

## Ownership Check Pattern

Every project-scoped route does this:

```typescript
const project = await db.query.projects.findFirst({
  where: and(
    eq(projects.id, params.projectId),
    eq(projects.userId, session.user.id)  // ← ownership enforced here
  ),
});
if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
```

Returning 404 instead of 403 on unauthorized access is intentional — it doesn't reveal whether the project ID exists.

For routes that look up a child resource by its own ID (a shot, a comic panel, a chapter) and need to confirm it belongs to the caller's project, `verifyChildOwnership(table, childId, projectId)` in `src/lib/auth-helpers.ts` runs the same `id = childId AND projectId = projectId` check generically against any table with `id`/`projectId` columns, returning a boolean.

---

## Rate Limiting

Three limiters, all in `src/lib/ratelimit.ts`, all backed by Upstash Redis:

| Limiter | Limit | Applied to |
|---|---|---|
| `aiRatelimit` | 20 req/min per user | All AI generation routes |
| `generalRatelimit` | 100 req/min per user | All other API routes |
| `freeGenerationLimit` | 10 req/day per user | AI routes for free-tier users |

**Fail-open design:** If `UPSTASH_REDIS_REST_URL` is not set, `checkAiRateLimit()` returns `null` (allow). This means the app works in development without Redis configured. Production always has Redis.

---

## Subscription Enforcement

Feature gating runs in every protected AI route:

```typescript
const tier = await getUserTier(session.user.id);
if (!canAccessFeature(tier, "story_modes_advanced")) {
  return NextResponse.json({ error: "upgrade_required", feature: "story_modes_advanced" }, { status: 403 });
}
```

`getUserTier()` caches the result in memory for 5 minutes per user ID to avoid a DB round-trip on every request. Cache is invalidated on subscription webhook events.

Feature names map to tiers in `src/types/subscription.ts` → `FEATURE_ACCESS` map.

---

## Series + Universe Architecture (Sprint 22)

Two distinct multi-story structures:

**Series** — one continuous story across volumes (Royal Road web serials, book trilogies). Characters age and accumulate knowledge linearly. Each story has a `seriesParentId` pointing to the previous story.

**Universe** — multiple standalone stories in one world (MCU, Cosmere). Each story fully self-contained; connections are rewards for committed readers. Stories are positioned by `timelineSort` integer (no dates required).

### Context injection: `buildSeriesUniverseContext()`

Called in the generate route immediately after the AIisms check. Adds a `STORY UNIVERSE` block to `effectiveStatic` (the cached static block — appended *after* `capContextForTier`'s cap, so server-derived context is never truncated by a client-inflated static block):

```
Series:
  → Walks seriesParentId chain (up to 10 books back)
  → Injects each prior book's name + top 5 story memories (key events)

Universe:
  → Queries universeEvents where isCanon=true AND timelineSort < this story's timelineSort
  → Queries universeCharacters with their projectCharacterStates from prior stories
  → Injects "DECEASED" flag for dead characters (prevents model from resurrecting them)
  → Injects emotionalState + stateNotes for surviving characters
```

### Context injection: `buildSeriesBibleContext()` (independent of `storyType`)

Added 2026-06-17. A completely separate, simpler mechanism from the series/universe one above: the dashboard's "Series Bible" feature (`series_bibles` table — name/premise/tone/worldRules/seriesCharacterArcs/continuityNotes/timeline/`projectIds`) lets a user group any of their projects under one canon document, regardless of `storyType`. Until this date, filling in that document had **zero effect on generation** — nothing read the table. Now: for any `projectId`, looks up whether it appears in any of the user's `series_bibles.projectIds` arrays, and if so appends a `SERIES BIBLE` block (premise, tone, world rules, character arcs, continuity notes, timeline) to the same `effectiveStatic` block, alongside (not instead of) `buildSeriesUniverseContext()`'s output. The two are independent and can both fire for the same project.

### Universe Dashboard

`/universe/[universeId]` — lists stories in timeline order, manages canonical events, manages universe-level characters. Linked from the dashboard "Universes" section.

### Story Type Selector

In the new project modal, writers choose between:
- `linear` — single story (default; existing projects unaffected)
- `series` — book series with `seriesParentId` chain
- `universe-story` — part of a universe, positioned by `timelineSort`
- `parallel` — multiple converging storylines (Sprint 23, shown as coming-soon)

---

## Video Dissection Architecture

Video analysis is too slow for Vercel's serverless functions:

```
User submits YouTube URL
        │
POST /api/ai/dissect-video
  ├─ Creates videoAnalysisJobs row (status: queued)
  ├─ Dispatches GitHub Actions workflow via REST API
  └─ Returns { jobId }
        │
GitHub Actions workflow runs:
  ├─ Downloads video
  ├─ Sends to Gemini (2-4 min analysis)
  └─ POSTs results back to /api/ai/dissect-video/status/[jobId]
        │
Frontend polls GET /api/ai/dissect-video/status/[jobId]
  └─ Returns { status, analysis } when complete
```

The `GITHUB_PAT` environment variable is what dispatches the workflow. Without it, the Dissect Video feature is disabled.

---

## Comic Studio Pipeline

```
User writes chapter text
        │
POST /api/projects/[projectId]/comics
  ├─ MODELS.fast: Generate panel descriptions from text
  └─ Creates comicPages + comicPanels rows
        │
Frontend renders panel grid
        │
POST /api/.../panels/[panelId]/regenerate
  └─ Segmind Soul 2.0 → image URL → stored in panel.imageUrl
```

---

## Production Studio Pipeline

```
User creates shot list
        │
POST /api/.../production/shots
  └─ Creates productionShots rows
        │
POST /api/.../shots/[shotId]/preview
  └─ Segmind Soul 2.0 → still image
        │
POST /api/.../shots/[shotId]/animate  or  /generate-video
  ├─ animate: Higgsfield DoP (image-to-video, camera movement)
  └─ generate-video: Higgsfield text-to-video, model from VIDEO_MODELS
        │
Status polling via /status routes
  └─ Higgsfield job ID → poll until complete → video URL
```

### Video model registry: `src/lib/higgsfield/models.ts`

`VIDEO_MODELS` is the single source of truth for every Higgsfield text-to-video model — `VIDEO_ENDPOINTS`, `VIDEO_MODEL_INFO`, `ACTIVE_VIDEO_MODELS`, and `MODE_TO_MODEL` are all derived from it.

| Model | Best for | Notes |
|---|---|---|
| `kling` (Kling 3.0) | action, combat | physics-aware, 4K |
| `veo` (Veo 3.1) | realism, drama, nature | native audio (`generatesAudio: true`) |
| `sora` (Sora 2) | drama, fantasy, stylized | **deprecated** — excluded from `ACTIVE_VIDEO_MODELS` and auto-selection |
| `seedance` (Seedance 2.0) | social, shorts, quick | fast; also the only model wired to the opt-in multi-shot-single-call path (`multiShotPrompt`, `generate-video?multiShot=1`, ≤5 shots) |
| `wan` (WAN 2.1) | quick, budget | plain text2video only — label corrected in item 70, previously falsely claimed lipsync/avatar capability it never had |
| `wan-r2v` (WAN 2.7 R2V) | consistency, character | new in item 70; character-consistent video straight from reference photos (no training job) — added but not yet live-verified, not auto-selected anywhere |
| `hailuo` (Hailuo 02) | cinematic, smooth, general | |

`MODE_TO_MODEL` maps a generation mode to its best-fit model for auto-selection (e.g. `combat`→`kling`, `horror`→`veo`, `comedy`→`seedance`; `default`→`kling`). Marking a model `deprecated: true` removes it from `ACTIVE_VIDEO_MODELS` and `MODE_TO_MODEL` candidates without deleting historical data referencing it.

---

## Studio Route + Capability Deep-Link Routing

`/project/[projectId]/studio` (`StudioShell.tsx`) is a lightweight graph/analytics dashboard sitting alongside the writing room — 4 tabs (Graph/Pipelines/Analytics/Exports), Graph being the only one built out (renders `ConstellationView` at 640px). Clicking a Story Graph node's capability (e.g. "Tension Curve" on a thread node) doesn't run anything itself — it calls `capabilityAction(cap, availability)` (`src/lib/capabilities/actions.ts`), a pure function returning a discriminated union `CapabilityActionResult` that decides what should happen: run a free preflight, require payment confirmation, or navigate somewhere. Two consumers interpret that result differently:

1. **`studioDeepLink(projectId, action)`** (`src/lib/graph/studio-deeplink.ts`) — used when the click originates on the Studio route. Converts the action into a URL: `router.push('/project/{id}?studioOpen=X[&tab=Y]')`. `GhostWriterApp`'s mount `useEffect` (deps `[]`) reads `window.location.search` **once**, dispatches based on `studioOpen`/`tab`, then calls `window.history.replaceState(null, "", window.location.pathname)` to scrub every query param — a one-shot dispatch, not a persistent URL state.
2. **`StageRoleRail.tsx`** — used when the click originates directly in the writing room (Discover/Shape/Produce funnel-stage capability rows). No URL involved; the same `capabilityAction()` result drives bound callback props straight into local state.

| `studioOpen` value | Capability(ies) | Destination |
|---|---|---|
| `comic` | comic-related | Comic Studio (Actions drawer) |
| `production` | production-related | Production Studio (Actions drawer) |
| `insights&tab=arc\|tension` | `tension_curve`, `arc_heatmap` | `StoryInsightsPanel`, seeded to the matching tab |
| `story-health&tab=validator` | `prose_fix` | `StoryHealthPanel`, validator tab |
| `polish` | `editor_review` | Writing room switches to the Polish stage (`EditorNotesPanel`) |
| `actions` | fallback (no dedicated UI) | generic Actions drawer |

**State ownership spans two components**, which is why the wiring has two different shapes: `insightsOpen`/`insightsTab`/`manualStage` live inside `WritingRoom.tsx` itself (so `StageRoleRail` calls straight into local setters); `showStoryHealth` lives one level up in `GhostWriterApp.tsx` (so `WritingRoom` receives `onOpenStoryHealth` as a prop and the deep-link dispatch effect sets `GhostWriterApp`'s own state directly). `StoryInsightsPanel`/`StoryHealthPanel` are conditionally rendered (`{open && <Panel initialTab={tab} />}`), so `initialTab` (read via `useState(initialTab ?? default)`) only takes effect on a fresh mount — both panels are mounted with `key={tab}` to force a remount when the target tab changes while the panel is already open.

**A capability's own visibility gate is a separate concern from the dispatch mechanism** and can silently swallow a correctly-dispatched deep link — this actually happened during Phase 2's own E2E verification: `StoryInsightsPanel`'s toggle+panel block was gated to `stage === "draft" || "polish" || forceEditor`, but neither `StageRoleRail`'s direct-click path nor the deep-link effect ever changed `stage` — only `insightsOpen`. A capability click from Discover/Shape/Produce (any stage other than Draft/Polish) set `insightsOpen = true` internally but rendered nothing. Fixed by decoupling the panel's visibility from `stage` (`|| insightsOpen` added to the gate) rather than force-navigating the user's funnel stage as a side effect of opening an analysis panel.

Only 10 of the ~52 total registry capabilities (26 `MODE_REGISTRY` entries + 26 `TOOL_REGISTRY` entries) are reachable from the Story Graph at all (`NODE_CAPABILITIES` in `src/lib/graph/graph-program.ts` maps `GraphNodeKind` → applicable capability ids) — most nodes have no wired capability yet. `editor_review` deep-linked for a creator-format project switches to Polish stage but shows nothing there (`EditorNotesPanel` is gated `isStoryFormat`) — a documented, accepted limitation, not a bug.

Shipped in two phases: Phase 1 (2026-06-30, commit `656ebc6`) built the Studio route shell + `comic`/`production`/`actions` deep-links. Phase 2 (2026-07-02, commit `168745b`) added the `insights`/`story-health`/`polish` routing above. `villain_pov`/Refine capabilities still have zero dedicated UI (deferred sub-projects B/C of the same decomposition) and fall into the `actions` catch-all.

---

## Data Flow Diagram (simplified)

```
Browser
  │
  │  fetch()
  ▼
Next.js Route Handler
  │        │
  │        │ Anthropic SDK
  │        ▼
  │    Claude (Sonnet/Haiku/Opus)
  │        │
  │        ▼
  │    AI Response
  │
  │ Drizzle ORM
  ▼
Neon PostgreSQL
  ├─ projects, chapters, characters, locations, plotThreads
  ├─ storyMemories, characterEvolutionLog
  ├─ comicPages, comicPanels
  ├─ productionShots, audioExports, videoAnalysisJobs
  ├─ workPackets (+ pgvector embeddings)
  └─ subscriptions, users, sessions
```
