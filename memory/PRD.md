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
- ✅ **Token streaming**: live typewriter Write. `engine.generateStream` (Anthropic stream) → `generate` route `stream:true` branch (ReadableStream, preserves all gating/metering) → `callAIStream` reader → `ChapterEditor.streamStart/streamDelta/streamEnd` typewriter+reformat. Verified live (prose grows in editor, reformats on completion).
- ✅ **Scene Blueprint planner (P0 from STORYTELLING_ARCHITECTURE.md)**: fast Haiku pre-pass (`lib/ai/scene-blueprint.ts`) builds GOAL/OBSTACLE/TURN/CHANGE/SENSORY/EXIT and injects into Write context (paid tiers, fail-open) — biggest lever vs. generic prose.
- 📄 Wrote `/app/STORYTELLING_ARCHITECTURE.md` — research-backed, codebase-aware roadmap (planner-writer-critic loop, anti-slop editor, style-exemplar retrieval, promise ledger, rhythm guard).
- ✅ **Polish-pass Critic-Editor (P0)**: `engine.refinePassage` + `/api/ai/refine` (gated/metered like generate) + "One-click prose polish" button in the Polish stage (`PolishStageView`, with Revert). Removes clichés/filler/repetition without altering plot/voice. Verified.
- ✅ **Reader-Promise Ledger (P1)**: `lib/ai/promise-ledger.ts` aggregates unresolved `openPromises` from `storyMemories` → injected into the Write dynamic block (DB-only, no LLM cost).
- ✅ **Style-Exemplar retrieval (P1)**: `lib/ai/exemplars.ts` retrieves top craft references (work_packets pgvector) by similarity → injected as VOICE ANCHORS (1 cheap embedding, fail-open).
- 🧠 Cost-alignment: all new context lands in the DYNAMIC block (cached static block stays byte-stable); planner/promise/exemplar run concurrently (`Promise.all`); auxiliary calls use Haiku; promise-ledger is DB-only.

## Backlog / Next
- P1: Wire **Google login** once real OAuth creds provided (integration_expert playbook first; current GOOGLE_CLIENT_ID/SECRET empty).
- P2: Make Scene Blueprint visible/editable (creative control surface + premium feature).
- P2: Sentence-rhythm/repetition guard (deterministic, no LLM) in Story Insights.
- P2: Clean up legacy dashboard; prune dormant creator-tool code/routes.

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
