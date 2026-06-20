# Product History & Complexity Debt

This file exists because the product has visibly drifted from "easy to use and understand" toward "complicated and difficult to use" — and that drift is measurable, not just a feeling. Read this before adding another top-level tool, panel, or mode.

## What the first commit looked like

Commit `0970c90`, "Initial scaffold: Next.js 14 + Drizzle + NextAuth + Anthropic AI" (2026-04-11). The entire app: **41 files, 642 lines.**

Original `CLAUDE.md` (14 lines):
```
Stack: Next.js 14, Drizzle ORM, Neon PostgreSQL, NextAuth, Anthropic Claude, Tailwind, Vercel.
Architecture:
- Continuity engine: chapter summaries in AI context
- Style DNA: reference works to 6 attributes
- Modes: Brainstorm / Outline / Write
- World Bible: characters, locations, plot threads
```

Original `src/lib/ai/engine.ts` (8 lines total): a single `MI` dispatch object with **3 modes**, string-concatenated system prompts, one hardcoded model, no caching, no context budget, no quality checks, no tiers:
```ts
const MI = {
  brainstorm: () => "Creative brainstorming. Wild specific ideas.",
  outline: (f) => "Story architect. Detailed " + f + " outlines.",
  write: (f) => "Ghostwriter. " + f + " format. Continuity.",
};
export async function generate({mode,prompt,context,format,maxTokens=4000}){
  const msg = await client.messages.create({model:"claude-sonnet-4-20250514", max_tokens:maxTokens,
    system: MI[mode](format)+"\n---\n"+context, messages:[{role:"user",content:prompt}]});
  ...
}
```

`GhostWriterApp.tsx` was already 343 of the 642 total lines — a single mega-component holding all app state, from day one. The instinct toward one giant client component was baked in at birth, not something that crept in later.

The schema (`src/db/schema.ts`, 22 lines) was relationally sound from the start: `users → projects → {characters, locations, plotThreads, chapters, referenceWorks, generations}`, proper cascades, proper Drizzle relations. Every later change has been *additive* (Series/Universe tables, subscriptions, comics, etc.) — the original schema never needed a rewrite.

## What's true today

- 26 generation modes (not 3), each with its own gate, model tier, quality-check policy, and context policy.
- **Two parallel UI shells**: the legacy `ToolbarPanel`-driven flow, and `WritingRoom`'s "One Path, Five Stages" redesign (`writingRoomShell` GrowthBook flag, ON in production since 2026-06-15).
- A density dial (Simple/Standard/Full) was built specifically to manage mode-list overload — itself a sign the surface area outgrew what a single screen can present.
- A growing set of largely-independent tools bolted onto the core writing flow: Comic Studio, Production Studio, Audio Novel + Lipsync, Sprint Mode, Story Bible, Series Bible, Universe management, Surgical Edit, CraftDepthChip, Beat Detection, slash commands.
- `src/lib/ai/prompts.ts` alone has 30 exports; the original `engine.ts` had one prompt dispatch object.

The founding four architectural ideas (continuity engine, Style DNA, modes, World Bible) are still the first four bullets in `CLAUDE.md` today — the core product thesis never pivoted. Everything since has been elaboration on those four ideas, not a change of direction. The complexity problem isn't "wrong features" — it's that nothing has ever been removed, and the one attempt to simplify (the `WritingRoom` redesign) was shipped as an *incomplete* port rather than a true replacement.

## The concrete evidence: the redesign that was supposed to simplify, broke things

`WritingRoom` was meant to replace the toolbar-driven flow with a simpler Idea→Structure→Draft→Polish→Export ladder. In practice, three core capabilities that existed in the "complicated" legacy shell were silently dropped when `WritingRoom` shipped, because it renders its own UI tree and never mounts the legacy sidebar (`src/components/panels/ChapterEditor.tsx`) where they lived:

- **No way to create a new chapter.** `WritingRoom` had `‹ ›` arrows to navigate between *existing* chapters, but no "+ Add Chapter" anywhere. Result (reported by a real user 2026-06-17): an AI-generated 12-beat outline got drafted entirely into chapter 1, because chapter 2 never existed to draft into — and once that one chapter crossed the word-count threshold, the stage indicator auto-advanced to "Export" with no way back to Draft.
- **Comic Studio was completely unreachable** — fully built (UI, API, Higgsfield image generation, panel regeneration, CBZ export) but only ever rendered inside the legacy `ToolbarPanel`.
- **Audio Novel + Lipsync was completely unreachable** — same story: fully built (TTS generation, lipsync video, character portrait selection, status polling), only reachable from the legacy sidebar.

