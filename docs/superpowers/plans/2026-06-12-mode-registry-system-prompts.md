# Mode Registry — System Prompts & Realism Domains (Plan 2 of N) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two remaining unsafe/duplicated per-`GenerationMode` lookup tables — `engine.ts`'s `MI` system-prompt dispatch table and `realism/index.ts`'s `getRealismDomainsForMode` map — by giving `MI` a compile-time exhaustiveness check and deriving `getRealismDomainsForMode` from `MODE_REGISTRY`.

**Architecture:** Two independent, low-risk metadata consolidations following Plan 1's established pattern: exhaustiveness via `satisfies Record<GenerationMode, ...>`, and single-source-of-truth derivation via optional-chaining lookups into `MODE_REGISTRY`. Both tasks touch `src/lib/modes/registry.ts` and/or `src/lib/ai/engine.ts` plus one other file each — no UI changes, no behavior changes for end users.

**Tech Stack:** TypeScript, Vitest, Next.js 16 (existing stack — no new dependencies).

---

## Background & Scope

This is Plan 2 of N in the Mode Registry refactor. Plan 1 (completed 2026-06-12, uncommitted) created `src/lib/modes/registry.ts` with `MODE_REGISTRY: Record<GenerationMode, ModeConfig>` (`label`, `modelTier`, `gate`, `qualityCheck`, `visibility`) and refactored 5 files to derive from it.

A survey of the remaining "system prompts & context builders" code for per-`GenerationMode` duplication found exactly two candidates that fit Plan 1's low-risk pattern:

1. **`MI` in `src/lib/ai/engine.ts`** (lines 205-258) — maps each of the 26 `GenerationMode`s to a `(format: string) => string` system-prompt function. Currently accessed via `(MI as Record<string, (f: string) => string>)[mode](format)` — an unchecked cast. If a future `GenerationMode` were added to `registry.ts` without a matching `MI` entry, this compiles fine and throws `TypeError: ... is not a function` the first time that mode runs. → **Task 1**.

2. **`getRealismDomainsForMode`'s `modeMap` in `src/lib/realism/index.ts`** (lines 63-71) — a second hand-written `Record<string, RealismDomain[]>` covering 4 of the 26 modes (combat, action, horror, emotional), used by `buildDynamicContext` to inject physical/combat/chase realism rules. Drifts independently of `MODE_REGISTRY`. → **Task 2**.

**Explicitly out of scope** (surveyed, deliberately not undertaken):

- **The 26 system-prompt bodies themselves** — the large multi-paragraph `*_SYSTEM_PROMPT` constants in `engine.ts` and the per-mode `src/lib/{horror,comedy,mystery,romance,action,monologue,voice,thriller,sports,setting,historical,scitech,ethics,endings,isekai}.ts` / `src/lib/modes/{interrogation,chase}.ts` files. Relocating these into `registry.ts` would require ~20 new *value* imports into `registry.ts`, risking the circular-import problem Plan 1's architecture specifically avoids (`registry.ts` currently has zero runtime imports — only a type-only `FeatureGate` import from `subscription.ts`), and would balloon `registry.ts` from ~50 lines to several thousand. Task 1 below gets the same compile-time safety (every `GenerationMode` has a prompt function, with the correct signature) without this risk.

- **The ~21 near-identical per-mode handlers in `src/hooks/useAIActions.ts`** — each follows the shape `buildXContext(modeSpecificParam) + "\n---\n" + buildStaticContext(extended)` where `buildXContext` is a different per-mode "library" context builder (`buildCombatContext`, `buildEmotionalContext`, etc.) with non-uniform parameter shapes (combat takes two style names, others take a single archetype/emotion/environment name). This is real duplication, but unifying it is a structural rewrite of the core AI generation call sites with a much larger blast radius than metadata consolidation. Flagged as a candidate for a future plan — not attempted here.

---

### Task 1: Type-safe exhaustiveness for the per-mode system-prompt table (`MI`)

**Files:**
- Modify: `src/lib/ai/engine.ts:205` and `src/lib/ai/engine.ts:258` (the `MI` object definition), `src/lib/ai/engine.ts:350` (the call site in `generate()`)
- Test: `src/lib/ai/__tests__/engine.test.ts`

`GenerationMode` and `MODE_REGISTRY` are already imported in `engine.ts` (`import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";`) — no new imports needed for this task.

- [ ] **Step 1: Write the failing test**

