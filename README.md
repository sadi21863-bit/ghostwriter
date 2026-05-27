# GhostWriter AI

An AI-powered ghostwriting platform built with Next.js 14, Drizzle ORM, Neon PostgreSQL, and Anthropic Claude. Write novels, screenplays, YouTube scripts, and podcasts with a full continuity engine, character world-bible, and AI generation pipeline.

---

## Features

- **Multi-format writing** — Novel, Screenplay, YouTube Long-form, YouTube Short, Podcast
- **AI generation modes** — Brainstorm, Outline, Write (powered by Claude claude-sonnet-4-6)
- **Style DNA** — Analyse reference works and apply their style in every generated sentence
- **World Bible** — Characters, locations, plot threads with full detail and cross-linking
- **Continuity engine** — Per-chapter summaries injected into context; story memories with priority scoring
- **Production Studio** — Shot lists, scene breakdowns, and Higgsfield video generation
- **Trend Intelligence** — YouTube and Instagram trend search; video dissection via GitHub Actions + Gemini
- **Rate limiting** — 20 AI requests/minute per user via Upstash Redis (fail-open when not configured)
- **Creator Bible** — Channel niche, voice, content pillars for YouTube/podcast creators

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18.x or 20.x |
| npm | 9+ |
| PostgreSQL | Neon serverless (or any Postgres) |

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/sadi21863-bit/ghostwriter.git
cd ghostwriter

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.local.example .env.local
# Edit .env.local — see Environment Variables section below

# 4. Push the database schema (Windows: copy .env.local to .env first)
copy .env.local .env
npm run db:push

# 5. Start the dev server (port 3001)
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

---

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon (or any Postgres) connection string — include `?sslmode=require` for Neon |
| `NEXTAUTH_SECRET` | Random secret: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | App base URL (`http://localhost:3001` in dev) |
| `NEXT_PUBLIC_APP_URL` | Same as `NEXTAUTH_URL` |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) — powers all AI generation |
| `ENCRYPTION_KEY` | 64-char hex for encrypting stored API keys: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### Optional — Rate Limiting (recommended for production)

| Variable | Description |
|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL — create a free DB at [upstash.com](https://upstash.com) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |

When `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are absent the app runs without rate limiting (fail-open). In production these should always be set.

### Optional — Cron Security

| Variable | Description |
|----------|-------------|
| `CRON_SECRET` | Bearer token for the cleanup cron: `openssl rand -base64 32` |

### Optional — Video Dissection

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google AI Studio key — required for the Dissect Video feature |
| `YOUTUBE_DATA_API_KEY` | YouTube Data API v3 key — required for trend search |
| `GITHUB_PAT` | GitHub personal access token with `repo` scope — dispatches the analysis workflow |
| `GITHUB_REPO_OWNER` | GitHub username/org that owns the workflow repo |
| `GITHUB_REPO_NAME` | Repository name that contains the `dissect-video` workflow |

---

## Database

GhostWriter uses [Drizzle ORM](https://orm.drizzle.team/) with Neon PostgreSQL.

```bash
# Push schema changes to the database
copy .env.local .env   # drizzle-kit reads .env, not .env.local
npm run db:push

# Open Drizzle Studio (visual DB browser)
npm run db:studio
```

> **Why `copy .env.local .env`?** `drizzle-kit` does not read `.env.local` — it reads `.env`. Always sync before running DB commands.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3001 |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm test` | Run Vitest unit tests (single run) |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run db:push` | Push Drizzle schema to the database |
| `npm run db:studio` | Open Drizzle Studio |

---

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── ai/           # AI generation routes (generate, prose, pipeline, …)
│   │   ├── projects/     # CRUD for projects, chapters, characters, locations, …
│   │   └── cron/         # Scheduled cleanup (runs daily at 02:00 UTC on Vercel)
│   ├── project/[projectId]/  # Editor page
│   └── dashboard/        # Project list
├── components/
│   ├── panels/           # Left panel tabs: Chapters, Characters, Trends, …
│   ├── ProductionStudio  # Shot list UI
│   └── …
├── lib/
│   ├── ai/
│   │   ├── context-builder.ts   # Builds project context strings for AI prompts
│   │   └── engine.ts            # Claude API wrapper, generation pipelines
│   ├── dialogue/         # Dialogue archetype library (8 archetypes + psychological layer)
│   ├── emotional/        # Emotional arc engine
│   ├── atmosphere/       # Atmosphere rendering library
│   ├── tension/          # Tension escalation library
│   ├── auth-helpers.ts   # getRequiredSession() — throws 401 if unauthenticated
│   ├── env-check.ts      # Runtime env-var guards (Gemini, Anthropic keys)
│   └── ratelimit.ts      # Upstash rate-limit helpers (fail-open)
└── db/
    ├── schema.ts         # Drizzle schema (projects, chapters, characters, …)
    └── index.ts          # Drizzle client (Neon serverless)
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| All Claude calls in route handlers | Keeps API key server-side; components never touch the SDK |
| `getRequiredSession()` throws a 401 response | Eliminates boilerplate null-checks in every route |
| `alwaysInContext` flag on characters/locations/threads | Lets users demote minor entities to one-liners, keeping prompts lean |
| Memory priority scoring | `character_decision` (weight 3) > `event` (weight 2) > `general` (weight 1) + recency — most relevant facts survive the 8-memory cap |
| Upstash fail-open | Rate limiting is a nice-to-have in dev; missing env vars don't break the app |
| Video dissection via GitHub Actions | Long-running Gemini video analysis exceeds Vercel's 60 s function limit; offloaded to a workflow |

---

## Vercel Deployment

1. Import the repository in the [Vercel dashboard](https://vercel.com/new).
2. Set all required environment variables (see table above).
3. Add these **additional** variables for production:
   - `GITHUB_PAT`, `GITHUB_REPO_OWNER=sadi21863-bit`, `GITHUB_REPO_NAME=ghostwriter`
   - `ENCRYPTION_KEY` (64-char hex)
   - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
   - `CRON_SECRET`
4. Deploy. Vercel will automatically run the cleanup cron at 02:00 UTC daily (configured in `vercel.json`).

> **Note:** Never commit `.env.local` to git — it is listed in `.gitignore`.

---

## Security

- Every API route verifies that the requesting user owns the project (`projects.userId === session.user.id`) before any database operation.
- API keys stored by users (e.g. Higgsfield) are AES-256 encrypted at rest using `ENCRYPTION_KEY`. Keys are never returned in full from GET routes — only `keySet: boolean` and `keyLast4: string`.
- Image data is never stored in the database. Files are uploaded to Vercel Blob and the URL is stored.
- The cron endpoint is secured with a bearer token (`CRON_SECRET`).

---

## Testing

```bash
npm test
```

Unit tests live in `src/lib/ai/__tests__/`. The suite covers:

- Project header (name, format, genres)
- Full character detail injection (`alwaysInContext: true`)
- Minor character compression (`alwaysInContext: false`)
- 8-memory hard cap
- Category-weight priority scoring (`character_decision` beats `general`)
- Recency scoring (recent chapter facts beat stale ones)
- Style directive generation from reference works
- Empty-attribute reference work (no spurious STYLE DIRECTIVE block)

---

## License

Private — all rights reserved.
