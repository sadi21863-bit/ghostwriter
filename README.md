# GhostWriter AI

An AI-powered writing platform for novelists, screenwriters, and content creators. Write fiction across 25 specialized modes, generate video production packages, analyse YouTube trends, and repurpose content for TikTok and Instagram — all within a single continuity-aware workspace.

Built with Next.js 16 App Router, Drizzle ORM, Neon PostgreSQL, and Anthropic Claude.

---

## What This Is

GhostWriter is a full-stack SaaS writing studio. The core idea: every AI generation call carries the full context of the project — characters, locations, style DNA from reference books, story memories, and chapter summaries — so the model never contradicts what was already written.

On top of that continuity engine sit two product surfaces:

**Fiction writing** — 25 specialized modes (dialogue, combat, atmosphere, tension, emotional, horror, romance, mystery, etc.), each backed by academic research in their system prompts. A Style DNA system reads your reference novels and applies their voice fingerprint to every generation.

**Creator tools** — YouTube trend dissection, TikTok script generation, hook A/B testing, channel autopsy, SEO optimization, virality prediction, guest intelligence, and content repurposing.

---

## Feature Overview

| Surface | Features |
|---|---|
| Writing modes | Brainstorm, Outline, Write + 20 library modes (action, atmosphere, combat, comedy, composition, dialogue, emotional, endings, ethics, historical, horror, isekai, monologue, mystery, romance, sci-tech, setting, sports, tension, thriller, voice) |
| Continuity engine | Per-chapter summarization, story memory extraction, character evolution log, chapter forking |
| World Bible | Characters (personality, desires, NVC profile, language patterns), locations, plot threads — all injected into every prompt |
| Style DNA | Upload reference works → 6-attribute style fingerprint → applied to all generations |
| Creator tools | Video dissection, trend search (YouTube + Instagram), TikTok script + hook generation, hook A/B test, retention editing, channel autopsy, guest intelligence, creator SEO, virality predictor, content repurposing |
| Comic Studio | AI-generated comic panels with character consistency |
| Production Studio | Shot lists, scene breakdowns, Higgsfield video generation (image-to-video, text-to-video, lipsync) |
| Export | DOCX manuscript, book blurb, query letter, episode pack |
| Subscription | Free / Story Pro / Creator Pro / All Access — enforced per-feature gate |

---

## Quick Start

```powershell
# 1. Clone and install
git clone https://github.com/sadi21863-bit/ghostwriter.git
cd ghostwriter
npm install

# 2. Configure environment
copy .env.local.example .env.local
# Edit .env.local — fill in at minimum: DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, ANTHROPIC_API_KEY, ENCRYPTION_KEY

# 3. Push the schema (Windows: drizzle-kit reads .env, not .env.local)
Copy-Item .env.local .env -Force
npx drizzle-kit push

# 4. Start the dev server
npm run dev
# Open http://localhost:3001
```

---

## Environment Variables

### Required (app will not start without these)