In `src/lib/ai/__tests__/engine.test.ts`, add this import after the existing `import { describe, it, expect, vi } from "vitest";` line:

```typescript
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";
```

Then add this new `describe` block at the end of the file (after the existing `describe("getCraftDirectives", ...)` block's closing `});`):

```typescript
describe("MI", () => {
  it("has a system-prompt function for every mode in MODE_REGISTRY", async () => {
    const { MI } = await import("@/lib/ai/engine");
    for (const mode of Object.keys(MODE_REGISTRY) as GenerationMode[]) {
      expect(typeof MI[mode]).toBe("function");
      expect(MI[mode]("Novel")).toBeTypeOf("string");
      expect(MI[mode]("Novel").length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "ghostwriter" ; npx vitest run src/lib/ai/__tests__/engine.test.ts`

Expected: FAIL — `MI` is not exported from `engine.ts` yet, so `MI` is `undefined` and `MI[mode]` throws `TypeError: Cannot read properties of undefined (reading 'brainstorm')` (or similar).

- [ ] **Step 3: Export `MI` and add the exhaustiveness check**

In `src/lib/ai/engine.ts`, change line 205 from:

```typescript
const MI = {
```

to:

```typescript
export const MI = {
```

Then change the closing of the `MI` object (the end of the `composition` entry, currently line 258) from:

```typescript
Write only the scene. No preamble. No explanation of what you are doing. No summary of the active layers.`,
};
```

to:

```typescript
Write only the scene. No preamble. No explanation of what you are doing. No summary of the active layers.`,
} satisfies Record<GenerationMode, (format: string) => string>;
```

- [ ] **Step 4: Remove the unsafe cast at the call site**

In `src/lib/ai/engine.ts`, inside `generate()`, change line 350 from:

```typescript
  const modeInstruction = (MI as Record<string, (f: string) => string>)[mode](format);
```

to:

```typescript
  const modeInstruction = MI[mode as GenerationMode](format);
```

This matches the existing `MODE_REGISTRY[mode as GenerationMode]?.modelTier` cast pattern three lines earlier (line 343).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd "ghostwriter" ; npx vitest run src/lib/ai/__tests__/engine.test.ts`

Expected: PASS — 4 tests (3 existing `getCraftDirectives` tests + new `MI` test).

- [ ] **Step 6: Verify the exhaustiveness check actually catches a missing mode**

Temporarily comment out the `chase:` entry in the `MI` object (the line `chase:         (_f: string) => CHASE_SYSTEM_PROMPT,`), then run:

Run: `cd "ghostwriter" ; npx tsc --noEmit`

Expected: FAIL — TypeScript reports the `MI` object literal is missing the `chase` property required by `Record<GenerationMode, (format: string) => string>`.

Then **uncomment the `chase:` line again** (restore it exactly as it was) and re-run:

Run: `cd "ghostwriter" ; npx tsc --noEmit`

Expected: exit code 0. This step is verification-only — the file must end this step in the same state it was in after Step 4 (with `chase` present).

- [ ] **Step 7: Run full verification for this task**

Run: `cd "ghostwriter" ; npx tsc --noEmit`
Expected: exit code 0

Run: `cd "ghostwriter" ; npx vitest run src/lib/ai/__tests__`
Expected: PASS, all tests green

- [ ] **Step 8: Commit**

```bash
git add src/lib/ai/engine.ts src/lib/ai/__tests__/engine.test.ts
git commit -m "refactor: add compile-time exhaustiveness check to MI system-prompt table"
```

---

### Task 2: Derive `getRealismDomainsForMode` from `MODE_REGISTRY`

**Files:**
- Modify: `src/lib/modes/registry.ts`
- Modify: `src/lib/realism/index.ts:63-71`
- Test: `src/lib/modes/__tests__/registry.test.ts`
- Create: `src/lib/realism/__tests__/index.test.ts`

- [ ] **Step 1: Write the failing test (registry)**

In `src/lib/modes/__tests__/registry.test.ts`, add this test inside the existing `describe("MODE_REGISTRY", ...)` block, after the last existing `it(...)` (the "uses the isekai emoji label..." test):

```typescript
  it("attaches realismDomains only to combat/action/horror/emotional", () => {
    expect(MODE_REGISTRY.combat.realismDomains).toEqual(["combat", "body", "injury"]);
    expect(MODE_REGISTRY.action.realismDomains).toEqual(["chase", "body"]);
    expect(MODE_REGISTRY.horror.realismDomains).toEqual(["body", "injury"]);
    expect(MODE_REGISTRY.emotional.realismDomains).toEqual(["body"]);

    const withRealism: GenerationMode[] = ["combat", "action", "horror", "emotional"];
    for (const mode of Object.keys(MODE_REGISTRY) as GenerationMode[]) {
      if (!withRealism.includes(mode)) {
        expect(MODE_REGISTRY[mode].realismDomains).toBeUndefined();
      }
    }
  });
