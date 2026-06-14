# Redesign Phase 0: Mode Registry — Slash Commands & Auto-Detection Keywords Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or execute inline task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `MODE_REGISTRY` (the single source of truth for all 26 `GenerationMode`s, built in the prior Mode Registry refactor Plans 1-2) with two new pure-data fields — `slash` and `keywords` — laying the foundation for the "One Path, Five Stages" redesign's slash menu (Phase 2) and auto-detection (Phase 5).

**Architecture:** No UI change in this phase. Two new fields are added to `ModeConfig` and populated for all 26 entries: `slash: string` (the `/command` that will open this mode in the future slash menu) and `keywords: readonly string[]` (terms used for future Haiku/keyword-based beat classification). `archetypeOptions` (the per-mode picker values currently in 19 `useState` hooks in `GhostWriterApp.tsx`) is deliberately DEFERRED to Phase 2 — those values live in heterogeneous sources today (literal arrays in panel files, `get*Names()` getter functions, description Records) and consolidating them now would create premature duplication. Phase 2's slash-row renderer will read from each mode's existing source when it's built.

**Tech Stack:** TypeScript, Vitest. Single file change + test update.

**Background:** This is "Phase 0" from `ghostwriter-redesign.md` §6, continuing directly from Mode Registry refactor Plan 1 (foundation: `label`/`modelTier`/`gate`/`qualityCheck`/`visibility`) and Plan 2 (`realismDomains`). Both prior plans are complete and uncommitted in the working tree.

---

### Task 1: Add `slash` and `keywords` to ModeConfig and all 26 registry entries

**Files:**
- Modify: `src/lib/modes/registry.ts` (full rewrite of the `ModeConfig` interface + `MODE_REGISTRY` object)
- Modify: `src/lib/modes/__tests__/registry.test.ts` (add one new test)

- [ ] **Step 1: Write the failing test**

Add this test to `src/lib/modes/__tests__/registry.test.ts`, inside the existing `describe("MODE_REGISTRY", ...)` block (after the `realismDomains` test):

```typescript
  it("gives every mode a unique slash command and at least one auto-detection keyword", () => {
    const slashCommands = new Set<string>();
    for (const mode of Object.keys(MODE_REGISTRY) as GenerationMode[]) {
      const config = MODE_REGISTRY[mode];
      expect(config.slash.startsWith("/")).toBe(true);
      expect(config.slash.length).toBeGreaterThan(1);
      expect(slashCommands.has(config.slash)).toBe(false);
      slashCommands.add(config.slash);
      expect(config.keywords.length).toBeGreaterThan(0);
    }
    expect(slashCommands.size).toBe(26);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/modes/__tests__/registry.test.ts`
Expected: FAIL — TS2339 (`Property 'slash' does not exist on type '{ label: string; ... }'`) or a runtime `undefined.startsWith` error, since `slash`/`keywords` don't exist yet.

- [ ] **Step 3: Add `slash` and `keywords` to `ModeConfig` and populate all 26 entries**

Replace the full content of `src/lib/modes/registry.ts` with:

```typescript
// src/lib/modes/registry.ts
import type { FeatureGate } from "@/types/subscription";
import type { RealismDomain } from "@/lib/realism";

export type GenerationMode =
  | "brainstorm" | "outline" | "write"
  | "dialogue" | "combat" | "emotional" | "atmosphere" | "tension"
  | "composition" | "horror" | "comedy" | "mystery" | "romance" | "action"
  | "monologue" | "voice" | "thriller" | "sports" | "setting" | "historical"
  | "scitech" | "ethics" | "endings" | "isekai" | "interrogation" | "chase";

// "cohost" is a pseudo-mode (podcast co-host generation) and intentionally NOT part of
// GenerationMode. MODE_REGISTRY[mode as GenerationMode] is `undefined` for it — always
// access fields via optional chaining (`?.label`, `?.qualityCheck`, etc.).

export type ModeVisibility = "universal" | "story_only" | "story_and_creator";

export interface ModeConfig {
  label: string;
  modelTier: "default" | "quality";
  gate: FeatureGate | null;
  qualityCheck: boolean;
  visibility: ModeVisibility;
  /** Realism directive domains (src/lib/realism) injected into this mode's dynamic context. Omitted = none. */
  realismDomains?: readonly RealismDomain[];
  /** Slash command that opens this mode in the redesign's slash menu (Redesign Phase 2). */
  slash: string;
  /** Keywords used for auto-detection from beat text (Redesign Phase 5). */
  keywords: readonly string[];
}

export const MODE_REGISTRY = {
  brainstorm:    { label: "Brainstorm",    modelTier: "default", gate: null,                   qualityCheck: false, visibility: "universal",         slash: "/brainstorm",  keywords: ["brainstorm", "ideas", "what if", "possibilities", "options"] },
  outline:       { label: "Outline",       modelTier: "default", gate: null,                   qualityCheck: false, visibility: "universal",         slash: "/outline",     keywords: ["outline", "structure", "beats", "plan", "plot out"] },
  write:         { label: "Write",         modelTier: "default", gate: null,                   qualityCheck: true,  visibility: "universal",         slash: "/write",       keywords: ["write", "continue", "draft", "next scene"] },
  dialogue:      { label: "Dialogue",      modelTier: "default", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_only",        slash: "/dialogue",    keywords: ["dialogue", "conversation", "argument", "talk", "said", "asked"] },
  combat:        { label: "Combat",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_only",        realismDomains: ["combat", "body", "injury"], slash: "/fight", keywords: ["fight", "battle", "combat", "attack", "punch", "sword", "gun", "strike"] },
  emotional:     { label: "Emotional",     modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator", realismDomains: ["body"], slash: "/emotion", keywords: ["cry", "grief", "heartbreak", "tears", "devastated", "realizes"] },
  atmosphere:    { label: "Atmosphere",    modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator", slash: "/atmosphere", keywords: ["atmosphere", "mood", "ambiance", "feel of the place"] },
  tension:       { label: "Tension",       modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator", slash: "/tension", keywords: ["tension", "suspense", "dread", "anxious", "on edge"] },
  composition:   { label: "Composition",   modelTier: "quality", gate: "composition_layer",     qualityCheck: false, visibility: "story_and_creator", slash: "/composition", keywords: ["composition", "layer", "compose", "combine"] },
  horror:        { label: "Horror",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_only",        realismDomains: ["body", "injury"], slash: "/horror", keywords: ["horror", "terror", "monster", "scream", "creature", "dread"] },
  comedy:        { label: "Comedy",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_only",        slash: "/comedy", keywords: ["funny", "joke", "comedy", "humor", "laugh", "banter"] },
  mystery:       { label: "Mystery",       modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator", slash: "/mystery", keywords: ["mystery", "clue", "investigate", "suspect", "detective"] },
  romance:       { label: "Romance",       modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator", slash: "/romance", keywords: ["romance", "love", "kiss", "attraction", "feelings for"] },
  action:        { label: "Action",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator", realismDomains: ["chase", "body"], slash: "/action", keywords: ["chase", "escape", "run", "pursuit", "race against"] },
  monologue:     { label: "Monologue",     modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/monologue", keywords: ["monologue", "speech", "inner thoughts", "thinks to"] },
  voice:         { label: "Voice",         modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/voice", keywords: ["voice", "tone", "narration style"] },
  thriller:      { label: "Thriller",      modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator", slash: "/thriller", keywords: ["thriller", "threat", "danger", "stakes", "closing in"] },
  sports:        { label: "Sports",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/sports", keywords: ["game", "match", "race", "competition", "score"] },
  setting:       { label: "Setting",       modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/setting", keywords: ["setting", "location", "place", "landscape", "room"] },
  historical:    { label: "Historical",    modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/historical", keywords: ["historical", "period", "era", "history"] },
  scitech:       { label: "Sci/Tech",      modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/scitech", keywords: ["technology", "science", "futuristic", "tech", "device"] },
  ethics:        { label: "Ethics",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/ethics", keywords: ["ethics", "moral", "dilemma", "right and wrong"] },
  endings:       { label: "Endings",       modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/ending", keywords: ["ending", "conclude", "resolution", "finale", "final chapter"] },
  isekai:        { label: "Isekai ⚔️",      modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_only",        slash: "/isekai", keywords: ["isekai", "another world", "transported", "reincarnated", "summoned"] },
  interrogation: { label: "Interrogation", modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/interrogate", keywords: ["interrogation", "questioning", "confession", "interview"] },
  chase:         { label: "Chase",         modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator", slash: "/chase", keywords: ["chase", "pursuit", "fleeing", "running from", "tailing"] },
} as const satisfies Record<GenerationMode, ModeConfig>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/modes/__tests__/registry.test.ts`
Expected: PASS — all 10 tests (9 existing + 1 new) pass.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0. No other file references `slash`/`keywords` yet, so no downstream breakage is possible — this is purely additive.

- [ ] **Step 6: Do NOT commit**

Per standing project policy, leave changes uncommitted for user review.
