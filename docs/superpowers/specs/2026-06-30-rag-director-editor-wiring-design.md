# RAG/Craft-Library Wiring for Director & Editor Tools — Design

**Status:** Approved for planning
**Date:** 2026-06-30

## Problem

`buildVoiceExemplars` (craft-library voice anchors, pgvector similarity over `work_packets`), `buildPromiseLedger` (open-thread continuity, DB-only), and `buildSceneBlueprint` (Haiku scene-planning pre-pass) are called from exactly one place in the codebase: `src/app/api/ai/generate/route.ts:340-346`, the Writer-role core generation path. Every Editor-role tool (`refine`, `prose-fix`, `surgical-edit`) and every Director-role tool (`generate-package`, `tension-curve`, `arc-heatmap`, `villain-pov`, `series-plan`, `research-scaffold`, trend tools) calls Anthropic directly with no retrieval context whatsoever.

Audited and confirmed via direct grep + file reads (2026-06-30). Naive fix is "call the same three functions from more routes" — but reading the actual system prompts for the Editor tools revealed this is wrong: all three (`refine`, `prose-fix`, `surgical-edit`) carry an explicit **preserve-only mandate** ("preserve the author's voice... do NOT add new scenes/plot/subplots"). Injecting `buildVoiceExemplars` (an external craft anchor designed to *pull* generation toward a new sensibility) or the existing `buildPromiseLedger` copy ("advance or deepen these threads") would directly contradict that mandate. The design below uses tool-appropriate context instead of copy-pasting the generation-path helpers verbatim.

## Scope

**In scope:**
- Editor tools: `refine` (`POST /api/ai/refine`), `prose-fix` (`POST /api/ai/prose-fix`), `surgical-edit` (`POST /api/ai/surgical-edit`)
- Director tools: `villain-pov` (`POST /api/projects/[projectId]/villain-pov`), `generate-package` (`POST /api/projects/[projectId]/production/generate-package`)

**Out of scope (with reason):**
- `tension-curve`, `arc-heatmap` — read-only analysis/scoring of existing chapter text. Nothing to anchor; the tool already has the full text it's analyzing.
- `series-plan`, `research-scaffold` — these are YouTube-creator content-planning tools (channel pillars, video topic research), not fiction-narrative tools. Confirmed by reading their route bodies: neither touches `work_packets`, story promises, or project prose in a way voice/continuity context would apply to.
- `buildSceneBlueprint` — Haiku scene-planning pre-pass, conceptually specific to "draft the next prose scene." Doesn't fit edit-only tools (no new scene being planned) or the in-scope Director tools (villain-pov writes from a given `sceneDescription`, doesn't need a planning pre-pass; generate-package already does its own structural planning in one call).

## Design

### A. Editor tools — voice fingerprint + preserve-mode promise ledger

**Voice constraint (new use of existing code, zero new I/O):**
`extractVoiceFingerprint` and `fingerprintToConstraints` (`src/lib/ai/voice-fingerprint.ts`) are already used on the Writer path (via `context-builder.ts:244-246`) to turn "preserve this author's voice" into concrete numeric constraints (sentence length, contraction rate, dialogue ratio, forbidden AI-tell phrases, etc.), computed from the author's own prose.

For the three Editor tools, compute the fingerprint **from the passage being edited itself** (`text` / `chapterContent`, already present in every request body) — no new DB call, no new param, pure synchronous function:

```ts
const fp = extractVoiceFingerprint([text]); // null if <500 chars or <10 sentences
const voiceConstraints = fp ? fingerprintToConstraints(fp) : "";
```

Append `voiceConstraints` (when non-empty) to the route's existing `system` prompt string. This is strictly additive — when the passage is too short to fingerprint, `voiceConstraints` is `""` and behavior is identical to today.

**Promise ledger, preserve-mode (new phrasing, same data source):**
`buildPromiseLedger(projectId)` in `src/lib/ai/promise-ledger.ts` gets a second parameter:

```ts
export async function buildPromiseLedger(
  projectId: string,
  mode: "generate" | "preserve" = "generate"
): Promise<string>
```

Same query/dedupe logic; only the returned header/instruction text differs by mode:
- `"generate"` (existing, unchanged): `"OPEN STORY PROMISES (honor these threads — advance or deepen them; do NOT resolve prematurely or let them vanish):"`
- `"preserve"` (new): `"OPEN STORY PROMISES (do NOT delete, contradict, or accidentally resolve any of these while editing — if your edit touches a sentence connected to one of these, preserve its substance):"`

