# Mode Registry Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the per-mode metadata that is currently scattered across `engine.ts` (`QUALITY_MODES`), `subscription.ts` (`GATED_MODES`), `useAIActions.ts` (`QUALITY_CHECK_MODES`), `formats.ts` (`MODES` array), and `ToolbarPanel.tsx` (`modeLabel`, `visibleModes`) into a single `MODE_REGISTRY` config map, so that every one of the 26 `GenerationMode` values has its model tier, feature gate, quality-check flag, display label, and panel-visibility category defined in exactly one place.

**Architecture:** Add a new `src/lib/modes/registry.ts` that defines the `GenerationMode` type (moved out of `engine.ts`) and `MODE_REGISTRY: Record<GenerationMode, ModeConfig>`, using `as const satisfies Record<GenerationMode, ModeConfig>` so TypeScript fails to compile if any mode is missing or has an invalid field. Five existing files then derive their current constants from `MODE_REGISTRY` instead of maintaining independent lists, while keeping their existing exports byte-for-byte compatible (`GenerationMode` still importable from `@/lib/ai/engine`, `GATED_MODES` still importable from `@/types/subscription` with identical shape, `MODES` array in `formats.ts` in the same order). This is **Plan 1 of a phased Mode Registry refactor** — system prompts (the `MI` object), context builders, and the 24-condition UI panel-routing ternary in `ToolbarPanel.tsx` are explicitly out of scope and reserved for future plans.

**Tech Stack:** Next.js 16, TypeScript, Vitest. Windows/PowerShell for all shell commands (`npx tsc --noEmit`, `npx vitest run ...`).

---

## File Structure

| File | Change |
|---|---|
| `src/lib/modes/registry.ts` | **Create.** `GenerationMode` type, `ModeConfig`/`ModeVisibility` types, `MODE_REGISTRY` const (26 entries). |
| `src/lib/modes/__tests__/registry.test.ts` | **Create.** Validates registry shape, ordering, and spot-checks every field. |
| `src/lib/ai/engine.ts` | **Modify.** Remove `QUALITY_MODES` Set and local `GenerationMode` definition; import `MODE_REGISTRY`/`GenerationMode` from registry; re-export `GenerationMode` type for backward compat; derive model tier in `generate()`. |
| `src/types/subscription.ts` | **Modify.** Derive `GATED_MODES` from `MODE_REGISTRY` instead of a hand-written object literal. |
| `src/lib/formats.ts` | **Modify.** Derive `MODES` array via `Object.keys(MODE_REGISTRY)`. |
| `src/hooks/useAIActions.ts` | **Modify.** Remove `QUALITY_CHECK_MODES` Set; look up `MODE_REGISTRY[mode]?.qualityCheck`. |
| `src/components/panels/ToolbarPanel.tsx` | **Modify.** Derive `modeLabel` and `visibleModes` from `MODE_REGISTRY`. |

---

## Task 1: Create the Mode Registry

