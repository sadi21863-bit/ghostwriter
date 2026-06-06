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
  default: "claude-sonnet-4-6",           // most generation
  quality: "claude-opus-4-6",             // deep reasoning
};
```

**Dynamic imports** — panels loaded lazily (not in main bundle):
`StoryHealthPanel`, `ExportPanel`, `AltDraftPanel`, `SprintMode`, `UpgradePrompt`, `CommandPalette`, `QualityReviewPanel`, `WorldBiblePanel`, `ToolbarPanel`

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

Called in the generate route immediately after the AIisms check. Adds a `STORY UNIVERSE` block to `effectiveDynamic`:

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
  └─ generate-video: Higgsfield text-to-video (6 models: Kling, Veo, Sora, etc.)
        │
Status polling via /status routes
  └─ Higgsfield job ID → poll until complete → video URL
```

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
