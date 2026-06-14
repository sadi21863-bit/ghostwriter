# Database

Schema design, all tables, relationships, and the decisions behind them.

---

## Stack

- **ORM:** Drizzle ORM (`drizzle-orm` + `drizzle-kit`)
- **Database:** Neon PostgreSQL (serverless, connection pooling built-in)
- **Client:** `@neondatabase/serverless` — WebSocket-based, works in Edge Runtime
- **Schema file:** `src/db/schema.ts`
- **DB client:** `src/db/index.ts`
- **Config:** `drizzle.config.ts`

---

## Table Map

### Authentication Tables

| Table | Purpose |
|---|---|
| `users` | User accounts — email, hashed password, encrypted API keys |
| `accounts` | OAuth provider connections (NextAuth) |
| `sessions` | Database-backed session tokens (NextAuth) |
| `verificationTokens` | Email verification + password reset tokens |

**Why database sessions instead of JWT-only?**
Database sessions allow forced logout (invalidate a session row) and are required by NextAuth's database adapter. JWTs alone can't be revoked before expiry.

---

### Core Content Tables

#### `projects`

The root of everything. Every other content table has a `projectId` foreign key.

Key columns:
- `id` (uuid, primary key)
- `userId` (text, FK → users.id)
- `title`, `format`, `genres`, `tone`, `logline`, `synopsis`
- `controllingIdea` — used by Theme Tracker
- `targetAudience`, `targetLength`
- `creatorBibleId` — links to the creator bible for YouTube/podcast projects
- `aiismsCheck` (boolean, default false) — opt-in AIisms fiction-tell detection (Sprint 21)

- `storyType` — `linear | series | universe-story | parallel` — defaults to `linear` (existing projects unaffected)
- `universeId` — uuid, FK → universes.id — null for standalone projects
- `timelineSort` — integer — position within a series or universe timeline
- `phase` — text — optional grouping label within a universe ("Phase 1", "The First Saga")
- `seriesParentId` — uuid — points to the previous story in a series; null = first story
- `dismissedGuideIds` — jsonb array, default `[]` — Guide Engine suggestion IDs the user has dismissed (migration 0005)

**Format values:** `novel`, `screenplay`, `youtube_longform`, `youtube_short`, `podcast`

The `format` field drives everything downstream — format-specific rules in `engine.ts`, what modes are available, what export options appear.

#### `chapters`

- `projectId` (FK → projects.id)
- `title`, `content` (full text)
- `summary` — AI-generated summary, injected into context for later chapters
- `sortOrder` — manual ordering
- `wordCount`
- `parentChapterId` — enables chapter forking (alt drafts)

- `storylineId` — text — for future parallel structure; which character's POV lane (null = all storylines or non-parallel project)

The `summary` column is the key to the continuity engine. When a chapter is saved, the summarize route generates a 2-3 sentence summary. That summary is then available to all subsequent generation calls.

#### `characters`

Rich character profiles:

- `name`, `role`, `age`, `appearance`
- `personality`, `desires`, `fears`, `internalConflict`
- `arc` — character change arc
- `alwaysInContext` (boolean) — whether to inject full detail or compress to one line
- `antagonistType` — `Narcissist | Machiavellian | Psychopath | Ideological | Systemic`
- NVC profile (8 channels): kinesics (baseline/micro/idiosyncrasy), proxemics, paralanguage, haptics, chronemics, oculesics, objectics, appearance
- Language profile: `nativeLanguage`, `acquiredLanguages`, `accentProfile`, `registerDefault`, `idiolectFingerprint`, `codeSwitchingTriggers`
- Flaw triangle: `rootWound`, `hamartia`, `significantFlaws`, `cognitiveBias`, `blindSpot`, `strengthBranch`, `compensationMode`
- World Logic Matrix: `knowledgeMap` (JSON), `intelligenceProfile` (JSON), `culturalWorldview`, `characterWant`, `characterNeed`, `contradiction`, `narratorBlindSpot`
- `contextVisibility` — `always | mentioned | never` — controls context injection (Sprint 21)
- `soulId` — trained Higgsfield Soul ID for consistent character portraits
- `createdAt`, `updatedAt` — both present (updatedAt added Sprint 25)

**Why NVC and language profiles?**
The AI generates dialogue and action for characters. Without physical and linguistic ground truth, every character sounds and moves the same. The NVC profile is injected so the model knows "Maya crosses her arms when lying and speaks faster under stress."

#### `locations`

