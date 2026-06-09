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
- Model tiers: Haiku (free-tier generation + summaries/grading), Sonnet-4-6 (default generation), Opus-4-6 (quality/composition modes)
- Free tier: 10 gen/month on Haiku; 22 library modes gated (403 for free users)
- Voice fingerprinting: 10 stylometric markers extracted from last 5 chapters → injected as binding constraints
- AIisms check: opt-in per project (Story Pro+) — 20 fiction tells blocked post-generation
- Quality check: Tier 1 Haiku + Tier 2 Sonnet in parallel, non-blocking
- Toast system: src/lib/toast.ts + ToastContainer — no external state manager
- Bundle: 9 heavy panels as dynamic imports (StoryHealth, Export, AltDraft, SprintMode, UpgradePrompt, CommandPalette, QualityReview, WorldBiblePanel, ToolbarPanel)
- Series/Universe architecture: storyType (linear/series/universe-story/parallel) per project; universes table with characters + events; series context chains previous books' memories; universe context injects canonical events + character states
- Voice fingerprint display: visible in WorldBiblePanel settings when 3+ chapters exist

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
9. ✅ Switched from Stripe to Razorpay (Sprint 24) — webhook at /api/webhooks/razorpay
10. ⏳ Create Razorpay plans (6 plans: 3 tiers × monthly+annual) and add plan IDs to Vercel env vars
11. ✅ NEXTAUTH_URL set to https://www.ghost-writer.cc in Vercel (2026-06-06)
12. ✅ Sprint 22 schema pushed: universes, universe_characters, project_character_states, universe_events tables; storyType/universeId/timelineSort/phase/seriesParentId on projects; storylineId on chapters (2026-06-06)
13. ✅ Sprint 25 schema pushed: updated_at columns on characters, locations, plot_threads (2026-06-09)
14. Production URL: https://www.ghost-writer.cc
