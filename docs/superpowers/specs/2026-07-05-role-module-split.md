# Director/Writer/Editor role module split

2026-07-05. Builds on route-consolidation step 1 (commit `562cb0b`, single shared Anthropic client at `src/lib/ai/client.ts`).

## Why

The capability registry (`src/lib/capabilities/registry.ts`) has tagged every mode and tool with `role: director|writer|editor` since the 2026-06-29 funnel work, but that was metadata only — there was no actual code-level module boundary. A 2026-07-04 audit found 49 duplicate Anthropic clients and, underneath that, no real Role module: every tool route hand-rolled its own session/gate/metering boilerplate with real drift — some tools charged credits, some silently didn't.

## What shipped

- **`src/lib/roles/shared.ts`** — `runMeteredCall()`: the one call path (gate → meter → call model → refund-on-failure) every tool route now goes through. Centralizing this makes metering structurally impossible to skip.
- **`src/lib/roles/director.ts`, `editor.ts`, `writer.ts`** — each role's system prompts (moved out of the now-deleted `src/lib/ai/prompts.ts`) plus a `run{Director,Editor,Writer}Call` alias of `runMeteredCall`. `writer.ts` also re-exports `generate`/`generateStream`/`MI`/`MODELS` from `engine.ts`, since the 26 `MODE_REGISTRY` modes already funnel through one route (`/api/ai/generate`) — the writer role was already structurally centralized before this pass.
- **25 route files** migrated from importing prompts out of `prompts.ts` to importing them (same export names) from the owning role module.
- **8 previously-unmetered tools fixed**: `tension-curve`, `villain-pov`, `generate-package`, `beat-sheet` (story-plans), `knowledge-audit`, `transportation-check`, `alt-draft` now call `meterAndGate`/`refundCredits` via the shared wrapper. New cost entries added to `src/lib/metering/costs.ts`. `extract-memory` was deliberately left unmetered — it fires automatically on every autosave (>300 words), not on a user click, so metering it risked silently draining credits on invisible background activity.
- **11 previously-untracked routes classified into a role** by evidence, not guesswork: UI stage placement (e.g. `channel-autopsy` sits in `IdeaStageView` → director), and an input-pattern heuristic — tools that operate on the user's own already-written content (`content: activeChap.content`) are editor-shaped (matches `retention_edit`'s precedent), tools that produce a fresh prompt/topic-driven deliverable are writer-shaped, tools that produce strategic *options* for a human to curate (not final shipped prose) are director-shaped. Notable revisions from a first-pass guess: `repurpose` and `pipelineCharacterVoice` looked like writer work but actually revise existing material (editor); `title-hook` looked like writer work but sits in the Shape-stage director tool group and produces candidate options, not shipped text.

## Explicitly not done this pass

- No new `TOOL_REGISTRY` entries were added for the 11 newly-classified orphan tools — giving them a formal `Capability` (gate tier, visibility scope, `StageRoleRail` surfacing) is a separate product decision, not implied by giving their prompts a code home.
- `comic_generate` was left out of the metering fix — it's correctly gated through the separate real-money production-pipeline system (`src/lib/production/pipelines.ts`, `paid: true` + `computePipelineState`), not the credits system.
- `arc_heatmap` needed no metering fix — it's pure local string-matching, never calls the model, despite being tagged `provider: "anthropic"` in the registry (a metadata inaccuracy, not a metering bug).
- Two other structural gaps surfaced but were left alone as out of the agreed scope: `knowledge-audit` has no `checkAiRateLimit` call at all (only the credits gate was added), and `alt-draft` has neither rate-limiting nor, previously, any tier/gate check.

## Verification

`npx tsc --noEmit` clean. Full suite 611/611 (3 test files needed mock updates — `villain-pov`, `generate-package`, `story-plans` — to mock `@/lib/metering/meter` now that those routes actually call it, matching the existing convention used by `surgical-edit`'s test).