| Variable | How to get it |
|---|---|
| `DATABASE_URL` | Neon console → Connection string. Append `?sslmode=require`. |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3001` in dev; full public URL in prod |
| `NEXT_PUBLIC_APP_URL` | Same as `NEXTAUTH_URL` |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — 64-char hex; encrypts stored Higgsfield keys at rest |

### Required for Payments (Razorpay)

| Variable | How to get it |
|---|---|
| `RAZORPAY_KEY_ID` | Razorpay dashboard → Settings → API Keys |
| `RAZORPAY_KEY_SECRET` | Razorpay dashboard → Settings → API Keys |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay dashboard → Webhooks → signing secret |
| `RAZORPAY_STORY_PRO_MONTHLY_PLAN_ID` | Razorpay dashboard → Subscriptions → Plans |
| `RAZORPAY_STORY_PRO_ANNUAL_PLAN_ID` | Razorpay dashboard → Subscriptions → Plans |
| `RAZORPAY_CREATOR_PRO_MONTHLY_PLAN_ID` | Razorpay dashboard → Subscriptions → Plans |
| `RAZORPAY_CREATOR_PRO_ANNUAL_PLAN_ID` | Razorpay dashboard → Subscriptions → Plans |
| `RAZORPAY_ALL_ACCESS_MONTHLY_PLAN_ID` | Razorpay dashboard → Subscriptions → Plans |
| `RAZORPAY_ALL_ACCESS_ANNUAL_PLAN_ID` | Razorpay dashboard → Subscriptions → Plans |

### Required for Email

| Variable | How to get it |
|---|---|
| `RESEND_API_KEY` | resend.com → API keys |

### Required for Cron Security

| Variable | Value |
|---|---|
| `CRON_SECRET` | `openssl rand -base64 32` — validated as Bearer token on `/api/cron/cleanup` |

### Optional — Rate Limiting (strongly recommended in production)

| Variable | Notes |
|---|---|
| `UPSTASH_REDIS_REST_URL` | upstash.com → free Redis DB |
| `UPSTASH_REDIS_REST_TOKEN` | Same DB |

When absent, rate limiting is **fail-open** — the app works, just unmetered. Always set in production.

### Optional — Video Dissection

| Variable | Notes |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio — required for Dissect Video feature |
| `YOUTUBE_DATA_API_KEY` | YouTube Data API v3 — required for trend search |
| `GITHUB_PAT` | Personal access token with `repo` scope — dispatches the analysis workflow |
| `GITHUB_REPO_OWNER` | GitHub username that owns the workflow repo |
| `GITHUB_REPO_NAME` | Repo with the `dissect-video` GitHub Actions workflow |

### Optional — OpenAI (Embeddings + Audio Novel TTS)

| Variable | Notes |
|---|---|
| `OPENAI_API_KEY` | Used for `text-embedding-3-small` in `/api/work-packets/embed`, and as a fallback `tts-1` key for Audio Novel (`/api/audio/generate`). Not used for any text generation. |

### Optional — Video Generation

| Variable | Notes |
|---|---|
| `HIGGSFIELD_API_KEY` | Higgsfield native API — Soul ID training |
| `SEGMIND_API_KEY` | Segmind proxy — Soul 2.0 images, DoP video, text-to-video |

### Optional — Monitoring

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry project DSN — client error tracking |
| `SENTRY_AUTH_TOKEN` | Sentry — upload source maps |
| `NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY` | GrowthBook — feature flags |

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 3001 |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm test` | Vitest unit tests (single run) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run db:push` | Push Drizzle schema to Neon |
| `npm run db:studio` | Drizzle Studio — visual DB browser |

---

## Architecture Overview

```
Request
  │
  ▼