All three were fixed 2026-06-17 (see `CLAUDE.md` checklist item 21), but the pattern is the real finding: **the redesign reduced perceived complexity by hiding capability, not by actually simplifying it.** A user on the "simpler" new shell had *less* power than a user on the "complicated" old one, for no intentional reason — it was just unfinished.

A separate, independent finding from the same session: the **Series Bible** feature (dashboard CRUD UI + full PATCH API for premise/tone/world rules/character arcs/continuity notes/timeline) had a complete UI and API surface but was never wired into AI generation at all — filling it in had zero effect on what the AI wrote, despite looking fully functional. This is the opposite failure mode from `WritingRoom`'s: not "real feature, unreachable UI," but "real UI, no underlying effect." Fixed the same session by wiring it into `/api/ai/generate`'s context assembly, mirroring the working `buildSeriesUniverseContext()` pattern.

## Port audit, 2026-06-18: more orphans found, and several false positives caught

A follow-up audit (using subagents to trace every component and field) found and fixed two more genuine cases of the same `WritingRoom` orphaning pattern, plus a real context-assembly gap — but it also produced several confident-sounding verdicts that turned out to be **wrong on direct inspection**, which is the more important lesson here.

**Confirmed and fixed:**
- **Sprint Mode** (`src/components/SprintMode.tsx`) — a full-screen distraction-free writing timer, only ever reachable via the legacy slash-command palette (`GhostWriterApp.tsx`'s `handleSlashCommand`), which `WritingRoom`'s own `SlashMenu` never calls. Added a "🏃 Sprint Mode" button to `WritingRoom`'s footer.
- **ArcHeatMap, TensionCurve, ConstellationView** — three fully-built visualizations (character presence heatmap, tension/suspense curve, relationship graph) with working API routes (`/api/projects/[id]/arc-heatmap`, `tension-curve`, `relationship-map`) but zero imports anywhere in the app — not legacy-only, just completely unmounted. Bundled into a new `StoryInsightsPanel.tsx` (tabbed, dynamically imported since two of the three pull in chart/graph libraries) and added a "📊 Story Insights" button next to Audio Novel in `WritingRoom`'s footer.
- **Context-assembly gap** — `dialogue`, `interrogation`, `chase`, `combat`, `emotional`, `atmosphere`, and `tension` modes built their own client-side context and never sent `projectId` to `/api/ai/generate`, which silently skipped the entire server-side Series Bible / cross-book continuity block for those 7 of 26 modes. Fixed by always including `projectId`/`chapterId` in those calls (`src/hooks/useGeneration.ts`), matching what the other 19 modes already did.

**Audit claims that were actually false positives, corrected by reading the code directly before "fixing" anything:**
- `aiInitiative` (Leads/Collaborates/Assists) was reported as having zero effect because it's never referenced inside `WritingRoom.tsx`. True, but irrelevant: `GhostWriterApp.tsx` renders `GuideBar` and its `handleGuideRun`/`handleGuideDismiss` callbacks (which *are* `aiInitiative`-aware) outside the shell branch, and passes the same callbacks into `WritingRoom`. The setting already works for live users.
- Series Bible's CRUD UI was reported as "legacy-sidebar-only, unreachable." It actually lives in `src/app/dashboard/page.tsx`, which is the live dashboard (`homeRedesign` is off, so the classic dashboard — not `Home.tsx` — is what's live). It was never orphaned.
- `EntitySuggestionsChip` was reported as legacy-only; it's actually gated on `writingRoomEnabled` and only renders in the *live* shell. The audit had the condition backwards.
- `qualityGradingEnabled` was reported as "partial" for only driving an async post-generation check rather than something inline. That's the documented, intended design (see `capabilities.ts`'s own description: "Post-generation async check") — there's no inline version to wire it into.
- `BraindumpModal.tsx` was reported as orphaned (only reachable from the not-yet-launched `Home.tsx`). True, but the live dashboard already has its own inline equivalent ("✨ Braindump — I have ideas" in the New Project modal) — the standalone component is pre-built for `Home.tsx`'s eventual launch, not a missing capability today.
- **Universe Management was reported as "NO live entry point... legacy WorldBiblePanel sidebar only."** Also wrong: `WorldBiblePanel` itself is mounted unconditionally in `GhostWriterApp.tsx` (outside the shell branch, like `GuideBar`) — it's just collapsed by default in `WritingRoom` (`leftCollapsed=true`). `StoryBible.tsx` (the live Cast/World/Threads overlay) has an "Advanced settings →" button (`onOpenAdvanced`) that expands that exact sidebar, surfacing the Universe linking UI (`WorldBiblePanel.tsx:733-797`: assign a project to a universe, link to `/universe/[id]`) for any `storyType === 'universe-story'` project. Reachable, just one extra click behind "Advanced settings."

