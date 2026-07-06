# 2026-07-06: External repo research + what shipped from it

Five GitHub repos were researched (each cloned to a scratch directory and read in full, not just README-skimmed) to evaluate usefulness for GhostWriter. Four produced real, shipped changes; one (`strix`) was evaluated but not wired in, per the user's own call to skip it unless genuinely needed.

## 1. `asgeirtj/system_prompts_leaks` — patterns extracted, not copied

A collection of leaked/reconstructed system prompts from commercial AI products (Character.AI, Sesame's Maya, xAI's Grok personas, OpenAI's GPT-5.1/5, Notion AI, Claude Fable 5, Docker's Gordon, etc.). Read ~10 prompts in full. The **literal wording is proprietary and was never copied** — only the underlying, generic prompt-engineering techniques were reimplemented, in GhostWriter's own words:

- **Active self-scan framing** (from Docker Gordon's leaked prompt: "Before outputting ANY message, scan for these 10 words and delete every occurrence"). Applied to `buildAiismsInstruction()` in `src/lib/ai/aiisms.ts` — replaced the passive "after writing, verify none of these phrases appear" with an active "before finalizing, scan every sentence... delete or rewrite every occurrence" instruction.
- **Echo-avoidance + no-double-statement** (from Sesame's Maya prompt, which bans "echoing the user's own words back" and "saying the same thing two different ways in one response"). Added as `STRUCTURAL_AIISMS` in `aiisms.ts` — two fiction tells that aren't fixed phrases, so they couldn't live in the existing `FICTION_AIISMS` literal-match array.
- Also found but **not yet applied** (flagged for a future pass, not part of this shipment): an artifact-vs-persona separation pattern (GPT-5.1/5-robot prompts), a hallucination-admission self-correction pattern for the critic/refine pass (Maya), and a PREFERENCE/QUERY/APPLY?/WHY few-shot calibration format for the voice-fingerprint system (Claude Fable 5 leak).

**Also fixed in the same pass**: `buildAiismsInstruction()` previously did `FICTION_AIISMS.slice(0, 20)` against a 42-entry array — 22 entries were silently never sent to the model. Now sends the full list.

## 2. `Leonxlnx/taste-skill` — not adopted

A Claude Code Agent Skill for frontend-UI codegen (hero sections, design-system rules, anti-slop for marketing pages). Zero overlap with GhostWriter's prose-generation engine — it governs generating UI code from scratch, not narrative text. Not wired into the product. (Marginal, optional use: could be installed as a personal dev-tool skill for future sessions building GhostWriter's own marketing/dashboard pages — not done here, since that's a separate decision from improving the product.)

## 3. `usestrix/strix` — evaluated, skipped per user instruction

A real, working multi-agent AI pentesting CLI (Docker/Kali sandbox, BYOK LLM, ~40 vulnerability-playbook skills including a dedicated Next.js/NextAuth skill). Confirmed genuinely useful for a manual, deliberate security pass against this app (source-only scan or a tightly-scoped authenticated scan against staging, with a `--max-budget-usd` cap) — but the user explicitly said to skip it unless truly needed, so it was not installed or wired into anything. No code changes from this one.

## 4. `hesreallyhim/awesome-claude-code` — workflow + one product idea

A curated list of Claude Code resources. Read the full classic categorized list plus READMEs for the 4 most relevant hits.

- **TypeScript Quality Hook** (pattern from `bartolli/claude-code-typescript-hooks`): a PostToolUse hook that runs a typecheck after every Write/Edit/MultiEdit. **Adapted, not copied** — the reference tool's design assumes a single-file check completing in single-digit milliseconds; on this codebase a full `tsc --noEmit` (needed for accurate `@/*` path-alias and strict-mode resolution) measured **~24s even with `incremental: true`** in `tsconfig.json` (a cold run measured ~100s). A synchronous hook blocking every edit by 24s+ would make the harness unusable, so `.claude/hooks/typecheck-after-edit.cjs` runs the check **in the background** (detached child process) and reports the *previous* run's results on the *next* edit — feedback lags by one edit-cycle instead of being instant, a deliberate tradeoff given the measured cost on this repo's actual scale. Wired into `.claude/settings.json`'s `PostToolUse` hooks.
- **read-only-postgres skill** (pattern from `jawwadfirdousi/agent-skills`): safe SELECT/SHOW/EXPLAIN/WITH-only queries against the live DB. **Adapted, not copied** — the reference implementation uses Python + psycopg2 + a separate multi-connection `connections.json`; this project is Node/TypeScript with one database, so `.claude/skills/read-only-postgres/scripts/query.mjs` reuses `@neondatabase/serverless` (already a dependency, same driver `src/db/index.ts` uses) instead of adding a new Python dependency. Verified live against the real DB (a `--tables` call succeeded; further live queries were correctly blocked by Claude Code's own production-safety classifier, which is the intended caution for a database-touching skill).
- **Product idea, from `conorbronsdon/avoid-ai-writing`**: a deterministic AI-tell detector — this became item 4 below.
- Noted but not adopted this pass: CCPM's `depends_on`/`parallel`/`conflicts_with` task-frontmatter pattern (formalizes the Subagent-Driven-Development convention already used ad hoc in this repo's sprints) and the HumanLayer "would Claude actually err without this line?" CLAUDE.md-pruning heuristic — both flagged as good future workflow improvements, neither implemented in this pass.

## 5. `immich-app/immich` (+ Paperless-ngx, PhotoPrism, Jellyfin) — the QStash job-queue addition

Immich's job architecture (BullMQ + Redis, `@OnJob`-decorated handlers, persistent `microservices` worker process) and the same pattern confirmed in Paperless-ngx (Celery), PhotoPrism, and Jellyfin (in-process schedulers) all assume a **persistent server process** — none of them solve "queue/retry/poll when compute is torn down after every request," which is GhostWriter's actual Vercel-serverless constraint.

**What transferred, adapted for serverless**: the *job-status/retry convention*, not the worker technology. `src/lib/queue/qstash.ts` wraps **Upstash QStash** (chosen because `@upstash/ratelimit`/`@upstash/redis` are already dependencies here — same vendor, zero new account setup) as the "worker" — each poll is a fresh, short-lived Vercel invocation QStash schedules and re-invokes, instead of a long-lived BullMQ consumer. Wired into exactly **one** call site as a proof of value (per the research's own scoping principle — build the increment, not the whole vision):

- `POST /api/projects/[projectId]/production/shots/[shotId]/generate-video` — after submitting the async Segmind v2 video job, now *also* schedules a QStash callback (`/api/queue/segmind-video-poll`) 15s out, instead of relying solely on the client's own status-polling `setInterval`. The job keeps progressing even if the user closes the tab; capped at 40 reschedule attempts (~10 minutes).
- The actual "check job status + update the DB row" logic was extracted into `src/lib/production/poll-shot-video.ts` so both the pre-existing client-polling status route and the new QStash webhook route call the identical code — whichever side reaches `final_ready` first simply wins; there's no duplicate-upload or race risk since both paths read/write the same `productionShots` row.
- **Deliberately not done in this pass**: a generalized `segmind_jobs` table, or wiring this pattern into `generateSoulImage`/`generateLipsync`/`preview-all`. Those calls have different shapes (some are still Segmind v1 synchronous calls, not yet async-submit-capable) and reusing this exact pattern there is real, separate follow-up work, not a mechanical copy-paste.
- **Fails open with zero risk**: every new piece is gated behind `isQstashConfigured()` (checks `QSTASH_TOKEN`). Without `QSTASH_TOKEN`/`QSTASH_CURRENT_SIGNING_KEY`/`QSTASH_NEXT_SIGNING_KEY` set, `scheduleCallback()` is a no-op and the existing client-driven polling behaves exactly as before — this was not live-tested end-to-end against a real QStash account (none configured in this environment), so the fail-open path is what actually runs today until those three env vars are added.

## New environment variables (optional, feature-detected)

| Variable | Purpose |
|---|---|
| `QSTASH_TOKEN` | Upstash QStash API token — enables the server-scheduled video-job poll. Unset = falls back to client-only polling (current behavior, unchanged). |
| `QSTASH_CURRENT_SIGNING_KEY` | Verifies incoming QStash webhook signatures. |
| `QSTASH_NEXT_SIGNING_KEY` | Second signing key for QStash's key-rotation window. |