- `name`, `description`, `atmosphere`
- `history`, `sensoryDetails` — historical context and sight/sound/smell/texture
- `linkedCharacterIds` (text array) — characters associated with this location
- `alwaysInContext` (boolean) — same compression logic as characters
- `createdAt`, `updatedAt` — both present (updatedAt added Sprint 25)

#### `plotThreads`

- `name`, `description`, `status` (`Active | Dormant | Resolved`)
- `stakes`, `connections` — why this thread matters, how it connects to other threads
- `alwaysInContext` (boolean) — compression logic
- `starvationWarning` (boolean) — flagged when thread hasn't been mentioned in 3+ chapters
- `lastMentionedChapterId` — used by the starvation check
- `createdAt`, `updatedAt` — both present (updatedAt added Sprint 25)

---

### AI Memory Tables

#### `storyMemories`

Facts extracted from chapters by MODELS.fast:

- `projectId`, `chapterId` (FK)
- `content` — the fact itself ("Maya killed Roshan in the warehouse")
- `category` — `character_decision | event | general`
- `priority` — integer score (3/2/1 based on category)
- `chapterNumber` — for recency scoring

The memory cap of 8 items is enforced in `context-builder.ts`, not in the DB. All memories are stored; only the top 8 by score are injected into context.

#### `characterEvolutionLog`

Tracks how characters change across the story:

- `characterId`, `projectId`, `chapterId`
- `traitChanged` — what changed ("now trusts nobody")
- `trigger` — what caused it ("Roshan's betrayal")
- `before`, `after` — trait state before and after

This powers the Character Evolution panel — a timeline of how a character's personality shifts.

---

### Creator Tables

#### `creatorBibles`

Channel-level profile for YouTube/podcast creators:

- `userId`, `projectId`
- `channelNiche`, `targetAudience`
- `contentPillars` (text array) — the 3-5 topics the channel covers
- `voiceTone`, `uploadCadence`
- `brandVoice` — free-form voice description

Injected into creator tool prompts (trends, hooks, SEO) to personalize output for the creator's specific channel.

---

### Comic Tables

#### `comicPages`

- `projectId`, `chapterId`
- `pageNumber`, `layoutType`

#### `comicPanels`

- `pageId` (FK → comicPages.id)
- `panelNumber`, `description` (AI-generated panel description)
- `imageUrl` — Segmind Soul 2.0 output URL
- `dialogueBubbles` (JSON array) — text and position
- `cameraAngle`, `mood`

---

### Production Tables

#### `productionShots`

Shot list entries:

- `projectId`, `chapterId`
- `shotNumber`, `sceneDescription`
- `cameraPreset` — one of 20 presets from `src/lib/higgsfield/presets.ts`
- `viralPreset` — one of 15 viral presets
- `previewImageUrl` — Soul 2.0 still
- `videoUrl` — generated video URL
- `higgsfield_job_id` — for polling generation status
- `status` — `pending | generating | complete | failed`

#### `audioExports`

- `projectId`, `chapterId`
- `audioUrl` — TTS output URL
- `lipsyncVideoUrl` — lipsync video output URL
- `voice`, `speed`

#### `videoAnalysisJobs`

For the Dissect Video feature (GitHub Actions async flow):

- `userId`
- `youtubeUrl`
- `status` — `queued | processing | complete | failed`
- `analysis` (JSON) — Gemini output when complete
- `githubRunId` — the Actions run ID for status checking

---

### Reader / Sharing

#### `readerSessions`

Public read-only sharing tokens:

- `projectId`, `userId`
- `token` (uuid) — the URL-safe share token
- `expiresAt` — optional expiry
- `allowedChapterIds` — optionally restrict to specific chapters

#### `readerReactions`

Engagement from public readers:

- `sessionId`, `chapterId`
- `reaction` — `loved | gripped | confused | bored`
- `position` — word position in chapter (for heatmaps)

---

### Research & Craft Tables

#### `workPackets`

The craft reference library — principles from writing craft books:

- `title`, `body` — the principle
- `category` — e.g. `dialogue`, `tension`, `character`
- `embedding` (vector(1536)) — OpenAI `text-embedding-3-small` output

The `embedding` column requires the `pgvector` extension on Neon. Semantic search via `src/app/api/work-packets/search/route.ts` uses cosine similarity.

#### `workPatterns`

Pre-built writing pattern templates:

- `name`, `description`
- `template` — the pattern text with `{{placeholders}}`
- `category`

#### `referenceWorks`

User-uploaded reference books for Style DNA:

