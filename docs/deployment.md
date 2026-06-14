# Deployment

How to deploy GhostWriter to Vercel, what environment variables are required, and the pre-launch checklist.

---

## Prerequisites

1. A [Neon](https://neon.tech) PostgreSQL database (with pgvector extension enabled)
2. A [Vercel](https://vercel.com) account
3. An [Anthropic](https://console.anthropic.com) API key
4. A [Razorpay](https://razorpay.com) account with three subscription plans created
5. A [Resend](https://resend.com) account for email
6. An [Upstash](https://upstash.com) Redis database (free tier works)

---

## Vercel Deployment

### 1. Import Repository

1. Go to vercel.com/new
2. Import the GitHub repository
3. Framework preset: **Next.js** (auto-detected)
4. Root directory: `ghostwriter` (if monorepo) or `.` (if repo root is the app)
5. Build command: `next build` (default)
6. Output directory: `.next` (default)
7. Install command: `npm install` (default)

### 2. Set Environment Variables

In the Vercel dashboard → Project → Settings → Environment Variables, add:

#### Required

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgres://user:pass@host/db?sslmode=require` |
| `NEXTAUTH_SECRET` | Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://www.ghost-writer.cc` (www — apex 308s to www, breaking auth) |
| `NEXT_PUBLIC_APP_URL` | Same as `NEXTAUTH_URL` |
| `ANTHROPIC_API_KEY` | From Anthropic console |
| `ENCRYPTION_KEY` | 64-char hex: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

#### Razorpay (Required for subscriptions)

| Variable | Value |
|---|---|
| `RAZORPAY_KEY_ID` | From Razorpay → Settings → API Keys |
| `RAZORPAY_KEY_SECRET` | From Razorpay → Settings → API Keys |
| `RAZORPAY_WEBHOOK_SECRET` | From Razorpay → Webhooks → signing secret |
| `RAZORPAY_STORY_PRO_MONTHLY_PLAN_ID` | Razorpay plan ID for Story Pro monthly |
| `RAZORPAY_STORY_PRO_ANNUAL_PLAN_ID` | Razorpay plan ID for Story Pro annual |
| `RAZORPAY_CREATOR_PRO_MONTHLY_PLAN_ID` | Razorpay plan ID for Creator Pro monthly |
| `RAZORPAY_CREATOR_PRO_ANNUAL_PLAN_ID` | Razorpay plan ID for Creator Pro annual |
| `RAZORPAY_ALL_ACCESS_MONTHLY_PLAN_ID` | Razorpay plan ID for All Access monthly |
| `RAZORPAY_ALL_ACCESS_ANNUAL_PLAN_ID` | Razorpay plan ID for All Access annual |

#### Email (Required)

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | From Resend dashboard |

#### Cron (Required)

| Variable | Value |
|---|---|
| `CRON_SECRET` | Generate: `openssl rand -base64 32` |

#### Rate Limiting (Required for production)

| Variable | Value |
|---|---|
| `UPSTASH_REDIS_REST_URL` | From Upstash dashboard |
| `UPSTASH_REDIS_REST_TOKEN` | From Upstash dashboard |

#### Optional — Video and Trends

| Variable | Value |
|---|---|
| `GEMINI_API_KEY` | From Google AI Studio |
| `YOUTUBE_DATA_API_KEY` | From Google Cloud Console → YouTube Data API v3 |
| `GITHUB_PAT` | Personal access token with `repo` scope |
| `GITHUB_REPO_OWNER` | Your GitHub username |
| `GITHUB_REPO_NAME` | Repo with the dissect-video workflow |
| `HIGGSFIELD_API_KEY` | From Higgsfield dashboard |
| `SEGMIND_API_KEY` | From Segmind dashboard |
| `OPENAI_API_KEY` | For embeddings (craft library search) |

#### Optional — Monitoring

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | From Sentry project settings |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source maps |
| `NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY` | GrowthBook client key |

### 3. Deploy

Click "Deploy." The first deploy will build and deploy the app.

---

## Database Setup (After First Deploy)

### 1. Enable pgvector on Neon

In the Neon console → your database → SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

This is required before pushing the schema. If you push without it, the `workPackets.embedding` column creation fails.

### 2. Push the Schema

From your local machine (with `.env.local` configured):

```powershell
# Windows PowerShell
Copy-Item .env.local .env -Force
npx drizzle-kit push
```

This creates all tables. Running `db:push` in production is safe — Drizzle only adds what's missing and never drops columns.

### 3. Seed the Craft Library

After schema push, seed the 18 platform work packets using the local seed script:

```powershell
# From the project root (reads DATABASE_URL from .env.local)
node scripts/seed-work-packets.js
```

Alternatively via the admin API (requires `ADMIN_SECRET` env var in Vercel):

```bash
POST https://ghost-writer.cc/api/admin/seed-work-packets
Authorization: Bearer YOUR_ADMIN_SECRET
```

### 4. Generate Embeddings

After seeding:

```bash
POST https://ghost-writer.cc/api/work-packets/embed
Authorization: Bearer YOUR_CRON_SECRET
```

This generates `text-embedding-3-small` embeddings for all craft library principles. Required for the semantic search feature. Requires `OPENAI_API_KEY`.

---

## Razorpay Setup

### 1. Create Subscription Plans

In Razorpay Dashboard → Subscriptions → Plans → Create New Plan:

- **Story Pro Monthly** — Recurring, ₹1,500/month
- **Story Pro Annual** — Recurring, ₹18,000/year (or preferred annual price)
- **Creator Pro Monthly** — Recurring, ₹2,000/month
- **Creator Pro Annual** — Recurring, ₹24,000/year
- **All Access Monthly** — Recurring, ₹2,500/month
- **All Access Annual** — Recurring, ₹30,000/year

Copy each Plan ID (format: `plan_xxx`) to the corresponding Vercel env var.

### 2. Configure Webhooks

In Razorpay Dashboard → Settings → Webhooks → Add Webhook:

- **Webhook URL:** `https://ghost-writer.cc/api/webhooks/razorpay`
- **Events to send:**
  - `subscription.activated`
  - `subscription.charged`
  - `subscription.cancelled`
  - `subscription.completed`

Copy the Signing Secret to `RAZORPAY_WEBHOOK_SECRET`.

### 3. Test the Flow

Use Razorpay's test mode (test API keys). Create a test subscription, verify the webhook fires, check the `subscriptions` table in Drizzle Studio.

---

## Resend Setup

1. Create account at resend.com
2. Add and verify your domain (for custom from address)
3. Configure DNS records as shown in Resend dashboard
4. Copy API key to `RESEND_API_KEY`

Update `src/lib/email/index.ts` to set your from address:
```typescript
from: "GhostWriter <noreply@ghost-writer.cc>"
```

---

## Cron Job

`vercel.json` configures the cleanup cron:

```json
{
  "crons": [{
    "path": "/api/cron/cleanup",
    "schedule": "0 2 * * *"
  }]
}
```

This runs daily at 02:00 UTC. Vercel sends a `GET` request with `Authorization: Bearer CRON_SECRET` header.

The cleanup route deletes:
- Expired reader sessions
- Stale video analysis jobs (older than 24 hours, not complete)
- Old generation history (configurable retention)

---

## Pre-Launch Checklist

Before going live:

- [x] All required env vars set in Vercel dashboard *(done 2026-06-05)*
- [x] Build passing on Vercel *(done 2026-06-05)*
- [x] 18 platform work packets seeded via `node scripts/seed-work-packets.js` *(done 2026-06-05)*
- [x] `pgvector` extension enabled on Neon (`node scripts/enable-pgvector.js`) *(done 2026-06-05)*
- [x] Schema in sync with production DB — Sprint 21 columns (`aiisms_check`, `context_visibility`) pushed via `drizzle-kit push` *(done 2026-06-06)*
- [x] DB indexes restored via `node scripts/add-indexes.js` (10 indexes) *(done 2026-06-06)*
- [x] `OPENAI_API_KEY` added to Vercel; embedding backfill complete — 18/18 packets embedded *(done 2026-06-06)*
- [x] Sprint 21 schema pushed: `aiisms_check`, `context_visibility` columns *(done 2026-06-06)*
- [x] Sprint 22 schema pushed: `universes`, `universe_characters`, `project_character_states`, `universe_events` tables; `story_type`/`universe_id`/`timeline_sort`/`phase`/`series_parent_id` on projects; `storyline_id` on chapters *(done 2026-06-06)*
- [x] Razorpay integrated (Sprint 24): switched from Stripe. Webhook handler at `/api/webhooks/razorpay` *(done)*
- [x] Sprint 25 schema pushed: `updated_at` columns added to `characters`, `locations`, `plot_threads` tables *(done 2026-06-09)*
- [x] Razorpay plans created (6 plans: 3 tiers × monthly+annual), plan IDs in `.env.local` *(done — see CLAUDE.md item 10; push plan IDs + new key pair to Vercel before launch)*
- [ ] Razorpay webhook endpoint configured at `ghost-writer.cc/api/webhooks/razorpay`
- [x] Resend domain verified and DNS propagated *(done 2026-06-05)*
- [x] Automated Razorpay TEST-mode E2E (create → webhook activate → tier flip → webhook cancel) — 8/9 PASS *(done 2026-06-13/14, see docs/testing.md §9d)*. Remaining: real-browser Checkout overlay in live mode (manual, not automatable).
- [x] `NEXTAUTH_URL` set to `https://www.ghost-writer.cc` *(done 2026-06-06 — www required; apex 308s to www)*
- [x] Custom domain `ghost-writer.cc` added to Vercel and env vars updated *(done 2026-06-05)*
- [x] Sentry configured — DSN hardcoded in `sentry.*.config.ts`; add `NEXT_PUBLIC_SENTRY_DSN` to Vercel for explicitness *(done 2026-06-05)*
- [ ] GrowthBook configured for feature flags (optional)
- [ ] Test password reset email flow

---

## Local Development

```powershell
# Install
npm install

# Set up environment
copy .env.local.example .env.local
# Edit .env.local

# Push schema
Copy-Item .env.local .env -Force
npx drizzle-kit push

# Start dev server (port 3001)
npm run dev
```

### Minimum viable local `.env.local`

```
DATABASE_URL=postgres://...?sslmode=require
NEXTAUTH_SECRET=any-random-string-for-local-dev
NEXTAUTH_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3001
ANTHROPIC_API_KEY=sk-ant-...
ENCRYPTION_KEY=64-char-hex-string
```

Without Razorpay, Resend, and Upstash set, the app runs but:
- Subscriptions don't work (all users are on free tier)
- Emails don't send
- Rate limiting is disabled (fail-open)

This is fine for local development.

---

## Updating the Schema

When adding new tables or columns:

```powershell
# 1. Edit src/db/schema.ts
# 2. Sync .env files
Copy-Item .env.local .env -Force
# 3. Push changes
npx drizzle-kit push
```

`db:push` is safe to run repeatedly — it only applies changes, never drops what already exists unless you explicitly use `drizzle-kit drop`.

To inspect the current database state:
```powershell
npx drizzle-kit studio
# Opens browser at http://localhost:4983
```