**The lesson:** a reachability audit based on grepping one file in isolation (e.g. "does `WritingRoom.tsx` reference this field?") misses shared callbacks and parent-level renders that aren't shell-conditional. Verify with a full trace — does the *prop actually passed in* carry the behavior? — before trusting a verdict enough to act on it.

**Recurrence guard added:** `src/components/__tests__/live-shell-reachability.test.ts` statically scans the source of every file in the live render path (`GhostWriterApp.tsx`, `WritingRoom.tsx`, its stage views, `StoryInsightsPanel.tsx`, `ToolbarPanel.tsx`) and fails if a maintained list of feature components (`AudioNovelPanel`, `SprintMode`, `StoryInsightsPanel`, `ArcHeatMap`, `TensionCurve`, `ConstellationView`, `StoryBible`, `ComicStudio`, `ProductionStudio`, `GuideBar`, `EntitySuggestionsChip`) isn't imported anywhere in that set. It's a source-text check, not a real render test, so it can't catch "imported but inside a dead branch" — but it does catch the exact failure mode this whole audit kept finding: a fully-built component imported nowhere at all. Add a new component to the maintained list once you've wired it in, so the next one doesn't get found by accident again.

## Recommendation

**Pick one shell and finish it — then retire the other.** `WritingRoom` is the right one to keep: it's already live, and the 5-stage ladder is a better mental model than a flat mode toolbar. But "finish" has to mean a real audit of every legacy-only capability (the session above only found three by accident, while debugging unrelated user reports — there may be more), not just patching gaps as users report them.

**Use progressive disclosure consistently, not selectively.** The density dial is the right idea (Simple/Standard/Full) but it's currently scoped only to the mode list. The same instinct should extend to the whole tool surface: Comic Studio, Production Studio, Audio Novel, Series Bible, Universe management are all genuinely useful for *some* projects, but none of them should be permanently-visible top-level surface area for a writer who just wants to draft a novel. Tuck them behind an "Advanced tools" disclosure, surfaced contextually (e.g. Comic Studio only suggested once a chapter has visual-heavy content; Audio Novel only suggested once a chapter is polish-stage-complete) rather than always rendered.

**Tradeoff to be honest about:** finishing one shell properly is real, multi-session work — every legacy-only capability needs to be found and ported with intention, not just patched reactively. And tucking tools behind progressive disclosure will cost a few power users an always-visible shortcut they currently rely on. Both costs are worth paying; the alternative is what exists today, where the product has all the complexity of the old system plus the gaps of an unfinished new one.

## UX/workflow pass, 2026-06-18: founder usage feedback, verified and shipped

A separate round of founder-reported friction (`docs/superpowers/specs/2026-06-18-adapt-cross-format-design.md` covers the largest item in detail) was verified against code before fixing, per the same discipline as the port audit above — several of the original complaints needed correction once checked against the actual implementation, not just the feeling of using the product:

- **Shipped as reported:** New Project modal overflow (sticky header/footer, scrollable body), continuous-drafting dead end (`next-action.ts`'s `export-manuscript` suggestion going permanently null once dismissed — the actual root cause of "the Guide stops helping me"), Series Bible/Universe sections merged into one and made interactive (click-to-filter, "add a book to this series"), Scrivener import renamed and demoted into the New Project modal, Screenplay format label clarified, and a v1 Adapt (cross-format conversion) feature shipped behind a capability map with only Novel→Screenplay wired.
- **Corrected on inspection:** the report that Series Bible/Universe sections were "always expanded, competing with the primary flow" — they already defaulted to collapsed; the real gap was that they were two separate sections instead of one, and Series Bible cards had no click action at all (Universe cards already linked to `/universe/[id]`).

Same lesson as the port audit: verify a reported problem against the current code before fixing it. Two for two so far on "the report was directionally right but the specific mechanism was different than assumed."

## Critical funnel bugs, 2026-06-20: live-browser test report, root-caused and fixed

A third report (real browser session on ghost-writer.cc, Story Pro account) flagged three launch-blocking bugs at the end of the funnel: export routing, Story Bible save, Audio Novel generation. Same discipline applied — every claimed mechanism was independently re-derived from the actual code (and in two cases empirically tested) rather than taken at face value, since the prior two rounds both had at least one wrong mechanism behind a real symptom.

- **Export ("Open Export →" opens the wrong thing):** report blamed `GhostWriterApp.tsx` for not owning the export modal. False — it does, correctly, before any generic fallback. Real cause: `ExportStageView.tsx`'s button ran the Guide ladder's current suggestion (`nextAction()`) rather than a fixed "open export" action, so it executed whatever the ladder was suggesting instead (Story Health, a different chapter, nothing) whenever an earlier rung still applied. Fixed by hardcoding the action.
- **Story Bible save (names revert to "New location"/"New thread"):** report blamed `.strict()` Zod schemas 400ing on extra PATCH fields. False — neither schema is `.strict()`; verified empirically that a full-row PATCH body parses fine. A second null-vs-undefined theory was also checked and ruled out (DB defaults have applied since the first migration; Drizzle's insert builder confirmed `undefined` compiles to SQL `default`, never `NULL`). The real, confirmed bug: the plot-thread status dropdown offers "Simmering," which the server enum didn't accept, 400ing the *entire* request including any simultaneous name edit — invisibly, since none of the four save handlers across `StoryBible.tsx`/`WorldBiblePanel.tsx` checked `res.ok`. Fixed the enum, added `res.ok` checks + toasts to all four handlers, and guarded "+ Add" against the rapid-multi-click duplicate-row bug that was likely the actual source of some "reverted" reports (editing a sibling duplicate that was never touched).
- **Audio Novel (freezes the browser):** confirmed as reported — the route loops TTS calls per segment with no `maxDuration`, unlike every other long-running AI route in the codebase. Added the same `maxDuration = 300` convention plus a client-side `AbortController` timeout.

Three for three rounds now where a live/observed symptom was real but at least one claimed mechanism wasn't. The pattern holds: read the actual code (and test the actual behavior, where testable in isolation) before fixing what a report *says* is broken.

## Quality-stack port, Phase 1, 2026-06-20: 5 systems ported behind `quality_stack`, flag OFF = no change

Ported from `ghostwriter-rebuild-from-emergent` (a separate, not-yet-merged branch) per a work order spec'd by Aditya: a Haiku scene-planner pre-pass (`scene-blueprint.ts`), voice-anchor retrieval from craft-library embeddings (`exemplars.ts`), an unresolved-story-promise aggregator (`promise-ledger.ts`, DB-only/no LLM), a deterministic prose-rhythm analyzer (`rhythm.ts`, no LLM), and a critic-editor polish endpoint (`refine/route.ts`). Every file's actual dependencies were verified against `main`'s schema before porting (`workPackets` columns, `storyMemories.structuredData`/`chapterIndex`, the `embeddings.ts` helpers) rather than trusting the work order's "clean port" claim outright — it held up, but two gaps weren't in the doc:

- `refine/route.ts` calls `refinePassage()` from `engine.ts`, which didn't exist on `main` — ported that one function too (not flagged as a 6th file in the spec).
- The reference branch's `refine/route.ts` metered at the full `"generate"` weight; the spec explicitly wanted the cheaper `"refine": 0.5`, so that line couldn't be copied byte-for-byte.

**New territory:** `quality_stack` is the first GrowthBook flag ever checked server-side in this codebase — every prior flag (`writingRoomShell`, `homeRedesign`, etc.) is client-only via `GrowthBookClientProvider`. Added `src/lib/growthbook-server.ts`, a lazy singleton (mirrors `src/db/index.ts`'s `getDb()` pattern) that re-fetches feature definitions at most every 5 minutes and fails open to `false` on any error — a flag-check problem must never change generation behavior. This was an open design question, not a default; asked Aditya directly (server SDK vs. env var vs. reusing tier) before building it.

**Scope deviation from the reference branch, deliberate:** the original implementation only ran the quality stack for `mode === 'write'`. The work order's stated scope was broader ("write/dialogue/combat/etc., NOT outline/brainstorm"), so the port uses `isProseMode(mode)` (new helper, `src/lib/modes/registry.ts`) instead of the narrower `write`-only check, gated to non-free tiers with a `projectId`. The `isProseMode`/tier/projectId checks happen *before* the GrowthBook call so non-qualifying requests pay zero added latency regardless of the flag's value.

All three AI/DB-touching builders are individually fail-open (verified by test, not just by reading the `catch` blocks) and run concurrently via `Promise.all` in the dynamic (never cached) context block. The rhythm signal is wired into `PolishStageView` as a read-only, client-side-only display (no server round-trip — it's a pure function over the chapter's plain text) gated behind the same flag via `useFeatureIsOn`.

Phase 1 is `quality_stack` defaulting OFF — verified flag-off byte-identical to pre-port behavior via a dedicated route test (`generate/__tests__/quality-stack.test.ts`) that asserts none of the three builders are even called, and `dynamicContext` is unchanged, when the flag is off. Phases 2-3 (the blind A/B generation-only eval harness and offline judging) and Phase 4 (streaming, export styling) are separate, later work per the spec — not started.