- `projectId`
- `title`, `author`
- `styleAnalysis` (JSON) — 6-attribute style fingerprint
  - `voiceCadence`
  - `sentenceStructure`
  - `dialogueStyle`
  - `descriptiveDensity`
  - `pacingPattern`
  - `thematicApproach`

---

### Relationship Tables

#### `characterRelationships`

Graph edges for the relationship map:

- `projectId`
- `characterAId`, `characterBId` (FK → characters.id)
- `relationshipType` — `ally | enemy | romantic | family | mentor | rival`
- `description` — free-form relationship note
- `strength` — 1-5 (weak to strong)

---

---

### Series + Universe Tables (Sprint 22)

#### `universes`

Top-level container for a shared fictional world:

- `userId` (FK → users.id)
- `name`, `premise`, `tone`
- `sharedRules` (text array) — physics, magic system, tech level truths that hold across every story

#### `universeCharacters`

Characters that exist across multiple stories in a universe:

- `universeId` (FK → universes.id)
- `name`
- `baseProfile` (JSON) — permanent facts: role, NVC, flaw triangle (same structure as `characters` table)
- `isAlive` (boolean) — when a character dies in a story, mark here; subsequent stories won't use them

#### `projectCharacterStates`

How a universe character has evolved by the end of a specific story:

- `projectId` (FK → projects.id)
- `universeCharId` (FK → universeCharacters.id)
- `knowledgeOverride` (JSON) — what this character knows by story end
- `emotionalState` — character's emotional state at story end
- `stateNotes` — prose summary of major changes in this story
- `isDeceased` (boolean) — did this character die in this story?

These states are queried by `buildSeriesUniverseContext()` in the generate route to inject accurate character state into AI context for later stories in the universe.

#### `universeEvents`

Canonical events that occurred in the universe timeline:

- `universeId` (FK → universes.id)
- `projectId` (FK → projects.id) — which story established this event (nullable)
- `name`, `description`
- `timelineSort` (integer) — position in timeline; no dates required (integer ordering only)
- `isCanon` (boolean) — canon events inject into context for all later-positioned stories

Canon events with `timelineSort` < current story's `timelineSort` are automatically injected into AI context via `buildSeriesUniverseContext()`.

---

### Subscription Tables

#### `subscriptions`

- `userId`
- `stripeCustomerId`, `stripeSubscriptionId` — legacy Stripe fields (kept for historical rows)
- `razorpaySubscriptionId`, `razorpayPaymentId` — active payment provider (Razorpay)
- `tier` — `free | story_pro | creator_pro | all_access`
- `status` — `active | cancelled | past_due | trialing`
- `currentPeriodEnd` — used for grace period: when `status=cancelled` and `currentPeriodEnd` is in the future, `getUserTier()` still returns the paid tier
- `createdAt`, `updatedAt`

**Grace period behavior:** Cancellation webhook sets `status='cancelled'` but does NOT overwrite `tier`. `getUserTier()` checks:

```
cancelled + currentPeriodEnd > now  →  return sub.tier  (still in grace period)
cancelled + currentPeriodEnd ≤ now  →  return "free"
past_due                            →  return "free"
active | trialing                   →  return sub.tier
```

This means a cancelled user retains their tier until their period expires — correct UX for end-of-billing-cycle cancellations. Implemented in `src/lib/subscription.ts`.

---

## Migrations

GhostWriter uses `drizzle-kit push` (schema push) rather than `drizzle-kit generate` (migration files) for development. This applies schema changes directly to the database.

**Windows PowerShell workflow:**
```powershell
Copy-Item .env.local .env -Force   # drizzle-kit reads .env, not .env.local
npx drizzle-kit push
```

**Why `Copy-Item` first?**
`drizzle-kit` uses `dotenv` which reads `.env`, not `.env.local`. Next.js reads `.env.local`. These are different files. Not copying `.env.local` first means `drizzle-kit` uses the wrong database URL.

---

## Schema Exception: `generations.model` Column

The `generations` table has a `model` column with a literal string default value. This column records which model was used for each generation (historical audit log). It is **not** an active model selection — it does not need to use `MODELS.default`. The literal string stays as-is because it's a historical record, not a model selection decision.

---

## pgvector

The `workPackets.embedding` column is `vector(1536)` — a pgvector column storing OpenAI `text-embedding-3-small` embeddings.

**Setup required:**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Run this in the Neon console before running `db:push` for the first time, or the migration will fail. After enabling, trigger the embedding backfill:

```bash
POST /api/work-packets/embed
```

This generates embeddings for all existing work packets. Subsequent packets are embedded on creation.
