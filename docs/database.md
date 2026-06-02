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

**Format values:** `novel`, `screenplay`, `youtube_longform`, `youtube_short`, `podcast`

The `format` field drives everything downstream — format-specific rules in `engine.ts`, what modes are available, what export options appear.

#### `chapters`

- `projectId` (FK → projects.id)
- `title`, `content` (full text)
- `summary` — AI-generated summary, injected into context for later chapters
- `sortOrder` — manual ordering
- `wordCount`
- `parentChapterId` — enables chapter forking (alt drafts)

The `summary` column is the key to the continuity engine. When a chapter is saved, the summarize route generates a 2-3 sentence summary. That summary is then available to all subsequent generation calls.

#### `characters`

Rich character profiles:

- `name`, `role`, `age`, `appearance`
- `personality`, `desires`, `fears`, `internalConflict`
- `arc` — character change arc
- `alwaysInContext` (boolean) — whether to inject full detail or compress to one line
- `antagonistType` — `Narcissist | Machiavellian | Psychopath | Ideological | Systemic`
- NVC profile: `nvcGestures`, `nvcPosture`, `nvcProximity`, `nvcVocalPatterns`
- Language profile: `languageRegister`, `sentenceStructure`, `vocabularyLevel`, `speechPatterns`
- `higgsfield_soul_id` — trained Higgsfield Soul ID for consistent character portraits

**Why NVC and language profiles?**
The AI generates dialogue and action for characters. Without physical and linguistic ground truth, every character sounds and moves the same. The NVC profile is injected so the model knows "Maya crosses her arms when lying and speaks faster under stress."

#### `locations`

- `name`, `description`, `atmosphere`
- `sensoryDetails` — sight, sound, smell, texture
- `alwaysInContext` (boolean) — same compression logic as characters
- `significance` — why this place matters to the story

#### `plotThreads`

- `name`, `description`, `status` (`open | dormant | resolved`)
- `connectedCharacterIds` (text array) — which characters are involved
- `chapterIntroduced`, `chapterResolved`

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

### Subscription Tables

#### `subscriptions`

- `userId`
- `stripeCustomerId`, `stripeSubscriptionId`
- `tier` — `free | story_pro | creator_pro | all_access`
- `status` — `active | cancelled | past_due | trialing`
- `currentPeriodEnd`

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