```

(`GenerationMode` and `MODE_REGISTRY` are already imported at the top of this file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "ghostwriter" ; npx vitest run src/lib/modes/__tests__/registry.test.ts`

Expected: FAIL — `MODE_REGISTRY.combat.realismDomains` is `undefined`, so `toEqual(["combat", "body", "injury"])` fails.

- [ ] **Step 3: Add `realismDomains` to `ModeConfig` and to the registry**

In `src/lib/modes/registry.ts`, change line 2 from:

```typescript
import type { FeatureGate } from "@/types/subscription";
```

to:

```typescript
import type { FeatureGate } from "@/types/subscription";
import type { RealismDomain } from "@/lib/realism";
```

Change the `ModeConfig` interface from:

```typescript
export interface ModeConfig {
  label: string;
  modelTier: "default" | "quality";
  gate: FeatureGate | null;
  qualityCheck: boolean;
  visibility: ModeVisibility;
}
```

to:

```typescript
export interface ModeConfig {
  label: string;
  modelTier: "default" | "quality";
  gate: FeatureGate | null;
  qualityCheck: boolean;
  visibility: ModeVisibility;
  /** Realism directive domains (src/lib/realism) injected into this mode's dynamic context. Omitted = none. */
  realismDomains?: readonly RealismDomain[];
}
```

Then add `realismDomains` to exactly these 4 entries in `MODE_REGISTRY` (leave all other 22 entries unchanged):

Change:
```typescript
  combat:        { label: "Combat",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_only" },
```
to:
```typescript
  combat:        { label: "Combat",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_only",        realismDomains: ["combat", "body", "injury"] },
```

Change:
```typescript
  emotional:     { label: "Emotional",     modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator" },
```
to:
```typescript
  emotional:     { label: "Emotional",     modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator", realismDomains: ["body"] },
```

Change:
```typescript
  horror:        { label: "Horror",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_only" },
```
to:
```typescript
  horror:        { label: "Horror",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_only",        realismDomains: ["body", "injury"] },
```

Change:
```typescript
  action:        { label: "Action",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator" },
```
to:
```typescript
  action:        { label: "Action",        modelTier: "quality", gate: "story_modes_advanced",  qualityCheck: true,  visibility: "story_and_creator", realismDomains: ["chase", "body"] },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "ghostwriter" ; npx vitest run src/lib/modes/__tests__/registry.test.ts`

Expected: PASS — 10 tests (9 existing + new `realismDomains` test).

- [ ] **Step 5: Write a characterization test for `getRealismDomainsForMode`**

Create `src/lib/realism/__tests__/index.test.ts`:

```typescript
// src/lib/realism/__tests__/index.test.ts
import { describe, it, expect } from "vitest";
import { getRealismDomainsForMode } from "../index";

describe("getRealismDomainsForMode", () => {
  it("returns the realism domains for the 4 modes that have them", () => {
    expect(getRealismDomainsForMode("combat")).toEqual(["combat", "body", "injury"]);
    expect(getRealismDomainsForMode("action")).toEqual(["chase", "body"]);
    expect(getRealismDomainsForMode("horror")).toEqual(["body", "injury"]);
    expect(getRealismDomainsForMode("emotional")).toEqual(["body"]);
  });

  it("returns an empty array for modes without realism directives", () => {
    expect(getRealismDomainsForMode("write")).toEqual([]);
    expect(getRealismDomainsForMode("brainstorm")).toEqual([]);
    expect(getRealismDomainsForMode("comedy")).toEqual([]);
  });

  it("returns an empty array for unknown/empty mode strings", () => {
    expect(getRealismDomainsForMode("")).toEqual([]);
    expect(getRealismDomainsForMode("cohost")).toEqual([]);
  });
});
```

- [ ] **Step 6: Run test to verify it passes against the CURRENT implementation**