**Files:**
- Create: `src/lib/modes/registry.ts`
- Test: `src/lib/modes/__tests__/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/modes/__tests__/registry.test.ts
import { describe, it, expect } from "vitest";
import { MODE_REGISTRY, type GenerationMode } from "../registry";

const EXPECTED_ORDER: GenerationMode[] = [
  "brainstorm", "outline", "write", "dialogue", "combat", "emotional",
  "atmosphere", "tension", "composition", "horror", "comedy", "mystery",
  "romance", "action", "monologue", "voice", "thriller", "sports",
  "setting", "historical", "scitech", "ethics", "endings", "isekai",
  "interrogation", "chase",
];

describe("MODE_REGISTRY", () => {
  it("has exactly 26 modes in the order formats.ts expects", () => {
    expect(Object.keys(MODE_REGISTRY)).toEqual(EXPECTED_ORDER);
  });

  it("marks the 3 universal modes correctly", () => {
    expect(MODE_REGISTRY.brainstorm.visibility).toBe("universal");
    expect(MODE_REGISTRY.outline.visibility).toBe("universal");
    expect(MODE_REGISTRY.write.visibility).toBe("universal");
    expect(MODE_REGISTRY.brainstorm.gate).toBeNull();
    expect(MODE_REGISTRY.outline.gate).toBeNull();
    expect(MODE_REGISTRY.write.gate).toBeNull();
  });

  it("marks the 5 story-only modes correctly", () => {
    for (const mode of ["dialogue", "combat", "horror", "comedy", "isekai"] as const) {
      expect(MODE_REGISTRY[mode].visibility).toBe("story_only");
    }
  });

  it("marks the remaining 18 modes as story_and_creator", () => {
    const storyAndCreator: GenerationMode[] = [
      "emotional", "atmosphere", "tension", "composition", "mystery",
      "romance", "action", "monologue", "voice", "thriller", "sports",
      "setting", "historical", "scitech", "ethics", "endings",
      "interrogation", "chase",
    ];
    for (const mode of storyAndCreator) {
      expect(MODE_REGISTRY[mode].visibility).toBe("story_and_creator");
    }
  });

  it("gates composition under composition_layer and other library modes under story_modes_advanced", () => {
    expect(MODE_REGISTRY.composition.gate).toBe("composition_layer");
    expect(MODE_REGISTRY.dialogue.gate).toBe("story_modes_advanced");
    expect(MODE_REGISTRY.chase.gate).toBe("story_modes_advanced");
    expect(MODE_REGISTRY.interrogation.gate).toBe("story_modes_advanced");
  });

  it("routes brainstorm/outline/write/dialogue to default tier and the 22 library modes to quality tier", () => {
    expect(MODE_REGISTRY.brainstorm.modelTier).toBe("default");
    expect(MODE_REGISTRY.outline.modelTier).toBe("default");
    expect(MODE_REGISTRY.write.modelTier).toBe("default");
    expect(MODE_REGISTRY.dialogue.modelTier).toBe("default");
    expect(MODE_REGISTRY.combat.modelTier).toBe("quality");
    expect(MODE_REGISTRY.composition.modelTier).toBe("quality");
    expect(MODE_REGISTRY.isekai.modelTier).toBe("quality");
    expect(MODE_REGISTRY.chase.modelTier).toBe("quality");
  });

  it("flags the 11 quality-check modes and no others", () => {
    const expected: GenerationMode[] = [
      "write", "emotional", "combat", "atmosphere", "tension",
      "horror", "mystery", "romance", "thriller", "action", "dialogue",
    ];
    for (const mode of expected) {
      expect(MODE_REGISTRY[mode].qualityCheck).toBe(true);
    }
    const notExpected: GenerationMode[] = [
      "brainstorm", "outline", "composition", "comedy", "monologue",
      "voice", "sports", "setting", "historical", "scitech", "ethics",
      "endings", "isekai", "interrogation", "chase",
    ];
    for (const mode of notExpected) {
      expect(MODE_REGISTRY[mode].qualityCheck).toBe(false);
    }
  });

  it("uses the isekai emoji label and sci/tech short label", () => {
    expect(MODE_REGISTRY.isekai.label).toBe("Isekai ⚔️");
    expect(MODE_REGISTRY.scitech.label).toBe("Sci/Tech");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/modes/__tests__/registry.test.ts`
