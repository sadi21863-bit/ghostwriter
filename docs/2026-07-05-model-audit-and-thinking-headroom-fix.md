# 2026-07-05: Anthropic model audit + systemic thinking-headroom fix

Follow-up to the same-day `refinePassage()` truncation bug (see `docs/2026-07-05-novel-screenplay-format-test.md`). That fix was one instance of a class of bug; this pass researched Anthropic's current model lineup against official docs and swept the rest of the codebase for the same exposure.

## Research: model IDs, all correct

Cross-referenced `src/lib/ai/engine.ts`'s `MODELS` constant against Anthropic's live model docs (`platform.claude.com/docs/en/about-claude/models/overview.md`, fetched 2026-07-05):

| Tier | Codebase ID | Official status |
|---|---|---|
| `fast` | `claude-haiku-4-5-20251001` | Correct pinned snapshot (alias `claude-haiku-4-5`); $1/$5 per MTok, 200K context, 64K max output |
| `default` | `claude-sonnet-5` | Correct; $3/$15 ($2/$10 intro through 2026-08-31), 1M context, 128K max output |
| `quality` | `claude-opus-4-8` | Correct, current flagship Opus; $5/$25, 1M context, 128K max output |

No stale or deprecated model IDs anywhere in the codebase.

## The systemic bug: implicit adaptive thinking on every Sonnet-5 call

Confirmed live from `adaptive-thinking.md`: **the three model tiers default differently when `thinking` is omitted**:
- **Sonnet 5**: adaptive thinking **on by default** — must pass `{type:"disabled"}` to turn off.
- **Opus 4.8**: thinking **off by default** — safe unless explicitly enabled.
- **Haiku 4.5**: only supports old-style manual thinking (`budget_tokens`) — off unless explicitly configured.

Thinking tokens count against `max_tokens`. `refinePassage()`'s bug (empty output under `extraContext`) was this mechanism firing on a tight budget. Auditing every `MODELS.default` (Sonnet 5) call site in the codebase found the same exposure — no `thinking` config, and `max_tokens` ceilings ranging from 400 to 4000 — across **~30 call sites**, including `generate()`/`generateStream()` (the primary chapter-drafting path used by `write`/`brainstorm`/`outline`/`dialogue`, all Sonnet-5-tier per `MODE_REGISTRY`), `generateEntity()`, `generateQuickStory()`, `bootstrapCharacterIntelligence()`, the quick-start sample-paragraph call (was `maxTokens: 400` — the tightest budget in the codebase), and 18 Director/Editor/creator-tool routes (`villain-pov`, `tension-curve`, `theme-tracker`, `story-plans`, `world-bible/infer`, `export/query-letter`, `export/blurb`, `dead-scenes`, `adapt-chapter`, `quality-check` tier-2, `virality-predict`, `trend-youtube`, `trend-niche` (×2), `trend-instagram`, `hook-ab`, `tiktok-native` (×2), `guest-intel`, `thumbnail-concepts`, `surgical-edit`, `suggest`, `series-plan`, `scene-to-video-prompt`, `retention-edit`, `repurpose`, `research-scaffold`, `prose-fix`, `prose`, `braindump`, `creator-seo`, `creator-research`, `character-evolution`, `channel-autopsy`, `analyze-passage`, `pipeline`).

**Fix (per user decision, "raise max_tokens headroom" over "disable thinking"):** rather than disabling thinking on these — which would remove any reasoning-quality benefit Sonnet 5 offers on genuinely creative modes (`write`/`brainstorm`/`outline`/`dialogue`) — every one of these call sites had its `max_tokens` roughly doubled (or more, for the tightest ones) to give thinking + real output room to both fit, following Anthropic's own cost-control guidance ("increase max_tokens" before disabling thinking). `generate()`/`generateStream()` defaults moved 4000→8000; most route-level ceilings moved from the 800–2000 range to 2000–4000+; the quick-start sample paragraph moved 400→1200.

## A second, independent bug found during the sweep: `content[0]`-only text extraction

