# Deployment

How to deploy GhostWriter to Vercel, what environment variables are required, and the pre-launch checklist.

---

## Prerequisites

1. A [Neon](https://neon.tech) PostgreSQL database
2. A [Vercel](https://vercel.com) account
3. An [Anthropic](https://console.anthropic.com) API key
4. A [Stripe](https://stripe.com) account with three products created
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
| `NEXTAUTH_URL` | `https://ghost-writer.cc` |
| `NEXT_PUBLIC_APP_URL` | Same as `NEXTAUTH_URL` |
| `ANTHROPIC_API_KEY` | From Anthropic console |
| `ENCRYPTION_KEY` | 64-char hex: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

#### Stripe (Required for subscriptions)

| Variable | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` (use `sk_test_...` for staging) |
| `STRIPE_WEBHOOK_SECRET` | From Stripe → Webhooks → signing secret |
| `STRIPE_STORY_PRO_PRICE_ID` | `price_xxx` |
| `STRIPE_CREATOR_PRO_PRICE_ID` | `price_xxx` |
| `STRIPE_ALL_ACCESS_PRICE_ID` | `price_xxx` |

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

## Stripe Setup

### 1. Create Products

In Stripe Dashboard → Products → Add Product:

- **Story Pro** — Recurring, Monthly, ₹799 (or your price)
- **Creator Pro** — Recurring, Monthly, ₹399
- **All Access** — Recurring, Monthly, ₹999

Copy each Price ID (`price_xxx`) to the corresponding Vercel env var.

### 2. Configure Webhooks

In Stripe Dashboard → Developers → Webhooks → Add Endpoint:

- **Endpoint URL:** `https://ghost-writer.cc/api/webhooks/stripe`
- **Events to send:**
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

Copy the Signing Secret to `STRIPE_WEBHOOK_SECRET`.

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
- [x] Build passing on Vercel (`ghostwriter` project, deployment dpl_4dirjEb2muXwR7Hww6JSkysavt2R) *(done 2026-06-05)*
- [x] 18 platform work packets seeded via `node scripts/seed-work-packets.js` *(done 2026-06-05)*
- [x] `pgvector` extension enabled on Neon (`node scripts/enable-pgvector.js`) *(done 2026-06-05)*
- [x] Schema in sync with production DB (`node scripts/fix-embedding-column.js` applied vector(1536) column; drizzle-kit shows a false-positive diff for custom vector type — the DB is correct) *(done 2026-06-05)*
- [x] `OPENAI_API_KEY` added to Vercel *(done 2026-06-05)* — trigger embedding backfill: `POST /api/work-packets/embed`
- [ ] Stripe products created and price IDs configured *(India invite-only — pending approval)*
- [ ] Stripe webhook endpoint configured and verified
- [x] Resend domain verified and DNS propagated *(done 2026-06-05)*
- [ ] Test a complete payment flow end-to-end (Stripe test mode → live mode)
- [x] `NEXTAUTH_URL` set to `https://ghost-writer.cc` *(done 2026-06-05)*
- [x] Custom domain `ghost-writer.cc` added to Vercel and env vars updated *(done 2026-06-05)*
- [ ] `NEXTAUTH_SECRET` is a strong random string (not the same as dev)
- [ ] `ENCRYPTION_KEY` stored securely (if lost, encrypted user API keys cannot be decrypted)
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

Without Stripe, Resend, and Upstash set, the app runs but:
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