Run: `cd "ghostwriter" ; npx vitest run src/lib/realism/__tests__/index.test.ts`

Expected: PASS — 3 tests. This test characterizes the existing hand-written `modeMap` in `getRealismDomainsForMode` and must pass *before* Step 7's refactor. It exists to prove the refactor doesn't change behavior — if it fails here, stop and investigate before proceeding (the test itself is wrong, not the code).

- [ ] **Step 7: Derive `getRealismDomainsForMode` from `MODE_REGISTRY`**

In `src/lib/realism/index.ts`, add this import at the top of the file (the file currently has no imports — this becomes line 1, pushing everything else down):

```typescript
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";
```

Then change the function (currently lines 63-71) from:

```typescript
export function getRealismDomainsForMode(mode: string): RealismDomain[] {
  const modeMap: Record<string, RealismDomain[]> = {
    combat:    ['combat', 'body', 'injury'],
    action:    ['chase', 'body'],
    horror:    ['body', 'injury'],
    emotional: ['body'],
  };
  return modeMap[mode] ?? [];
}
```

to:

```typescript
export function getRealismDomainsForMode(mode: string): readonly RealismDomain[] {
  return MODE_REGISTRY[mode as GenerationMode]?.realismDomains ?? [];
}
```

- [ ] **Step 8: Run test to verify it STILL passes after the refactor**

Run: `cd "ghostwriter" ; npx vitest run src/lib/realism/__tests__/index.test.ts`

Expected: PASS — same 3 tests as Step 6, now exercising the `MODE_REGISTRY`-derived implementation. If a test fails here, compare the failing mode's `MODE_REGISTRY[mode].realismDomains` (set in Step 3) against the old `modeMap` entry for that mode in Step 7's "before" code — they must match exactly, including array order.

- [ ] **Step 9: Run full verification for this task**

Run: `cd "ghostwriter" ; npx tsc --noEmit`

Expected: exit code 0. This confirms `realism/index.ts` → `registry.ts` is not part of a circular import: `registry.ts`'s only reference to `@/lib/realism` is the type-only `import type { RealismDomain }` added in Step 3, which is erased at compile time — the same one-directional pattern as `subscription.ts` → `registry.ts` from Plan 1.

Run: `cd "ghostwriter" ; npx vitest run src/lib/modes/__tests__ src/lib/realism/__tests__`

Expected: PASS, all tests green (registry: 10, realism: 3).

- [ ] **Step 10: Commit**

```bash
git add src/lib/modes/registry.ts src/lib/modes/__tests__/registry.test.ts src/lib/realism/index.ts src/lib/realism/__tests__/index.test.ts
git commit -m "refactor: derive getRealismDomainsForMode from MODE_REGISTRY"
```

---

### Task 3: Final verification

**Files:** None (verification only).

- [ ] **Step 1: Full typecheck**

Run: `cd "ghostwriter" ; npx tsc --noEmit`
Expected: exit code 0

- [ ] **Step 2: Full relevant test suites**

Run: `cd "ghostwriter" ; npx vitest run src/app/api/ai/__tests__ src/lib/modes/__tests__ src/lib/realism/__tests__ src/lib/ai/__tests__`

Expected: PASS — 54 (existing AI suite) + 10 (registry) + 3 (realism) + 4 (engine) = 71 tests, all green. (54 + 8 = 62 was the Plan 1 baseline; registry gained 1 test → 10, plus 4 new engine + 3 new realism = 71.)

- [ ] **Step 3: Production build**

Run: `cd "ghostwriter" ; npm run build`
Expected: build succeeds across all routes, no new errors vs. the Plan 1 baseline.

- [ ] **Step 4: Confirm scope**

Run: `cd "ghostwriter" ; git status` and `cd "ghostwriter" ; git diff --stat`

Confirm only these files are new/modified by this plan: `src/lib/ai/engine.ts`, `src/lib/ai/__tests__/engine.test.ts`, `src/lib/modes/registry.ts`, `src/lib/modes/__tests__/registry.test.ts`, `src/lib/realism/index.ts`, `src/lib/realism/__tests__/index.test.ts` (new file) — plus whatever pre-existing uncommitted files were already present from Plan 1 and earlier work.

- [ ] **Step 5: Report**

Summarize: tsc exit code, test counts/pass-fail breakdown, build result, and the `git status`/`git diff --stat` confirmation from Step 4.