While auditing response parsing at each of these call sites, found **19 files** using `response.content[0].type === "text" ? response.content[0].text : "{}"` instead of the safe filter-all-blocks pattern already used correctly in `engine.ts` (`content.filter(b => b.type === "text").map(...).join("")`). Since adaptive thinking is on by default for every `MODELS.default` call and produces a `thinking` content block, **that thinking block lands at `content[0]`** — meaning any of these 17 Sonnet-5-tier routes (the other 2 were Haiku, lower risk but fixed anyway for correctness) would silently discard genuinely good model output and fall back to `"{}"`/empty string whenever the model chose to think, independent of the `max_tokens` headroom issue. This is arguably the more severe of the two bugs: it's a silent-data-loss bug that the headroom fix alone would not have caught, since it fires even when the model successfully produced full, complete output. Fixed all 19 occurrences to the safe filter pattern.

## Pricing correction in the admin cost-report

While researching current Anthropic pricing, found `src/app/api/admin/cost-report/route.ts`'s blended per-MTok rate for `claude-opus-4-6`/`claude-opus-4-8` (27.0) back-solved to **Opus 4.1's old $15/$75 pricing**, not current Opus 4.6/4.8 pricing ($5/$25, confirmed live) — overstating Opus generation cost in the admin dashboard by ~3x. Corrected to 9.0 (using the file's existing 80/20 blend formula: 0.8×5 + 0.2×25). Also nudged `claude-haiku-4-5-20251001` from 1.6 to 1.8 to match the exact documented $1/$5 rate (was implicitly assuming ~$1/$4).

## Claude Fable 5 — researched, not adopted

Anthropic's most capable widely-released model (`claude-fable-5`), GA since 2026-06-09, is positioned for "long-horizon agentic work" — thinking always on, up to 128K max output, minutes-long single requests are normal, $10/$50 per MTok (2x Opus 4.8's rate), and requires 30-day data retention. GhostWriter's AI calls are all short single-shot generations (no Managed Agents, no multi-step agentic loops, no code execution tool use) — Fable 5's strengths don't match this usage pattern, and the cost premium isn't justified for the current architecture. Not adopted; worth revisiting if the app ever builds a genuinely long-horizon agentic feature (e.g., an autonomous multi-chapter drafting loop).

## Follow-up: is Headroom actually wired to Story Graph and prompt caching?

Asked separately, after the above: for token optimization, are Headroom, prompt caching, and the Story Graph (Studio) properly connected? Traced the actual data flow in `context-builder.ts`:

- **Headroom ↔ Story Graph ↔ prompt caching (the AI-context path): correctly wired.** `buildStoryGraph()` runs first; its output (isolated-character warnings, "Characters seen here", "Driven by" cross-refs) is pushed into the same section arrays that `packToBudget()` (Headroom v2) then prioritizes/compacts. That packed, graph-annotated result is exactly the block marked `cache_control: {type:"ephemeral"}` in `generate()`/`generateStream()`. Since `buildStoryGraph`/`packToBudget`/`compactContext` are all deterministic given the same DB state, repeat calls hit the prompt cache correctly — no drift between the three.
- **Story Graph (Studio UI) ↔ Story Graph (context-builder): same source of truth.** Both `/api/projects/[id]/story-graph` (feeding `ConstellationView`) and `context-builder.ts`'s internal call use the same `buildStoryGraph()` function. One deliberate, documented difference: the Studio route also passes `worldEntities` (for `involves` edges on-screen); `context-builder.ts` excludes them because `WorldEntityContext` carries no id/link fields to build edges from.
- **The real gap: Headroom's trim signal was invisible everywhere.** `TRIM_MARKER`/`headroomSaved()` (in `headroom.ts`) and the tier-based `[Context truncated for tier limit]` marker (`context-caps.ts`) were used only inside `context-builder.ts`/`/api/ai/generate` and their own tests — `headroomSaved()` was dead code despite its own comment saying it exists "for telemetry/headroom reporting." When a project grew large enough that Headroom started dropping a section (e.g. `PLOTS`, `WORLD ELEMENTS`, or the Story Graph's own "UNCONNECTED CHARACTERS" line), there was no toast, no API field, no indicator anywhere a user could see it — including Studio's Story Graph health panel, which is exactly where a user would look to understand their project's structural completeness.