Default parameter value means the existing call in `generate/route.ts:340` is unaffected — zero risk to the Writer path.

**API surface change:** `prose-fix` and `surgical-edit` currently accept no `projectId` in their request body (`refine` already has it, optional). Add `projectId?: string` to both. When present, call `buildPromiseLedger(projectId, "preserve")` and append the result to the system prompt; when absent (e.g. a future caller without project context), skip silently — same fail-open posture as the helper itself.

Frontend changes: the three call sites that invoke these endpoints (the "Find & Edit" surgical-edit flow in `WritingRoom.tsx`, and the "Fix This" prose-fix buttons in `EditorNotesPanel.tsx` / `StoryHealthPanel.tsx`) already run inside an open project and have `project.id` in scope — add `projectId: project.id` to each existing fetch body.

### B. Director tools — generation-mode context

**`villain-pov`** writes a new antagonist-POV scene from a given `sceneDescription` — genuinely generative, same category as the Writer path. Add, in parallel:
```ts
const [promiseLedger, voiceExemplars] = await Promise.all([
  buildPromiseLedger(projectId, "generate"),
  buildVoiceExemplars(session.user.id, sceneDescription),
]);
```
Append both (when non-empty) to the system prompt built by `villainPovSystemPrompt(...)`. `projectId` is already available from the route params; no surface change needed.

**`generate-package`** writes a structured shot/scene package (JSON, not flowing prose) from the whole project. Add `buildPromiseLedger(projectId, "generate")` only — appended to `PRODUCTION_PACKAGE_SYSTEM_PROMPT` or folded into the user prompt alongside the existing CHARACTERS/LOCATIONS/WORLD ELEMENTS sections. Skip `buildVoiceExemplars`: there's no single representative query string for a whole-package batch generation, and the route already has no tier gate today — keep this addition free/ungated to match.

### Error handling

All three RAG helpers (`buildPromiseLedger`, `buildVoiceExemplars`, and by extension `extractVoiceFingerprint`/`fingerprintToConstraints` which are pure functions that can only return `null`/`""`) are already fail-open — a DB error, embedding-API error, or insufficient-text case returns `""` and never throws. No new error handling is required in any of the five routes; the additions are pure string concatenation that degrades to current behavior when the helper returns empty.

### Cost & latency

- Promise ledger: DB query only, runs in parallel with existing work, sub-50ms typical, zero LLM cost. Applied to 5 routes.
- Voice fingerprint (Editor tools): pure synchronous JS over text already in memory — zero added latency, zero added network calls.
- Voice exemplars (villain-pov only): one cheap embedding call (`text-embedding-3-small`), parallelizable, ~100-300ms. `villain-pov` is a low-frequency tool, not a hot path.

No change to existing tier gates: `refine`/`prose-fix`/`surgical-edit`/`villain-pov` already require `story_modes_advanced` (paid); `generate-package` remains ungated, consistent with today.

### Testing

TDD per project convention — failing test first for each unit:
1. `buildPromiseLedger(projectId, mode)` — new test cases for `"preserve"` mode returning the alternate header text; existing `"generate"`-mode tests must still pass unchanged (default-parameter regression check).
2. Each of the 5 routes — extend or add `__tests__/route.test.ts` to assert the new context string is appended to the system/user prompt when the relevant helper returns non-empty, and that the prompt is unchanged (matches current snapshot) when the helper returns `""` (mocked DB/embedding failure).
3. `extractVoiceFingerprint`/`fingerprintToConstraints` are already covered by existing tests (`voice-lock.test.ts`) — no new tests needed for the pure functions themselves, only for the new call sites using them.
4. Frontend: confirm `projectId` is included in the `prose-fix`/`surgical-edit` fetch bodies at all three call sites (unit test or inline assertion, not full E2E — these are payload-shape checks).

## Out of scope / explicit non-goals

- No UI indicator that "RAG context was applied" — matches the existing Writer-path behavior (silent, server-side only).
- No changes to `buildSceneBlueprint` or its `sceneBlueprint` flag.
- No changes to `tension-curve`, `arc-heatmap`, `series-plan`, `research-scaffold`, or any trend/market-research tool.
- No new database tables or schema migrations — all data sources (`work_packets`, `storyMemories`) already exist.
