# GhostWriter AI
AI ghostwriting platform.

## Stack
Next.js 16, Drizzle ORM 0.45.x, Neon PostgreSQL, NextAuth, Anthropic Claude, Tailwind v4, Vercel.

## OpenAI policy
"No OpenAI for generation" applies to story/text generation only (Claude-only). OpenAI is permitted for: embeddings (`text-embedding-3-small`, craft library search) and Audio Novel TTS (`tts-1`, `src/app/api/audio/generate/route.ts`). Higgsfield replaces OpenAI for image/video.

## Architecture
- Continuity engine: chapter summaries in AI context
- Style DNA: reference works to 6 attributes
- Modes: Brainstorm / Outline / Write / 23 library modes + creator tools
- World Bible: characters (with contextVisibility), locations, plot threads
- Prompt caching: static/dynamic context split; static block cached (ephemeral)
- Context budget: buildStaticContext caps at 8,000 tokens via priority-ordered section assembly (`[Context trimmed — project too large]` marker if exceeded); /api/ai/generate re-caps per subscription tier via capContextForTier (free/story_pro/creator_pro/all_access char limits; line-boundary-aware re-trim with `[Context truncated for tier limit]` marker if it re-trims)
- Model tiers: Haiku (free-tier generation + summaries/grading), Sonnet-4-6 (default generation), Opus-4-6 (quality/composition modes)
- Free tier: 10 gen/month on Haiku; 23 library modes gated (403 for free users)
- Voice fingerprinting: 10 stylometric markers extracted from last 5 chapters → injected as binding constraints
- AIisms check: opt-in per project (Story Pro+) — 20 fiction tells blocked post-generation
- Quality check: Tier 1 Haiku + Tier 2 Sonnet in parallel, non-blocking
- Toast system: src/lib/toast.ts + ToastContainer — no external state manager
- Bundle: 10 heavy panels as dynamic imports (StoryHealth, Export, AltDraft, SprintMode, UpgradePrompt, CommandPalette, QualityReview, WorldBiblePanel, ToolbarPanel, StoryBible)
- Mode Registry (`src/lib/modes/registry.ts`): `MODE_REGISTRY` is the single source of truth for all 26 `GenerationMode`s — label, modelTier, gate, qualityCheck, visibility, slash command, keywords, realismDomains. Derived by engine.ts (model tier + system prompts via `MI`), subscription.ts (`GATED_MODES`), formats.ts (`MODES`), useAIActions, ToolbarPanel
- "One Path, Five Stages" UI redesign (`writingRoomShell`/`homeRedesign` GrowthBook flags, both OFF by default): `WritingRoom.tsx` replaces the toolbar-driven flow with an Idea→Structure→Draft→Polish→Export stage ladder (`src/lib/guide/next-action.ts` `currentStage()`); `Home.tsx` replaces the dashboard; `/` slash menu routes into the existing `ToolbarPanel` via an Actions overlay; creator formats get remapped stage labels (Angle/Outline-Hooks/Script/Retention edit/Publish pack) with per-stage tool rows
- Guide Engine: `nextAction(project)` (`src/lib/guide/next-action.ts`) returns one actionable suggestion from a chapter-level ladder; surfaced via `GuideBar` + `/api/events` (`guide_clicked`/`guide_dismissed`); dismissal state in `projects.dismissedGuideIds` jsonb
- Story Bible overlay (`src/components/StoryBible.tsx`, writingRoomShell-gated): full-screen Cast/World/Threads CRUD; auto-extraction suggestion chip (`EntitySuggestionsChip` + `src/lib/ai/entity-extraction.ts`) proposes Story Bible field updates from generated write-mode text
- Beat detection: `classifyBeat()` (`src/lib/modes/classify.ts`) matches a drafted beat against the 23 library modes' keywords; surfaced as `BeatDetectionChip` in WritingRoom's Draft stage
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
| OPENAI_API_KEY | OpenAI key for embeddings (text-embedding-3-small) and Audio Novel TTS (tts-1); fallback when a user has no own key set |
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
10. ✅ Razorpay plans created (6 plans: 3 tiers × monthly+annual), plan IDs in `.env.local`. ✅ Previous ~30%+ "Authentication failed" issue on `subscriptions.create` (3 prior key pairs, unresolved as of 2026-06-11) is RESOLVED as of 2026-06-13 — swapped to a new test key pair (`RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` updated in both `.env` and `.env.local`; `RAZORPAY_WEBHOOK_SECRET` is independent and unchanged). New key pair: `subscriptions.create` succeeded 3/3 then 1/1 with zero retries needed. Push the new `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` to Vercel before launch.
11. ✅ NEXTAUTH_URL set to https://www.ghost-writer.cc in Vercel (2026-06-06)
12. ✅ Sprint 22 schema pushed: universes, universe_characters, project_character_states, universe_events tables; storyType/universeId/timelineSort/phase/seriesParentId on projects; storylineId on chapters (2026-06-06)
13. ✅ Sprint 25 schema pushed: updated_at columns on characters, locations, plot_threads (2026-06-09)
14. ✅ Launch-blocking security/trial/Stripe-cleanup block shipped 2026-06-10/11 (commits afe8c48..3f975ae): subscription-row seeding + upserts, server-side tier verification from Razorpay `notes`, 7-day trial, AI rate limiter fails closed, full Stripe removal, email verification (C-3). Schema for `email_verification_tokens`/`trial_end_at`/`razorpay_*` columns confirmed live in prod DB (2026-06-11).
15. ✅ Automated Razorpay TEST-mode E2E run 2026-06-13/14 (unblocked by item 10's fix): register → subscriptions row (story_pro/trialing) → `subscriptions.create` (real Razorpay API call, status=created) → webhook signature verification (invalid sig rejected 400, valid sig accepted 200) → `subscription.activated` webhook flips tier to story_pro/active → `subscription.cancelled` webhook sets status=cancelled while preserving tier — 8/9 checks PASS. The 1 remaining check (`DELETE /api/subscription` direct cancel) is not a bug: confirmed via direct SDK call that Razorpay rejects cancelling a `created`-status subscription with `400 BAD_REQUEST_ERROR: "Subscription cannot be cancelled since no billing cycle is going on"` — a subscription must complete real Checkout (first billing cycle) before the cancel API accepts it. Only the literal browser-Checkout UI step remains unverified by automation; webhook-driven cancellation (the path that doesn't require it) is verified working.
16. ✅ "One Path, Five Stages" UI redesign (Phases 0-5, Mode Registry Plans 1-2) shipped 2026-06-14, commit `6d0ce30`. New `dismissedGuideIds` column on `projects` pushed to prod DB (drizzle migration 0005). The redesign itself (`WritingRoom`/`Home`/`StoryBible`/slash menu/beat detection) is behind `writingRoomShell`/`homeRedesign` GrowthBook flags, **both default OFF** — current layout is unaffected until enabled. Enable in GrowthBook + do a manual browser pass before exposing to real users (no browser-automation tooling available in this environment).
17. Production URL: https://www.ghost-writer.cc