Next.js 16 App Router
  │
  ├─ Pages (src/app/)
  │   ├─ / (landing)
  │   ├─ /dashboard (project list)
  │   ├─ /project/[projectId] (editor)
  │   ├─ /settings (plan + billing)
  │   └─ /reader/[token] (public read-only)
  │
  └─ API Routes (src/app/api/)
      ├─ /ai/*           — AI generation (all Anthropic calls here)
      ├─ /projects/*     — CRUD + per-project AI features
      ├─ /audio/*        — TTS + lipsync (Higgsfield)
      ├─ /webhooks/*     — Razorpay events
      └─ /cron/*         — Scheduled cleanup

src/
├─ lib/
│   ├─ ai/
│   │   ├─ engine.ts           — MODELS constants, all 21 generation modes, system prompts
│   │   ├─ context-builder.ts  — Assembles project context string from DB data
│   │   ├─ composer.ts         — Multi-layer composition mixing
│   │   ├─ embeddings.ts       — OpenAI embedding calls
│   │   └─ [genre]/            — 20 genre libraries (each: archetypes, context, types)
│   ├─ auth-helpers.ts         — getRequiredSession() — throws 401 if unauthenticated
│   ├─ ratelimit.ts            — Upstash rate limiting (fail-open)
│   ├─ subscription.ts         — Tier lookup + feature gate enforcement
│   ├─ higgsfield/             — Video/image generation client
│   └─ formats.ts              — Story format rules (Novel, Screenplay, YouTube, etc.)
│
├─ db/
│   ├─ schema.ts               — All 23+ Drizzle tables
│   └─ index.ts                — Neon serverless DB client
│
└─ components/
    ├─ GhostWriterApp.tsx       — Root app shell
    ├─ panels/toolbar/modes/    — 25 writing mode panels
    ├─ panels/toolbar/tools/    — 19 creator tool panels
    └─ ProductionStudio.tsx     — Video production UI
```

### Key Design Decisions

| Decision | Why |
|---|---|
| All Anthropic/OpenAI calls in route handlers | API keys never reach the browser; components only call fetch |
| Application-level ownership checks, no RLS | Every route queries `WHERE userId = session.user.id`; simpler than Supabase RLS and works with any Postgres |
| `getRequiredSession()` throws 401 response | Eliminates null-check boilerplate in every protected route handler |
| MODELS constants in `engine.ts` | Single source of truth — all 28 route files import `MODELS.default` / `MODELS.fast`; changing models means editing one file |
| Rate limiter fail-open | Dev and demo environments work without Redis configured; missing env vars don't crash the app |
| Video dissection via GitHub Actions | Gemini video analysis takes 2-4 minutes, far exceeding Vercel's 60s function limit |
| Upstash Redis for rate limiting | Serverless-native; no persistent connections; free tier covers development |
| Prompt caching (ephemeral blocks) | Static context (mode instructions + genre rules) is cached per-conversation, cutting latency and token cost on repeated generations |
| pgvector for work-packet search | Semantic search over craft library principles without a dedicated vector DB service |

---

## Subscription Tiers

| Tier | Monthly | Unlocks |
|---|---|---|
| Free | — | 10 AI generations/month (Haiku), 3 core modes only |
| Story Pro | ₹1,500 | 500 generations/month (Sonnet), all 22 library modes, Style DNA, Story Memory, Comic Studio, Production Studio |
| Creator Pro | ₹2,000 | All creator tools (trend search, dissection, hook A/B, retention, guest intel, TikTok, repurpose) |
| All Access | ₹2,500 | Everything — unlimited generations, Higgsfield pipeline, YouTube reference video analysis |

Feature gates are enforced server-side in every route via `canAccessFeature(tier, featureName)`. Payments are processed by Razorpay (Indian payment gateway).

---

## Security Notes

- Every project route checks `projects.userId === session.user.id` before any DB operation or AI call.
- Child resource routes (chapters, characters, locations, plot threads) additionally check `childTable.projectId = projectId` in all UPDATE/DELETE WHERE clauses to prevent IDOR cross-project mutations.
- All collection POST routes (`/characters`, `/locations`, `/plot-threads`, `/reference-works`) allowlist fields explicitly — no spreading raw request bodies into DB inserts.
- Higgsfield API keys supplied by users are AES-256 encrypted at rest using `ENCRYPTION_KEY`. GET routes return only `keySet: boolean` and `keyLast4: string`.
- Rate limiting via Upstash Redis: AI routes 20/min, auth routes 5/hour, general routes 100/min. Fail-open when Redis is not configured.
- Registration and forgot-password routes enforce IP-based rate limiting (5 requests/hour) to prevent abuse.
- The cleanup cron (`/api/cron/cleanup`) requires `Authorization: Bearer CRON_SECRET`.
- Image data is never stored in the database — URLs to external storage are stored instead.

---

## Detailed Documentation

See the [docs/](docs/) folder for deep-dives:

| File | Covers |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Full request lifecycle, data flow, how all layers connect |
| [docs/ai-engine.md](docs/ai-engine.md) | MODELS constants, all 25 modes, prompt caching, context assembly |
| [docs/database.md](docs/database.md) | All 30+ tables, relationships, schema decisions |
| [docs/auth-and-security.md](docs/auth-and-security.md) | Auth flow, rate limiting, ownership checks, encryption |
| [docs/security.md](docs/security.md) | Threat model, defense in depth, security invariants, all protections |
| [docs/subscription.md](docs/subscription.md) | Tier system, feature gates, Razorpay integration, grace period logic |
| [docs/api-routes.md](docs/api-routes.md) | All API endpoints with auth requirements and descriptions |
| [docs/components.md](docs/components.md) | Component hierarchy, panel system, how modes connect to routes |
| [docs/video-and-media.md](docs/video-and-media.md) | Higgsfield, Segmind, Soul ID, video generation pipeline |
| [docs/deployment.md](docs/deployment.md) | Vercel setup, env vars, DB migrations, pre-launch checklist |
| [docs/gotchas.md](docs/gotchas.md) | Known quirks, Windows-specific steps, LSP false positives |

---

## License

Private — all rights reserved.
