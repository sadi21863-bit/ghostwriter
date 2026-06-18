# GhostWriter — Storytelling Quality Architecture (Research → Plan)

> Goal: close the gap where base LLMs are weak at sustained creative fiction.
> The research consensus (2026): **the architecture around the model matters more
> than the model itself** for long-form fiction. A single "write this scene" call
> will always trend toward generic prose. The fix is a **planner → writer → critic →
> reflect** loop with explicit memory, beat planning, anti-slop editing, and
> style-exemplar retrieval.

This document maps each proven technique to **where it plugs into GhostWriter's
existing code**, so improvements are additive, not rewrites. GhostWriter already
has unusually strong foundations (genre engines, continuity memory, Style DNA,
quality grading) — most of this is about **connecting and sequencing** them.

---

## What GhostWriter already does well (keep / build on)
- **Genre engines** (`lib/ai/engine.ts` system prompts: dialogue, combat, emotional, tension…) — strong craft theory injection.
- **Continuity memory** (`summarizeChapter` → `storyMemories`): already extracts `keyEvents`, `knowledgeShifts`, `openPromisesCreated/Resolved`, `emotionalStateEnd`. This is a reflection layer most products lack.
- **Style DNA** (`analyzeWork`) and **character intelligence** (`bootstrapCharacterIntelligence`: rootWound, hamartia, want/need, idiolect).
- **Quality grading** (`MODE_REGISTRY[...].qualityCheck`) and **AIisms** anti-slop instruction.
- **Context caching** (ephemeral cache_control) and tier-based context caps.

The weakness is that these run **in parallel / passively**, not as a **closed loop**
that plans before writing and critiques+revises after.

---

## The target loop (research-backed)
```
Premise → Story Plan → (Critique plan) → Scene Beat Sheet →
   Draft scene  →  Critic pass (prose+logic+continuity)  →
      Revise worst spans  →  Reflect (update memory/promises) → next scene
```
Sources converge on this exact pipeline (eqbench longform benchmark; SNAP
controllable narrative; "AI-Slop to AI-Polish" edit models; reflection-bank retrieval).

---

## Prioritized roadmap

### P0 — Scene Blueprint (the planner step) — highest ROI
**Problem:** the Write call jumps straight to prose, so the model "fills space"
with filler → generic output. **Fix:** a fast pre-pass that produces a tiny,
concrete scene blueprint and injects it as `additionalContext` to the Write call.

- New: `lib/ai/scene-blueprint.ts` → `buildSceneBlueprint()` calls Haiku (`MODELS.fast`, ~1–2s) returning JSON:
  `{ povGoal, obstacle, turn, stateChange, sensoryAnchors[3], openingImage, exitLine }`.
- Wire in `useGeneration.generate` (write mode): run blueprint first, pass as `additionalContext`.
  Stream still applies to the prose pass, so UX latency is +~1–2s only.
- Why it works: research shows explicit scene-level "who wants what / what blocks /
  what changes" planning is the single biggest lever against filler and cliché.
- Make it opt-in via a project setting `scenePlanningEnabled` (default on for Story Pro).

### P0 — Anti-slop Critic-Editor (edit-based revise pass)
**Problem:** `qualityCheck` *grades* but doesn't *fix*. The 2025 "AI-Slop→AI-Polish"
result: teach the model to find problematic spans and rewrite them.
- New endpoint `app/api/ai/refine/route.ts` + `engine.refinePassage(text, rubric)`:
  - Critic rubric (concrete slop signals): cliché openings, filler transitions
    ("as the sun dipped…"), vague emotional summaries, repeated sentence rhythm,
    forced metaphor, same-voice dialogue, scenes that don't change state, "GPT-isms".
  - Returns a rewritten passage **preserving plot/voice**, only fixing flagged spans.
- Surface as a one-click **"Polish pass"** in the Polish stage of WritingRoom (already a stage!).
- Keep it a separate pass (don't block first draft) — matches "don't treat first output as final".

### P1 — Style-Exemplar Retrieval (positive + negative anchors)
**Problem:** prose drifts to generic LLM voice. **Fix:** retrieve the user's own
strongest passages as few-shot voice anchors, and store slop examples to avoid.
- You already embed work-packets (`api/work-packets/embed`, pgvector). Reuse it:
  - On Write, retrieve top-2 highest-rated prior passages (or Style DNA exemplars)
    → inject as "VOICE EXEMPLARS (match this texture, do not copy content)".
  - Maintain a small **negative bank** (passages the user deleted/regenerated) →
    inject as "AVOID these patterns" (the reflection-bank technique).
- New: `lib/ai/exemplars.ts` (retrieve+format); hook into `buildDynamicContext`.

### P1 — Reader-Promise Ledger (enforce, don't just record)
**Problem:** `openPromisesCreated/Resolved` are stored but not fed back to the writer.
- Surface unresolved promises from `storyMemories` into the Write `dynamicContext`:
  "OPEN PROMISES TO HONOR (don't drop, don't resolve prematurely): …".
- Add to the Critic rubric: flag scenes that ignore all open promises.
- This directly raises long-form coherence (the benchmark's #1 scored axis).

### P1 — Two-tier model routing by task (cost + quality)
- Planner/critic/summary → Haiku (fast, cheap). Prose draft → Sonnet. Final polish →
  Opus on demand. You already have `MODELS` + `MODE_REGISTRY.modelTier`; extend so the
  *loop steps* (not just modes) pick tiers. Cuts cost while raising quality where it counts.

### P2 — Sentence-rhythm & repetition guard (deterministic, no LLM)
- Post-process: detect runs of same-length sentences / repeated sentence openers /
  duplicate n-grams across the chapter; show inline nudges in "Story Insights".
- Cheap, instant, and catches the exact "structural degradation" the longform
  benchmark penalizes (repetitive single-sentence paragraphs).

### P2 — Continuity contradiction check at write-time
- Before accepting a draft, cross-check named facts (character states, deaths,
  objects) against `storyMemories`/`universeCharacters` and flag contradictions.
- You already compute `knowledgeShifts` and `isDeceased` — wire them into a guard.

---

## Concrete first sprint (suggested order)
1. **Scene Blueprint (P0)** — biggest visible quality jump, ~1 file + 1 hook change.
2. **Polish pass / Critic-Editor (P0)** — uses the existing empty "Polish" stage in WritingRoom.
3. **Promise ledger injection (P1)** — small change to context builder, big coherence win.
4. Then exemplar retrieval + rhythm guard.

Each is additive, opt-in, and preserves your current models and flows.

---

## Notes on models
Your assigned models (haiku-4-5 / sonnet-4-6 / opus-4-8) are well-suited:
- Haiku → planner/critic/summary (fast, cheap, runs often).
- Sonnet → main prose draft (already default).
- Opus → optional final polish / hardest scenes.
No model changes needed — the wins come from the **loop**, exactly as the research concludes.

---
_Research basis: eqbench creative-writing longform benchmark; SNAP controllable
narrative planning (arXiv 2026); "AI-Slop to AI-Polish" self-edit models (arXiv 2504.07532);
reflection-bank retrieval (Nature s44387-025-00045-3); self-refine / self-critique literature._