Expected: FAIL — `Cannot find module '../registry'` (file doesn't exist yet).

- [ ] **Step 3: Write the registry implementation**

```typescript
// src/lib/modes/registry.ts
import type { FeatureGate } from "@/types/subscription";

export type GenerationMode =
  | "brainstorm" | "outline" | "write"
  | "dialogue" | "combat" | "emotional" | "atmosphere" | "tension"
  | "composition" | "horror" | "comedy" | "mystery" | "romance" | "action"
  | "monologue" | "voice" | "thriller" | "sports" | "setting" | "historical"
  | "scitech" | "ethics" | "endings" | "isekai" | "interrogation" | "chase";

export type ModeVisibility = "universal" | "story_only" | "story_and_creator";

export interface ModeConfig {
  label: string;
  modelTier: "default" | "quality";
  gate: FeatureGate | null;
  qualityCheck: boolean;
  visibility: ModeVisibility;
}

export const MODE_REGISTRY = {
  brainstorm:    { label: "Brainstorm",    modelTier: "default", gate: null,                   qualityCheck: false, visibility: "universal" },
  outline:       { label: "Outline",       modelTier: "default", gate: null,                   qualityCheck: false, visibility: "universal" },
  write:         { label: "Write",         modelTier: "default", gate: null,                   qualityCheck: true,  visibility: "universal" },
  dialogue:      { label: "Dialogue",      modelTier: "default", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_only" },
  combat:        { label: "Combat",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_only" },
  emotional:     { label: "Emotional",     modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator" },
  atmosphere:    { label: "Atmosphere",    modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator" },
  tension:       { label: "Tension",       modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator" },
  composition:   { label: "Composition",   modelTier: "quality", gate: "composition_layer",     qualityCheck: false, visibility: "story_and_creator" },
  horror:        { label: "Horror",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_only" },
  comedy:        { label: "Comedy",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_only" },
  mystery:       { label: "Mystery",       modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator" },
  romance:       { label: "Romance",       modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator" },
  action:        { label: "Action",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator" },
  monologue:     { label: "Monologue",     modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator" },
  voice:         { label: "Voice",         modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator" },
  thriller:      { label: "Thriller",      modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator" },
  sports:        { label: "Sports",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator" },
  setting:       { label: "Setting",       modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator" },
  historical:    { label: "Historical",    modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator" },
  scitech:       { label: "Sci/Tech",      modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator" },
  ethics:        { label: "Ethics",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator" },
  endings:       { label: "Endings",       modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator" },
  isekai:        { label: "Isekai ⚔️",      modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_only" },
  interrogation: { label: "Interrogation", modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator" },
  chase:         { label: "Chase",         modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: false, visibility: "story_and_creator" },
} as const satisfies Record<GenerationMode, ModeConfig>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/modes/__tests__/registry.test.ts`
Expected: PASS — 7/7 tests green.

Also run: `npx tsc --noEmit`
Expected: exit 0. If `satisfies Record<GenerationMode, ModeConfig>` fails, the error will name the missing/incorrect key — fix the literal, not the type.

- [ ] **Step 5: Commit**

```bash
git add src/lib/modes/registry.ts src/lib/modes/__tests__/registry.test.ts
git commit -m "feat(modes): add MODE_REGISTRY as single source of truth for per-mode config"
```

---

## Task 2: Refactor `engine.ts` to derive model tier from the registry

**Files:**
- Modify: `src/lib/ai/engine.ts:28-37,60,352`

**Context:** `engine.ts` currently defines its own `GenerationMode` type (line 60) and a `QUALITY_MODES` Set (lines 28-37) used only at line 352 to pick Sonnet vs Opus. `composition.test.ts` imports `GenerationMode` from `@/lib/ai/engine` — that import must keep working.

- [ ] **Step 1: Add the registry import**

In `src/lib/ai/engine.ts`, after the existing imports (after line 19, the `checkSemanticCache` import), add:

```typescript
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";
```

- [ ] **Step 2: Remove the `QUALITY_MODES` Set**

Delete lines 28-37:

```typescript
const QUALITY_MODES = new Set([
  // Only modes with specialized research-depth libraries justify Opus
  'combat', 'emotional', 'atmosphere', 'tension', 'horror',
  'comedy', 'mystery', 'romance', 'action', 'monologue',
  'voice', 'thriller', 'sports', 'setting', 'historical',
  'scitech', 'ethics', 'endings', 'isekai', 'composition',
  'interrogation', 'chase',
  // write → MODELS.default (Sonnet — 18K context does the heavy lifting)
  // dialogue → MODELS.default (character profiles in context are sufficient)
]);
```

- [ ] **Step 3: Replace the local `GenerationMode` type with a re-export**

Replace line 60:

```typescript
export type GenerationMode = "brainstorm" | "outline" | "write" | "dialogue" | "combat" | "emotional" | "atmosphere" | "tension" | "composition" | "horror" | "comedy" | "mystery" | "romance" | "action" | "monologue" | "voice" | "thriller" | "sports" | "setting" | "historical" | "scitech" | "ethics" | "endings" | "isekai" | "interrogation" | "chase";
```

with:

```typescript
export type { GenerationMode } from "@/lib/modes/registry";
```

(This is a re-export — it does not bring `GenerationMode` into local scope. The `import type { GenerationMode }` added in Step 1 covers local use in Step 4.)

- [ ] **Step 4: Derive the model from `MODE_REGISTRY` in `generate()`**

Replace line 352:

```typescript
  const model = overrideModel ?? (QUALITY_MODES.has(mode) ? MODELS.quality : MODELS.default);
```

with:

```typescript
  const model = overrideModel ?? MODELS[MODE_REGISTRY[mode as GenerationMode]?.modelTier ?? 'default'];
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx vitest run src/app/api/ai/__tests__/composition.test.ts`
Expected: PASS — confirms `GenerationMode` is still importable from `@/lib/ai/engine`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/engine.ts
git commit -m "refactor(engine): derive GenerationMode and model tier from MODE_REGISTRY"
```

---

## Task 3: Refactor `subscription.ts` to derive `GATED_MODES` from the registry

**Files:**
- Modify: `src/types/subscription.ts:1,50-74`

**Context:** `GATED_MODES` (lines 50-74) is a hand-written `Record<string, FeatureGate>` with 23 entries, all `"story_modes_advanced"` except `composition: "composition_layer"`. Two test files (`subscription.test.ts`, `generate.test.ts`) import `GATED_MODES` and assert specific keys are defined/undefined — the derived object must have the exact same shape and values. `registry.ts` imports `FeatureGate` from this file as `import type`, which is erased at compile time, so this file can safely import the `MODE_REGISTRY` value from `registry.ts` without creating a runtime circular dependency.

- [ ] **Step 1: Add the registry import**

At the top of `src/types/subscription.ts`, after the file header comment (after line 2), add:

```typescript
import { MODE_REGISTRY } from "@/lib/modes/registry";
```

- [ ] **Step 2: Replace the hand-written `GATED_MODES` with a derived one**

Replace lines 50-74:

```typescript
export const GATED_MODES: Record<string, FeatureGate> = {
  dialogue:    "story_modes_advanced",
  combat:      "story_modes_advanced",
  emotional:   "story_modes_advanced",
  atmosphere:  "story_modes_advanced",
  tension:     "story_modes_advanced",
  composition: "composition_layer",
  horror:      "story_modes_advanced",
  comedy:      "story_modes_advanced",
  mystery:     "story_modes_advanced",
  romance:     "story_modes_advanced",
  action:      "story_modes_advanced",
  monologue:   "story_modes_advanced",
  voice:       "story_modes_advanced",
  thriller:    "story_modes_advanced",
  sports:      "story_modes_advanced",
  setting:     "story_modes_advanced",
  historical:  "story_modes_advanced",
  scitech:     "story_modes_advanced",
  ethics:      "story_modes_advanced",
  endings:     "story_modes_advanced",
  isekai:      "story_modes_advanced",
  interrogation: "story_modes_advanced",
  chase:       "story_modes_advanced",
};
```

with:

```typescript
export const GATED_MODES: Record<string, FeatureGate> = Object.fromEntries(
  Object.entries(MODE_REGISTRY)
    .filter(([, cfg]) => cfg.gate !== null)
    .map(([mode, cfg]) => [mode, cfg.gate as FeatureGate])
);
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx vitest run src/app/api/ai/__tests__/subscription.test.ts src/app/api/ai/__tests__/generate.test.ts`
Expected: PASS — both files assert `GATED_MODES[mode]` for specific modes; these must still hold (23 keys, `composition` → `"composition_layer"`, all others → `"story_modes_advanced"`, `brainstorm`/`outline`/`write` undefined).

- [ ] **Step 4: Commit**

```bash
git add src/types/subscription.ts
git commit -m "refactor(subscription): derive GATED_MODES from MODE_REGISTRY"
```

---

## Task 4: Refactor `formats.ts` to derive `MODES` from the registry

**Files:**
- Modify: `src/lib/formats.ts:14`

**Context:** `MODES` (line 14) is a 26-element literal array in a specific order. `Object.keys()` preserves insertion order for string keys, so `Object.keys(MODE_REGISTRY)` produces an identical array **only if** `MODE_REGISTRY` was written in the same order — Task 1's registry was written in exactly this order, and the registry test asserts it.

- [ ] **Step 1: Add the registry import**

At the top of `src/lib/formats.ts` (before line 1), add:

```typescript
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";
```

- [ ] **Step 2: Replace the `MODES` literal array**

Replace line 14:

```typescript
export const MODES = ["brainstorm", "outline", "write", "dialogue", "combat", "emotional", "atmosphere", "tension", "composition", "horror", "comedy", "mystery", "romance", "action", "monologue", "voice", "thriller", "sports", "setting", "historical", "scitech", "ethics", "endings", "isekai", "interrogation", "chase"];
```

with:

```typescript
export const MODES = Object.keys(MODE_REGISTRY) as GenerationMode[];
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx vitest run src/app/api/ai/__tests__`
Expected: all 5 files / 54 tests still PASS (no test should depend on `MODES` being a literal array vs. a derived one — only on its contents/order, which Task 1's `registry.test.ts` already guards).

- [ ] **Step 4: Commit**

```bash
git add src/lib/formats.ts
git commit -m "refactor(formats): derive MODES array from MODE_REGISTRY"
```

---

## Task 5: Refactor `useAIActions.ts` to derive the quality-check flag from the registry

**Files:**
- Modify: `src/hooks/useAIActions.ts:1-13,179`

**Context:** `QUALITY_CHECK_MODES` (lines 4-7) is a Set of 11 modes, checked at line 179 inside `generate()`. At that point `mode` is the raw mode string (it can be `"cohost"` for the podcast co-host pseudo-mode, which is not a key in `MODE_REGISTRY`). `MODE_REGISTRY["cohost" as GenerationMode]` is `undefined` at runtime, so `undefined?.qualityCheck` is `undefined` (falsy) — same behavior as `QUALITY_CHECK_MODES.has("cohost")` returning `false`.

- [ ] **Step 1: Replace the `QUALITY_CHECK_MODES` Set with a registry import**

Replace lines 4-7:

```typescript
const QUALITY_CHECK_MODES = new Set([
  'write', 'emotional', 'combat', 'atmosphere', 'tension',
  'horror', 'mystery', 'romance', 'thriller', 'action', 'dialogue',
]);
```

with:

```typescript
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";
```

(This sits among the other imports — line 4 was originally between `useState`/`useRef` import and the `toast` import; placing the new `import` statement there keeps all imports together.)

- [ ] **Step 2: Update the usage at line 179**

Replace:

```typescript
        if (QUALITY_CHECK_MODES.has(mode) && (project as any).qualityGradingEnabled) {
```

with:

```typescript
        if (MODE_REGISTRY[mode as GenerationMode]?.qualityCheck && (project as any).qualityGradingEnabled) {
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

(No dedicated unit test exercises this hook directly — `tsc` plus the manual smoke check in Task 7 are the safety net for this file.)

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAIActions.ts
git commit -m "refactor(useAIActions): derive quality-check gating from MODE_REGISTRY"
```

---

## Task 6: Refactor `ToolbarPanel.tsx` to derive labels and visibility from the registry

**Files:**
- Modify: `src/components/panels/ToolbarPanel.tsx:4,190-201,258-262`

**Context:** `modeLabel` (lines 190-201) is a lookup object covering all 26 `GenerationMode` values plus the `"cohost"` pseudo-mode. `visibleModes` (lines 258-262) filters `MODES` down for non-story, non-podcast (creator) formats by excluding the 5 "story_only" modes (`dialogue`, `combat`, `horror`, `comedy`, `isekai`) — this is exactly `MODE_REGISTRY[m].visibility !== "story_only"`.

- [ ] **Step 1: Add the registry import**

Replace line 4:

```typescript
import { MODES, PODCAST_MODES, isStoryFormat, isCreatorFormat } from "@/lib/formats";
```

with:

```typescript
import { MODES, PODCAST_MODES, isStoryFormat, isCreatorFormat } from "@/lib/formats";
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";
```

- [ ] **Step 2: Replace the `modeLabel` lookup**

Replace lines 190-201:

```typescript
const modeLabel = (m: string) => (
  ({
    brainstorm: "Brainstorm", outline: "Outline", write: "Write",
    dialogue: "Dialogue", combat: "Combat", cohost: "Co-host",
    emotional: "Emotional", atmosphere: "Atmosphere", tension: "Tension",
    composition: "Composition", horror: "Horror", comedy: "Comedy",
    mystery: "Mystery", romance: "Romance", action: "Action",
    monologue: "Monologue", voice: "Voice", thriller: "Thriller", sports: "Sports",
    setting: "Setting", historical: "Historical", scitech: "Sci/Tech", ethics: "Ethics", endings: "Endings",
    isekai: "Isekai ⚔️", interrogation: "Interrogation", chase: "Chase",
  } as Record<string, string>)[m] ?? m
);
```

with:

```typescript
const modeLabel = (m: string) => (
  m === "cohost" ? "Co-host" : MODE_REGISTRY[m as GenerationMode]?.label ?? m
);
```

- [ ] **Step 3: Replace the `visibleModes` filter**

Replace lines 258-262:

```typescript
  const visibleModes = project.format === "Podcast Episode"
    ? PODCAST_MODES
    : isStoryFormat(project.format)
    ? MODES
    : MODES.filter(m => m !== "dialogue" && m !== "combat" && m !== "horror" && m !== "comedy" && m !== "isekai");
```

with:

```typescript
  const visibleModes = project.format === "Podcast Episode"
    ? PODCAST_MODES
    : isStoryFormat(project.format)
    ? MODES
    : MODES.filter(m => MODE_REGISTRY[m as GenerationMode]?.visibility !== "story_only");
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

Manual smoke check (dev server, per Task 7) — open a Novel project, a YouTube Long-form project, and a Podcast Episode project, and confirm the mode dropdown/toolbar shows the same modes with the same labels as before the refactor.

- [ ] **Step 5: Commit**

```bash
git add src/components/panels/ToolbarPanel.tsx
git commit -m "refactor(ToolbarPanel): derive mode labels and visibility from MODE_REGISTRY"
```

---

## Task 7: Final verification

**Files:** None (verification only).

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 2: Full AI test suite**

Run: `npx vitest run src/app/api/ai/__tests__`
Expected: 5 files / 54 tests PASS (same count as before this plan — confirms `GATED_MODES` and `GenerationMode` re-exports preserved exact behavior).

- [ ] **Step 3: Registry test**

Run: `npx vitest run src/lib/modes/__tests__/registry.test.ts`
Expected: 7/7 PASS.

- [ ] **Step 4: Manual smoke check**

Start the dev server (`npm run dev`, port 3001) and verify in the browser:
1. Open a **Novel** project — toolbar shows all modes including Dialogue, Combat, Horror, Comedy, Isekai (with ⚔️), each with correct labels (e.g. "Sci/Tech" not "scitech").
2. Open a **YouTube Long-form** project — toolbar does NOT show Dialogue, Combat, Horror, Comedy, or Isekai, but DOES show Emotional, Atmosphere, Composition, etc.
3. Open a **Podcast Episode** project — toolbar shows only Brainstorm, Outline, Write, Co-host.
4. Trigger a **Combat** generation (Story Pro+ account) — confirm it still completes (uses Opus per `modelTier: "quality"`).
5. Trigger a **Write** generation with quality grading enabled — confirm the quality-check pass still runs (uses `qualityCheck: true`).

- [ ] **Step 5: Report**

Summarize: registry created, 5 files refactored to derive from it, `tsc`/`vitest`/manual checks all green. Note that system prompts (`MI` object), context builders, and the ToolbarPanel panel-routing ternary remain untouched — reserved for future Plan 2 (System Prompts & Context Builders) and Plan 3 (UI Panel Routing).
