# GhostWriter AI
AI ghostwriting platform.

## Stack
Next.js 16, Drizzle ORM 0.45.x, Neon PostgreSQL, NextAuth, Anthropic Claude, Tailwind v4, Vercel.

## Architecture
- Continuity engine: chapter summaries in AI context
- Style DNA: reference works to 6 attributes
- Modes: Brainstorm / Outline / Write / 22 library modes + creator tools
- World Bible: characters (with contextVisibility), locations, plot threads
- Prompt caching: static/dynamic context split; static block cached (ephemeral)
- Context budget: buildStaticContext caps at 8,000 tokens via priority-ordered section assembly (`[Context trimmed — project too large]` marker if exceeded); /api/ai/generate re-caps per subscription tier via capContextForTier (free/story_pro/creator_pro/all_access char limits; line-boundary-aware re-trim with `[Context truncated for tier limit]` marker if it re-trims)
- Model tiers: Haiku (free-tier generation + summaries/grading), Sonnet-4-6 (default generation), Opus-4-6 (quality/composition modes)
- Free tier: 10 gen/month on Haiku; 21 library modes gated (403 for free users)
- Voice fingerprinting: 10 stylometric markers extracted from last 5 chapters → injected as binding constraints
- AIisms check: opt-in per project (Story Pro+) — 20 fiction tells blocked post-generation
- Quality check: Tier 1 Haiku + Tier 2 Sonnet in parallel, non-blocking
- Toast system: src/lib/toast.ts + ToastContainer — no external state manager
- Bundle: 9 heavy panels as dynamic imports (StoryHealth, Export, AltDraft, SprintMode, UpgradePrompt, CommandPalette, QualityReview, WorldBiblePanel, ToolbarPanel)
- Series/Universe architecture: storyType (linear/series/universe-story/parallel) per project; universes table with characters + events; series context chains previous books' memories; universe context injects canonical events + character states
- Voice fingerprint display: visible in WorldBiblePanel settings when 3+ chapters exist
- Cost monitoring: GET /api/admin/cost-report (ADMIN_SECRET-gated) — 30-day blended cost estimate by model, top users, top modes
- Subscriptions: every account gets a `subscriptions` row at creation (credentials register + OAuth `events.createUser`, both upsert-safe); `scripts/backfill-subscriptions.js` seeds pre-existing accounts
- Subscription tier is verified server-side from the Razorpay subscription's `notes.tier`/`notes.userId` (set at creation in `POST /api/subscription`) in both `/api/subscription/verify` and `/api/webhooks/razorpay` — client-supplied tier is never trusted
- 7-day Story Pro trial: `users.trialEndAt` set at registration, checked in `getUserTier()` — free users with an unexpired trial get story_pro access until it lapses
- Email verification: token-based (`email_verification_tokens` table), sent at registration; `/api/auth/verify-email?token=...` sets `users.emailVerified`; settings shows a resend banner if unverified
- Rate limiting: `checkAiRateLimit` fails CLOSED (503) in production if Upstash is unconfigured or throws; dev fails open
- Stripe fully removed (portal/webhook routes, STRIPE_PRICES, npm deps, copy) — Razorpay Subscriptions only
- Razorpay test-mode quirk: `subscriptions.create`/`cancel` in `/api/subscription` wrapped in `withAuthRetry()` (4 attempts, backoff) — Razorpay's test API intermittently 401s with valid credentials

## Commands
npm run dev (port 3001) / npm run db:push / npm run db:studio

## Schema migrations (Windows PowerShell)
Copy-Item .env.local .env -Force
npx drizzle-kit generate
npx drizzle-kit push

## Auth
Application-level ownership checks only. Never use Supabase RLS. Always call getRequiredSession() in protected routes.

## LSP false positives
"Props must be serializable" warnings for function props between 'use client' components are pre-existing false positives. tsc --noEmit exit 0 is ground truth.

## Required environment variables