**Fixed (per user decision, "surface it in Studio's graph-health panel"):**
- `context-builder.ts` gained `contextIsTrimmed(p, mode?, tier?): boolean` — calls `buildStaticContext` and checks for `TRIM_MARKER` in the output, so it's guaranteed consistent with the real packing logic rather than re-implementing it.
- `/api/projects/[projectId]/story-graph`'s GET response gained a `contextTrimmed` field alongside the existing `health` object.
- `ConstellationView.tsx`'s health indicator (bottom-left of the graph canvas) now also shows "⚠ Context trimmed — some content isn't reaching the AI" with an explanatory tooltip, whenever `contextTrimmed` is true — independent of whether `health` (structural graph issues) has anything to report, since these are separate signals.
- New tests: `contextIsTrimmed` returns `false` for small projects and `true` for the same large-project fixture that already proved `buildStaticContext` inserts `TRIM_MARKER`.

## Headroom v3 — the LLM-summarization layer, built and wired live

The last piece: "Meaning-level reduction (summarisation) belongs to a later, opt-in LLM layer" (per `headroom.ts`'s own header comment) was the one genuinely unbuilt part of Headroom. Two things made this non-trivial:

1. **`buildStaticContext()` runs client-side.** `useGeneration.ts`/`useAIActions.ts` (browser hooks) build the static context and send it to `/api/ai/generate` in the request body — the server never rebuilds it. Once Headroom v1/v2 drops a section, it's gone by the time anything server-side sees the request; there's no way to "recover and summarize" something the server never received.
2. **A prior, unwired module already existed.** `src/lib/ai/headroom-summarize.ts` (commit `11b8b81`, 2026-06-30) had pure, dependency-injected, fully-tested orchestration (`summarizeToFit`, `summarizeOverflow`, `makeClaudeSummarizer`) explicitly built for this — but no production `call` function was ever plugged in, and nothing in the codebase imported it. Discovered via grep before writing anything new, to avoid building a duplicate.

**What shipped:**
- `headroom.ts` gained `packToBudgetLabeled()` (labeled-section sibling of `packToBudget`, returns which sections were skipped + their raw content) — `packToBudget` itself is untouched, so its existing callers/tests are unaffected.
- `context-builder.ts`'s `buildStaticContext` internals now tag each section (`header`/`voice-fingerprint`/`characters`/`locations`/`plots`/`world-elements`) and expose `buildStaticContextDetailed()` returning `{ text, skipped }`; `buildStaticContext()` becomes a thin wrapper (`.text` only) — same signature, same behavior, zero risk to its ~20 existing call sites.
- `headroom-summarize.ts` gained the missing production wiring: `cachedClaudeCall` (Haiku, exact-content-hash cached via the existing `semantic_cache` table with a dedicated `cacheType` and null embedding — deliberately NOT the embedding-similarity path, since this needs byte-identical reuse, not "similar enough" reuse), `claudeSummarizer` (the real `Summarizer`), and `rescueSkippedSections()` (feeds dropped sections into `summarizeOverflow` with a fixed importance ranking — world-elements compressed most aggressively, characters least).
- New route `POST /api/ai/headroom-rescue` — the server-side leg the client calls (API key custody), not separately metered/credited (same convention as promise-ledger/voice-exemplars/scene-blueprint: rides along under the credit already charged for the generation it's supporting).
- Wired into `useGeneration.ts`'s main `generate()` — the primary write/brainstorm/outline/dialogue path (this session's model-audit already identified it as the highest-value, most-used target). Not wired into the other 19 library-mode generators or the dialogue/interrogation/chase helpers in the same file — those are lower-traffic and mostly Opus-tier (no thinking-default risk), so the added complexity wasn't worth it there yet.

Caching is load-bearing, not just an optimization: without it, every write-mode generation on an over-budget project would trigger a second real Anthropic call on top of the main one. With it, the same project's unchanged sections summarize once and reuse the cached result on every subsequent draft.

## Verification

`npx tsc --noEmit`: clean (exit 0) after every change in this doc, including Headroom v3. Full test suite: 647/647 passing (started at 634, +2 `contextIsTrimmed`, +11 new production-wiring tests across `headroom-summarize-production.test.ts` and the new route's test). No behavior tests needed updating for the max_tokens sweep since credits are metered flat per-operation (`OPERATION_CREDITS`), not token-count-based — confirmed via `src/lib/metering/costs.ts` before making any of those changes, so raising `max_tokens` ceilings only affects worst-case real API spend/latency, not credit costs.
