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

## Recommendation

**Pick one shell and finish it — then retire the other.** `WritingRoom` is the right one to keep: it's already live, and the 5-stage ladder is a better mental model than a flat mode toolbar. But "finish" has to mean a real audit of every legacy-only capability (the session above only found three by accident, while debugging unrelated user reports — there may be more), not just patching gaps as users report them.

**Use progressive disclosure consistently, not selectively.** The density dial is the right idea (Simple/Standard/Full) but it's currently scoped only to the mode list. The same instinct should extend to the whole tool surface: Comic Studio, Production Studio, Audio Novel, Series Bible, Universe management are all genuinely useful for *some* projects, but none of them should be permanently-visible top-level surface area for a writer who just wants to draft a novel. Tuck them behind an "Advanced tools" disclosure, surfaced contextually (e.g. Comic Studio only suggested once a chapter has visual-heavy content; Audio Novel only suggested once a chapter is polish-stage-complete) rather than always rendered.

**Tradeoff to be honest about:** finishing one shell properly is real, multi-session work — every legacy-only capability needs to be found and ported with intention, not just patched reactively. And tucking tools behind progressive disclosure will cost a few power users an always-visible shortcut they currently rely on. Both costs are worth paying; the alternative is what exists today, where the product has all the complexity of the old system plus the gaps of an unfinished new one.
