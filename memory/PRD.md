# GhostWriter AI — Rebuild PRD

## Original problem statement
User's existing GhostWriter app (https://github.com/sadi21863-bit/ghostwriter) became too complex/confusing from incremental feature additions ("kept adding features which left gaps"). Asked to deeply analyse and **rebuild with the same vision** — coherent and usable.

## User decisions
- Keep ALL story features (they make the product unique).
- **Remove Creator tools** (YouTube / TikTok / Instagram / Podcast / trend / dissect / repurpose) — full focus on the **story** side.
- Keep tech stack close to original: **Next.js 16 + Postgres (Neon) + Drizzle + NextAuth + Anthropic**.
- Auth: **JWT email/password + Google login** (Google creds pending — empty in provided env).
- AI: keep Anthropic models exactly as assigned (haiku-4-5 / sonnet-4-6 / opus-4-8).

## Architecture (this environment)
- Next.js app at `/app` root; FastAPI proxy on 8001 forwards `/api/*` → Next on 3000; Neon cloud DB.
- Runs as production build (`next start`) because dev HMR websocket is blocked by ingress.
- See `test_credentials.md` for full runtime details.

## Codebase scale
- 425 TS/TSX files, ~45,600 LOC, 130+ API routes, 37 DB tables.
- Genre engines (combat/dialogue/horror/romance/etc.), continuity engine, World Bible, Style DNA, Comic Studio, Production Studio, Series Bibles, Universes, subscriptions (Razorpay).

## Core confusion (root cause) & rebuild strategy
- **Dual writing shells** gated by a disabled GrowthBook flag: legacy 130-prop `ToolbarPanel` mega-editor vs cleaner staged `WritingRoom` (Idea→Structure→Draft→Polish→Export). Users saw the messy legacy one.
- **Strategy:** commit to the single clean staged `WritingRoom` shell; remove creator formats so creator tooling is never surfaced; keep all story engines intact behind the coherent flow.

## Implemented (2026-06-18)
- ✅ Got the entire app running live in-environment (Neon + Anthropic + proxy + production build). Auth (email/pw) verified end-to-end through proxy.
- ✅ Driver-aware DB layer; Sentry/instrumentation gated; secrets loaded.
- ✅ Phase 1 rebuild: forced single `WritingRoom` shell (`writingRoomEnabled = true`); restricted formats to Novel/Screenplay/Web Series (Onboarding + formats.ts) — creator tools no longer surfaced.

## Verified live (2026-06-18)
- ✅ End-to-end writing loop: login → create Novel → Draft stage → AI "Write" → rich prose inserted into editor & persisted. (Full "write" generation ~50s — quality model + full continuity context; this is original behaviour.)
- ✅ All 3 Anthropic models valid with user key (haiku-4-5 / sonnet-4-6 / opus-4-8).
- ✅ Email-verification gate confirmed as existing product behaviour (not a regression). Demo account marked verified for testing.

## Backlog / Next
- P0: Verify World Bible (characters/locations/threads) generation + continuity memory flows live.
- P1: Wire **Google login** once OAuth creds provided (integration_expert playbook first).
- P1: Clean up the legacy dashboard (keep Series Bibles/Universes but de-clutter); consider unifying with `Home.tsx` redesign without hiding features.
- P2: Prune dead creator-tool code/routes (currently dormant, not surfaced).
- P2: Comic Studio / Production Studio polish; Export flows.