| Variable | Purpose |
|---|---|
| DATABASE_URL | Neon PostgreSQL connection string |
| NEXTAUTH_SECRET | NextAuth JWT secret (random 32-char string) |
| NEXTAUTH_URL | Full public URL — must be https://www.ghost-writer.cc (www, not apex — apex 308s to www) |
| ANTHROPIC_API_KEY | Claude API key for all AI generation |
| RAZORPAY_KEY_ID | Razorpay API key ID |
| RAZORPAY_KEY_SECRET | Razorpay API key secret |
| RAZORPAY_WEBHOOK_SECRET | Razorpay webhook signing secret |
| RAZORPAY_STORY_PRO_MONTHLY_PLAN_ID | Story Pro monthly plan ID (plan_xxx) |
| RAZORPAY_STORY_PRO_ANNUAL_PLAN_ID | Story Pro annual plan ID |
| RAZORPAY_CREATOR_PRO_MONTHLY_PLAN_ID | Creator Pro monthly plan ID |
| RAZORPAY_CREATOR_PRO_ANNUAL_PLAN_ID | Creator Pro annual plan ID |
| RAZORPAY_ALL_ACCESS_MONTHLY_PLAN_ID | All Access monthly plan ID |
| RAZORPAY_ALL_ACCESS_ANNUAL_PLAN_ID | All Access annual plan ID |
| RESEND_API_KEY | Resend API key for transactional email |
| CRON_SECRET | Secret header for cron job routes |
| HIGGSFIELD_API_KEY | Higgsfield API key for video generation (optional) |
| GEMINI_API_KEY | Google Gemini key for video dissection (optional) |
| OPENAI_API_KEY | OpenAI key for embeddings only (text-embedding-3-small) |
| NEXT_PUBLIC_SENTRY_DSN | Sentry DSN for error monitoring (DSN hardcoded as fallback in sentry.*.config.ts) |

## Pre-launch checklist
1. ✅ Set all env vars in Vercel dashboard
2. ✅ Enable pgvector extension on Neon (`node scripts/enable-pgvector.js`, done 2026-06-05)
3. ✅ Schema in sync: `node scripts/fix-embedding-column.js` set vector(1536) directly; drizzle-kit shows false-positive warning for custom vector type dimensions — DB is correct
4. ✅ Seed work packets: `node scripts/seed-work-packets.js` (18 packets inserted 2026-06-05)
5. ✅ Embedding backfill: `POST /api/work-packets/embed` with `Authorization: Bearer <CRON_SECRET>` — 18/18 embedded (2026-06-06)
6. ✅ Sentry configured (DSN hardcoded in sentry.*.config.ts; add NEXT_PUBLIC_SENTRY_DSN to Vercel for explicitness)
7. ✅ Resend domain + DNS configured
8. ✅ DB indexes restored via `node scripts/add-indexes.js` (10 indexes, 2026-06-06)
9. ✅ Switched from Stripe to Razorpay (Sprint 24) — webhook at /api/webhooks/razorpay; Stripe fully removed 2026-06-10 (dead routes/portal/webhook, `STRIPE_PRICES`, `stripe`/`@stripe/stripe-js` deps, copy)
10. ✅ Razorpay plans created (6 plans: 3 tiers × monthly+annual), plan IDs in `.env.local`. ⏳ Current local test key intermittently fails (~30%+ "Authentication failed" on `subscriptions.create`, plus checkout reports "api key has expired" even on a freshly-verified key) — appears to be a Razorpay test-account/environment issue (3 different key pairs all show the same symptoms), unresolved as of 2026-06-11. Push working `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/plan IDs to Vercel once resolved.
11. ✅ NEXTAUTH_URL set to https://www.ghost-writer.cc in Vercel (2026-06-06)
12. ✅ Sprint 22 schema pushed: universes, universe_characters, project_character_states, universe_events tables; storyType/universeId/timelineSort/phase/seriesParentId on projects; storylineId on chapters (2026-06-06)
13. ✅ Sprint 25 schema pushed: updated_at columns on characters, locations, plot_threads (2026-06-09)
14. ✅ Launch-blocking security/trial/Stripe-cleanup block shipped 2026-06-10/11 (commits afe8c48..3f975ae): subscription-row seeding + upserts, server-side tier verification from Razorpay `notes`, 7-day trial, AI rate limiter fails closed, full Stripe removal, email verification (C-3). Schema for `email_verification_tokens`/`trial_end_at`/`razorpay_*` columns confirmed live in prod DB (2026-06-11).
15. ⏳ Manual Razorpay TEST-mode E2E (register → subscriptions row → trial tier → pay → tier flips → tamper-tier rejected → cancel → referral reward) — BLOCKED by item 10's Razorpay account issue. Code paths for all of the above are implemented and verified by reading; only the live checkout step is unverified.
16. Production URL: https://www.ghost-writer.cc
