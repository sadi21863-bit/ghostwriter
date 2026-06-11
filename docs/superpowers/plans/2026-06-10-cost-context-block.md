# Cost & Context Block (B-2, B-1, B-3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-layer, deterministic context budget (client priority-ordered assembly + server-enforced per-tier caps), de-bloat per-character instructional prose into one shared craft-directive block injected for all story-format generation, and add a corrected cost-analytics admin endpoint.

**Architecture:** `buildStaticContext` is refactored to assemble its existing sections (header, voice fingerprint, characters+relationships, locations, plots) in priority order into a token-budget-aware result, appending a `[Context trimmed — project too large]` marker if the budget is exceeded — deterministically, so the prompt-cache block stays stable. A new pure `capContextForTier` helper enforces per-tier character caps on `staticContext`/`dynamicContext`/`prompt` server-side in `/api/ai/generate`, applied before series/universe context (server-built, trusted) is appended. Per-character instructional sentences (backstory/want/need/contradiction) are replaced with data-only lines, and a single `WRITE_CRAFT_DIRECTIVES` block is injected once into the shared cached system block for story formats (Novel/Screenplay/Web Series), covering Write mode, Dialogue mode, and all library modes. A new `/api/admin/cost-report` endpoint joins `generations` → `projects` to attribute token spend to users with blended per-model rates.

**Tech Stack:** Next.js 16 App Router API routes, Drizzle ORM 0.45.x / Neon Postgres, Vitest, TypeScript.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/ai/context-builder.ts` | `buildStaticContext` — add token-budget section assembly (B-2 Layer 1) and de-bloat character context (B-1a) |
| `src/lib/ai/__tests__/context-builder.test.ts` | Tests for budget/trim behavior and de-bloated character output |
| `src/lib/ai/context-caps.ts` (new) | Pure `capContextForTier` helper + `CONTEXT_CHAR_CAPS` (B-2 Layer 2) |
| `src/lib/ai/__tests__/context-caps.test.ts` (new) | Unit tests for `capContextForTier` |
| `src/app/api/ai/generate/route.ts` | Wire capped static/dynamic/prompt values into `generate()` and the `generations` insert |
| `src/lib/ai/engine.ts` | Add `WRITE_CRAFT_DIRECTIVES` + `getCraftDirectives`, inject into shared system block (B-1b) |
| `src/lib/ai/__tests__/engine.test.ts` (new) | Unit tests for `getCraftDirectives` |
| `src/app/api/admin/cost-report/route.ts` (new) | B-3 cost analytics endpoint |

**Execution order:** Task 1 → Task 2 (B-2, both layers) → Task 3 → Task 4 (B-1) → Task 5 (B-3), per the work order's merged execution order (B-2 before B-1).

---

### Task 1: B-2 Layer 1 — Token-budget section assembly in `buildStaticContext`

**Files:**
- Modify: `src/lib/ai/context-builder.ts:112-637`
- Test: `src/lib/ai/__tests__/context-builder.test.ts`

- [ ] **Step 1: Write the failing tests**

Edit `src/lib/ai/__tests__/context-builder.test.ts`. First, update the import on line 2 to also bring in `buildStaticContext`:

```ts
import { buildContext, buildStaticContext, type ContextProject, type StoryMemory } from "@/lib/ai/context-builder";
```

Then append a new `describe` block at the end of the file (after the closing `});` of the existing `describe("buildContext", ...)` block):

```ts

describe("buildStaticContext — token budget", () => {
  it("does not include a trim marker for small projects", () => {
    const ctx = buildStaticContext(baseProject({ characters: [makeCharacter({ name: "Alice" })] }));
    expect(ctx).not.toContain("[Context trimmed");
  });

  it("appends a trim marker and stays within budget for very large projects", () => {
    const longText = "x".repeat(1000);
    const characters = Array.from({ length: 10 }, (_, i) =>
      makeCharacter({
        id: `c${i}`,
        name: `Character${i}`,
        appearance: longText,
        personality: longText,
        thinkingStyle: longText,
        behavior: longText,
        habits: longText,
        speechPattern: longText,
        arc: longText,
        backstory: longText,
      })
    );
    const ctx = buildStaticContext(baseProject({ characters }));
    expect(ctx).toContain("[Context trimmed — project too large]");
    // 8,000-token budget ≈ 32,000 chars; allow slack for the header section
    // (always included) plus the trim marker itself.
    expect(ctx.length).toBeLessThan(40_000);
  });

  it("produces identical output for identical project data (deterministic truncation)", () => {
    const longText = "y".repeat(1000);
    const characters = Array.from({ length: 10 }, (_, i) =>
      makeCharacter({ id: `c${i}`, name: `Character${i}`, backstory: longText, personality: longText })
    );
    const project = baseProject({ characters });
    expect(buildStaticContext(project)).toBe(buildStaticContext(project));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/ai/__tests__/context-builder.test.ts`
Expected: FAIL — `buildStaticContext` is not exported, or the new tests fail because no trim marker exists yet (the import error will fail the whole file first; that's expected).

- [ ] **Step 3: Implement the section-array refactor**

In `src/lib/ai/context-builder.ts`, the function builds a flat `r: string[]` array via sequential `r.push(...)` calls across 5 logical sections (header, voice fingerprint, characters+relationships, locations, plots) and returns `r.join("\n")`. Refactor this into a `let r` that gets reassigned to a fresh array at each section boundary, with all arrays tracked in `sections: string[][]`. At the end, assemble sections in priority order under a token budget. **Do not change any of the per-section content-building logic** — only the section-boundary bookkeeping and the final return statement.

Apply these 6 edits:

**1. Function header — add `estimateTokens`, `STATIC_CONTEXT_BUDGET`, and the `sections` array:**

```ts
// OLD
export function buildStaticContext(p: ContextProject): string {
  const r: string[] = [];

  // ── ACTIVE INFLUENCE ───────────────────────────────────────────────────────
```

```ts
// NEW
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const STATIC_CONTEXT_BUDGET = 8_000;

export function buildStaticContext(p: ContextProject): string {
  let r: string[] = [];
  const sections: string[][] = [r];

  // ── ACTIVE INFLUENCE ───────────────────────────────────────────────────────
```

**2. Boundary before VOICE FINGERPRINT (start of section 1):**

```ts
// OLD
    if (attrs.length > 0) {
      r.push("\nSTYLE DIRECTIVE — FOLLOW THESE IN EVERY SENTENCE:");
      attrs.forEach((a) => r.push("• " + a));
    }
  }

  // ── VOICE FINGERPRINT ─────────────────────────────────────────────────────
  // Constraint-based voice preservation (Berkeley 2026): prompt instructions drift,
  // numerical constraints measured from the writer's own prose don't.
  if (p.chapters && p.chapters.length >= 3) {
```

```ts
// NEW
    if (attrs.length > 0) {
      r.push("\nSTYLE DIRECTIVE — FOLLOW THESE IN EVERY SENTENCE:");
      attrs.forEach((a) => r.push("• " + a));
    }
  }

  r = [];
  sections.push(r);

  // ── VOICE FINGERPRINT ─────────────────────────────────────────────────────
  // Constraint-based voice preservation (Berkeley 2026): prompt instructions drift,
  // numerical constraints measured from the writer's own prose don't.
  if (p.chapters && p.chapters.length >= 3) {
```

**3. Boundary before CHARACTERS (start of section 2 — characters + relationships):**

```ts
// OLD
    const fingerprint = extractVoiceFingerprint(recentChapterContents);
    if (fingerprint) {
      r.push('\n' + fingerprintToConstraints(fingerprint));
      r.push('');
    }
  }

  if (p.characters?.length) {
    r.push("CHARACTERS:");
```

```ts
// NEW
    const fingerprint = extractVoiceFingerprint(recentChapterContents);
    if (fingerprint) {
      r.push('\n' + fingerprintToConstraints(fingerprint));
      r.push('');
    }
  }

  r = [];
  sections.push(r);

  if (p.characters?.length) {
    r.push("CHARACTERS:");
```

**4. Boundary before LOCATIONS (start of section 3):**

```ts
// OLD
        if (rel.notes) parts.push(`notes: ${rel.notes}`);

        r.push(parts.join(' | '));
      }
    }
  }

  if (p.locations?.length) {
    r.push("LOCATIONS:");
```

```ts
// NEW
        if (rel.notes) parts.push(`notes: ${rel.notes}`);

        r.push(parts.join(' | '));
      }
    }
  }

  r = [];
  sections.push(r);

  if (p.locations?.length) {
    r.push("LOCATIONS:");
```

**5. Boundary before PLOTS (start of section 4):**

```ts
// OLD
      if (l.atmosphere)     parts.push("  Atmosphere: " + l.atmosphere);
      if (l.history)        parts.push("  History: " + l.history);
      if (l.sensoryDetails) parts.push("  Sensory: " + l.sensoryDetails);
      r.push(parts.join("\n"));
    });
  }

  if (p.plotThreads?.length) {
    r.push("PLOTS:");
```

```ts
// NEW
      if (l.atmosphere)     parts.push("  Atmosphere: " + l.atmosphere);
      if (l.history)        parts.push("  History: " + l.history);
      if (l.sensoryDetails) parts.push("  Sensory: " + l.sensoryDetails);
      r.push(parts.join("\n"));
    });
  }

  r = [];
  sections.push(r);

  if (p.plotThreads?.length) {
    r.push("PLOTS:");
```

**6. Final assembly — replace `return r.join("\n");` with the budget-aware loop:**

```ts
// OLD
  if (p.plotThreads?.length) {
    r.push("PLOTS:");
    p.plotThreads.forEach((t: PlotThread) => {
      if (t.alwaysInContext === false) {
        r.push("- [" + (t.status || "Active") + "] " + t.name + " (minor thread)");
        return;
      }
      const parts = ["- [" + t.status + "] " + t.name + (t.description ? ": " + t.description : "")];
      if (t.stakes)      parts.push("  Stakes: " + t.stakes);
      if (t.connections) parts.push("  Connections: " + t.connections);
      r.push(parts.join("\n"));
    });
  }

  return r.join("\n");
}
```

```ts
// NEW
  if (p.plotThreads?.length) {
    r.push("PLOTS:");
    p.plotThreads.forEach((t: PlotThread) => {
      if (t.alwaysInContext === false) {
        r.push("- [" + (t.status || "Active") + "] " + t.name + " (minor thread)");
        return;
      }
      const parts = ["- [" + t.status + "] " + t.name + (t.description ? ": " + t.description : "")];
      if (t.stakes)      parts.push("  Stakes: " + t.stakes);
      if (t.connections) parts.push("  Connections: " + t.connections);
      r.push(parts.join("\n"));
    });
  }

  // Assemble sections in priority order, stopping when the static context
  // budget is exceeded. Section 0 (header) is always included so the output
  // is never empty. Truncation is deterministic for identical project data,
  // keeping the prompt-cache block stable.
  const result: string[] = [];
  for (let i = 0; i < sections.length; i++) {
    const sectionLines = sections[i];
    if (sectionLines.length === 0) continue;
    const candidate = [...result, ...sectionLines].join("\n");
    if (i > 0 && estimateTokens(candidate) > STATIC_CONTEXT_BUDGET) {
      result.push('[Context trimmed — project too large]');
      break;
    }
    result.push(...sectionLines);
  }
  return result.join("\n");
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/ai/__tests__/context-builder.test.ts`
Expected: PASS — all existing tests plus the 3 new ones in `describe("buildStaticContext — token budget", ...)`.

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npm test` and `npx tsc --noEmit`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/context-builder.ts src/lib/ai/__tests__/context-builder.test.ts
git commit -m "Add token-budget section assembly to buildStaticContext"
```

---

### Task 2: B-2 Layer 2 — Server-side context caps for `/api/ai/generate`

**Files:**
- Create: `src/lib/ai/context-caps.ts`
- Test: `src/lib/ai/__tests__/context-caps.test.ts`
- Modify: `src/app/api/ai/generate/route.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/ai/__tests__/context-caps.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { capContextForTier, CONTEXT_CHAR_CAPS } from "@/lib/ai/context-caps";

describe("capContextForTier", () => {
  it("caps staticContext to the tier's character limit", () => {
    const huge = "a".repeat(100_000);
    const result = capContextForTier("free", { staticContext: huge, prompt: "hi" });
    expect(result.cappedStatic?.length).toBe(CONTEXT_CHAR_CAPS.free);
  });

  it("caps dynamicContext to half the tier's character limit", () => {
    const huge = "b".repeat(100_000);
    const result = capContextForTier("story_pro", { dynamicContext: huge, prompt: "hi" });
    expect(result.cappedDynamic?.length).toBe(Math.floor(CONTEXT_CHAR_CAPS.story_pro / 2));
  });

  it("caps prompt to 20,000 characters regardless of tier", () => {
    const huge = "c".repeat(100_000);
    const result = capContextForTier("all_access", { prompt: huge });
    expect(result.cappedPrompt.length).toBe(20_000);
  });

  it("leaves cappedStatic and cappedDynamic undefined when not provided", () => {
    const result = capContextForTier("free", { prompt: "hi" });
    expect(result.cappedStatic).toBeUndefined();
    expect(result.cappedDynamic).toBeUndefined();
  });

  it("falls back to the default cap for an unknown tier", () => {
    const huge = "d".repeat(100_000);
    const result = capContextForTier("unknown_tier", { staticContext: huge, prompt: "hi" });
    expect(result.cappedStatic?.length).toBe(6_000 * 4);
  });

  it("does not truncate content smaller than the cap", () => {
    const small = "hello world";
    const result = capContextForTier("story_pro", { staticContext: small, dynamicContext: small, prompt: small });
    expect(result.cappedStatic).toBe(small);
    expect(result.cappedDynamic).toBe(small);
    expect(result.cappedPrompt).toBe(small);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/ai/__tests__/context-caps.test.ts`
Expected: FAIL with "Cannot find module '@/lib/ai/context-caps'" or similar.

- [ ] **Step 3: Implement `context-caps.ts`**

Create `src/lib/ai/context-caps.ts`:

```ts
// Per-tier ceilings on context sent to /api/ai/generate, enforced server-side.
// Caps are deterministic for identical (tier, input) so the prompt-cache
// block stays byte-identical across calls — a tier change is the only thing
// that can shift the cap, which is an expected one-time cache miss.

export const CONTEXT_CHAR_CAPS: Record<string, number> = {
  free:        2_000 * 4,
  story_pro:   8_000 * 4,
  creator_pro: 6_000 * 4,
  all_access: 10_000 * 4,
};

const DEFAULT_CONTEXT_CHAR_CAP = 6_000 * 4;
const PROMPT_CHAR_CAP = 20_000;

export function capContextForTier(tier: string, input: {
  staticContext?: string;
  dynamicContext?: string;
  prompt: string;
}): { cappedStatic?: string; cappedDynamic?: string; cappedPrompt: string } {
  const cap = CONTEXT_CHAR_CAPS[tier] ?? DEFAULT_CONTEXT_CHAR_CAP;
  return {
    cappedStatic: input.staticContext !== undefined ? input.staticContext.slice(0, cap) : undefined,
    cappedDynamic: input.dynamicContext !== undefined ? input.dynamicContext.slice(0, Math.floor(cap / 2)) : undefined,
    cappedPrompt: input.prompt.slice(0, PROMPT_CHAR_CAP),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/ai/__tests__/context-caps.test.ts`
Expected: PASS — all 6 tests.

- [ ] **Step 5: Wire caps into `src/app/api/ai/generate/route.ts`**

Apply 6 edits:

**1. Add the import (after the `engine` import):**

```ts
// OLD
import { GATED_MODES } from "@/types/subscription";
import { generate, MODELS } from "@/lib/ai/engine";
```

```ts
// NEW
import { GATED_MODES } from "@/types/subscription";
import { generate, MODELS } from "@/lib/ai/engine";
import { capContextForTier } from "@/lib/ai/context-caps";
```

**2. Compute caps right after `tier` is resolved:**

```ts
// OLD
  // Tier check: mode-gated features (dialogue, combat, emotional, atmosphere, tension, composition)
  const tier = await getUserTier(session.user.id);
  const gatedFeature = GATED_MODES[mode as string];
```

```ts
// NEW
  // Tier check: mode-gated features (dialogue, combat, emotional, atmosphere, tension, composition)
  const tier = await getUserTier(session.user.id);

  // Server-side context caps: a deterministic ceiling per tier so the prompt-cache
  // block stays byte-identical across calls with the same input (cap only changes
  // on a tier change, which is an expected one-time cache miss).
  const { cappedStatic, cappedDynamic, cappedPrompt } = capContextForTier(tier, { staticContext, dynamicContext, prompt });

  const gatedFeature = GATED_MODES[mode as string];
```

**3. Use `cappedPrompt` as the base for `effectivePrompt`:**

```ts
// OLD
    // Brainstorm mode: append 3-options directive
    let effectivePrompt = prompt;
    if (mode === 'brainstorm') {
      effectivePrompt = prompt + `\n\nReturn exactly 3 distinct structural approaches as options. Do not pick one.\nFormat strictly:\n\nOPTION A — [SHORT NAME]:\n[2-3 sentences describing the structural direction, opening, key tension]\n\nOPTION B — [SHORT NAME]:\n[2-3 sentences describing a different structural direction]\n\nOPTION C — [SHORT NAME]:\n[2-3 sentences describing a third structural direction]\n\n---\nEach option must represent a genuinely different creative direction, not variations of the same idea.\nOne option should subvert expectations.`;
    }
    else if (mode === 'outline') {
      effectivePrompt = prompt + `\n\nFormat each beat as a numbered list item starting with "BEAT:":\nBEAT: [beat description in present tense, 1-2 sentences]\n\nGenerate 6-12 beats appropriate for this story. Each beat should describe what happens in the scene and what changes as a result.`;
    }
```

```ts
// NEW
    // Brainstorm mode: append 3-options directive
    let effectivePrompt = cappedPrompt;
    if (mode === 'brainstorm') {
      effectivePrompt = cappedPrompt + `\n\nReturn exactly 3 distinct structural approaches as options. Do not pick one.\nFormat strictly:\n\nOPTION A — [SHORT NAME]:\n[2-3 sentences describing the structural direction, opening, key tension]\n\nOPTION B — [SHORT NAME]:\n[2-3 sentences describing a different structural direction]\n\nOPTION C — [SHORT NAME]:\n[2-3 sentences describing a third structural direction]\n\n---\nEach option must represent a genuinely different creative direction, not variations of the same idea.\nOne option should subvert expectations.`;
    }
    else if (mode === 'outline') {
      effectivePrompt = cappedPrompt + `\n\nFormat each beat as a numbered list item starting with "BEAT:":\nBEAT: [beat description in present tense, 1-2 sentences]\n\nGenerate 6-12 beats appropriate for this story. Each beat should describe what happens in the scene and what changes as a result.`;
    }
```

**4. Use `cappedStatic` as the base for `effectiveStatic`:**

```ts
// OLD
    // Series/universe context belongs in the static (cached) block — it doesn't change mid-session
    const effectiveStatic = seriesUniverseCtx
      ? (staticContext ?? '') + '\n\n---\n' + seriesUniverseCtx
      : staticContext;
```

```ts
// NEW
    // Series/universe context belongs in the static (cached) block — it doesn't change mid-session.
    // Appended AFTER the cap so server-derived series/universe context is never truncated by a
    // client-inflated static block.
    const effectiveStatic = seriesUniverseCtx
      ? (cappedStatic ?? '') + '\n\n---\n' + seriesUniverseCtx
      : cappedStatic;
```

**5. Use `cappedDynamic` as the base for `effectiveDynamic`:**

```ts
// OLD
    const effectiveDynamic = [dynamicContext, additionalContext, aiismsNote, domainResearchContext].filter(Boolean).join('\n\n');
```

```ts
// NEW
    const effectiveDynamic = [cappedDynamic, additionalContext, aiismsNote, domainResearchContext].filter(Boolean).join('\n\n');
```

**6. Store `cappedPrompt` in the `generations` insert:**

```ts
// OLD
    await db.insert(generations).values({
      projectId, chapterId: chapterId || null, mode, prompt,
      output: r.text, model: r.model, tokensUsed: r.tokensUsed,
    });
```

```ts
// NEW
    await db.insert(generations).values({
      projectId, chapterId: chapterId || null, mode, prompt: cappedPrompt,
      output: r.text, model: r.model, tokensUsed: r.tokensUsed,
    });
```

- [ ] **Step 6: Run the full test suite and typecheck**

Run: `npm test` and `npx tsc --noEmit`
Expected: both exit 0. (`src/app/api/ai/__tests__/generate.test.ts` does not exercise the route's `POST` handler directly, so it is unaffected by this change.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/context-caps.ts src/lib/ai/__tests__/context-caps.test.ts src/app/api/ai/generate/route.ts
git commit -m "Add server-side per-tier context caps to /api/ai/generate"
```

- [ ] **Step 8 (manual, post-deploy): Verify the cap is enforced end-to-end**

After deploying, on a free-tier account, POST to `/api/ai/generate` with a `staticContext` string of ~500KB and confirm:
1. The request succeeds (does not hit the pre-existing 150KB `totalLength` guard, since that guard checks the legacy `context` field, not `staticContext`).
2. The corresponding row in `generations.prompt` reflects the capped prompt (≤ 20,000 chars), not the raw input.
3. Response generation quality looks normal (the model received `cappedStatic` truncated to `2_000 * 4 = 8,000` chars for the free tier).

---

### Task 3: B-1a — De-bloat per-character context (backstory / want-need / contradiction)

**Files:**
- Modify: `src/lib/ai/context-builder.ts` (inside the CHARACTERS section of `buildStaticContext`)
- Test: `src/lib/ai/__tests__/context-builder.test.ts`

- [ ] **Step 1: Write the failing test**

Append a new `describe` block to `src/lib/ai/__tests__/context-builder.test.ts` (after the `describe("buildStaticContext — token budget", ...)` block added in Task 1):

```ts

describe("buildStaticContext — character embodiment", () => {
  it("emits backstory, want/need, and contradiction as data only, without instructional sentences", () => {
    const char = makeCharacter({
      name: "Alice",
      backstory: "Grew up in a war zone.",
    });
    (char as any).characterWant = "to be free";
    (char as any).characterNeed = "to forgive herself";
    (char as any).contradiction = "Craves connection but pushes everyone away.";

    const ctx = buildStaticContext(baseProject({ characters: [char] }));

    expect(ctx).toContain("Backstory: Grew up in a war zone.");
    expect(ctx).toContain("Want: to be free");
    expect(ctx).toContain("Need: to forgive herself");
    expect(ctx).toContain("Contradiction: Craves connection but pushes everyone away.");
    expect(ctx).not.toContain("do not state — embody");
    expect(ctx).not.toContain("DEFINING CONTRADICTION");
    expect(ctx).not.toContain("collision between want and need");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/context-builder.test.ts`
Expected: FAIL — current output contains `BACKSTORY (do not state — embody): ...` and `DEFINING CONTRADICTION: ...`, not the plain `Backstory: ...` / `Contradiction: ...` lines.

- [ ] **Step 3: Implement the de-bloat**

In `src/lib/ai/context-builder.ts`, inside the `p.characters.forEach((c: Character) => { ... })` block of `buildStaticContext`, replace the BACKSTORY / WANT-NEED / CONTRADICTION sub-blocks:

```ts
// OLD
      // ── BACKSTORY AS BEHAVIOR ──────────────────────────────────────────────
      if (c.backstory) {
        parts.push(`  BACKSTORY (do not state — embody): ${c.backstory}`);
        parts.push('  This is not information to be explained — it is the sediment that produces behavior. Show it through reflex, avoidance, the things this character does automatically without knowing why. The reader must sense the history, never be told it.');
      }

      // ── WANT / NEED STRUCTURAL ENGINE ─────────────────────────────────────
      if ((c as any).characterWant && (c as any).characterNeed) {
        parts.push(`  WANT: ${(c as any).characterWant} — this is what they actively pursue. Every scene, they are moving toward this, even obliquely.`);
        parts.push(`  NEED: ${(c as any).characterNeed} — this is the truth they resist. The story is the collision between want and need. They cannot get what they want without confronting what they need.`);
      } else {
        if (c.fears)   parts.push(`  Fears: ${c.fears}`);
        if (c.desires) parts.push(`  Desires: ${c.desires}`);
      }

      // ── CORE CONTRADICTION ────────────────────────────────────────────────
      if ((c as any).contradiction?.trim()) {
        parts.push(`  DEFINING CONTRADICTION: ${(c as any).contradiction}`);
        parts.push('  Write behavior that expresses both sides of this tension — never resolving it cleanly. This contradiction is not a flaw to be overcome. It is what makes this character human.');
      }
```

```ts
// NEW
      // ── BACKSTORY AS BEHAVIOR ──────────────────────────────────────────────
      if (c.backstory) {
        parts.push(`  Backstory: ${c.backstory}`);
      }

      // ── WANT / NEED STRUCTURAL ENGINE ─────────────────────────────────────
      if ((c as any).characterWant && (c as any).characterNeed) {
        parts.push(`  Want: ${(c as any).characterWant}`);
        parts.push(`  Need: ${(c as any).characterNeed}`);
      } else {
        if (c.fears)   parts.push(`  Fears: ${c.fears}`);
        if (c.desires) parts.push(`  Desires: ${c.desires}`);
      }

      // ── CORE CONTRADICTION ────────────────────────────────────────────────
      if ((c as any).contradiction?.trim()) {
        parts.push(`  Contradiction: ${(c as any).contradiction}`);
      }
```

The instructional sentences removed here move to `WRITE_CRAFT_DIRECTIVES` in Task 4, injected once per generation instead of once per character.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/context-builder.test.ts`
Expected: PASS — all tests including the new `describe("buildStaticContext — character embodiment", ...)`.

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npm test` and `npx tsc --noEmit`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/context-builder.ts src/lib/ai/__tests__/context-builder.test.ts
git commit -m "De-bloat character backstory/want-need/contradiction context to data-only lines"
```

---

### Task 4: B-1b — Add `WRITE_CRAFT_DIRECTIVES` and inject into the shared story-mode system block

**Files:**
- Modify: `src/lib/ai/engine.ts:269-365`
- Test: `src/lib/ai/__tests__/engine.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/__tests__/engine.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

vi.mock("@/lib/semantic-cache", () => ({
  checkSemanticCache: vi.fn(),
  writeSemanticCache: vi.fn(),
}));

const { getCraftDirectives, WRITE_CRAFT_DIRECTIVES } = await import("@/lib/ai/engine");

describe("getCraftDirectives", () => {
  it("includes WRITE_CRAFT_DIRECTIVES content for story formats with character cards", () => {
    expect(getCraftDirectives("Novel")).toContain("CHARACTER EMBODIMENT RULES");
    expect(getCraftDirectives("Screenplay")).toContain(WRITE_CRAFT_DIRECTIVES.trim());
    expect(getCraftDirectives("Web Series")).toContain("Contradiction must never resolve cleanly");
  });

  it("returns an empty string for creator formats (no character cards)", () => {
    expect(getCraftDirectives("YouTube Long-form")).toBe("");
    expect(getCraftDirectives("YouTube Short")).toBe("");
    expect(getCraftDirectives("TikTok Script")).toBe("");
    expect(getCraftDirectives("Instagram Reel")).toBe("");
    expect(getCraftDirectives("Podcast Episode")).toBe("");
    expect(getCraftDirectives("Podcast Episode (Co-host)")).toBe("");
  });

  it("returns an empty string for unrecognized formats", () => {
    expect(getCraftDirectives("Some Custom Format")).toBe("");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/engine.test.ts`
Expected: FAIL — `getCraftDirectives` and `WRITE_CRAFT_DIRECTIVES` are not exported from `@/lib/ai/engine`.

- [ ] **Step 3: Implement `WRITE_CRAFT_DIRECTIVES` and `getCraftDirectives`**

In `src/lib/ai/engine.ts`, add the constant and helper between the end of `FORMAT_RULES` and the start of `generate`:

```ts
// OLD
  "Podcast Episode (Co-host)": `FORMAT: Podcast Co-host Simulation
OUTPUT FORMAT — CRITICAL:
- [CO-HOST]: one-sentence question or challenge
- [HOST TALKING POINTS]: 3-5 bullet points (NOT scripted prose — the host speaks naturally from these)
Co-host voice options:
  curious_generalist — asks "why" and "how", represents the audience
  skeptical_expert — challenges assumptions, asks for evidence
  enthusiastic_newcomer — expresses surprise, asks for clarification`,
};

export async function generate({ mode, prompt, context, staticContext, dynamicContext, format, maxTokens = 4000, narrativeStructure, overrideModel }: {
```

```ts
// NEW
  "Podcast Episode (Co-host)": `FORMAT: Podcast Co-host Simulation
OUTPUT FORMAT — CRITICAL:
- [CO-HOST]: one-sentence question or challenge
- [HOST TALKING POINTS]: 3-5 bullet points (NOT scripted prose — the host speaks naturally from these)
Co-host voice options:
  curious_generalist — asks "why" and "how", represents the audience
  skeptical_expert — challenges assumptions, asks for evidence
  enthusiastic_newcomer — expresses surprise, asks for clarification`,
};

export const WRITE_CRAFT_DIRECTIVES = `
CHARACTER EMBODIMENT RULES (apply to all characters with backstory, want/need, contradiction):
- Backstory is sediment, not exposition. Show it through reflex, avoidance, automatic behavior. Never explain it.
- Want drives every scene — the character moves toward it even obliquely.
- Need is the truth they resist. The story is the collision between want and need.
- Contradiction must never resolve cleanly. Write behavior that expresses both sides.
`;

export function getCraftDirectives(format: string): string {
  return STORY_FORMAT_RULES[format] ? "\n" + WRITE_CRAFT_DIRECTIVES : "";
}

export async function generate({ mode, prompt, context, staticContext, dynamicContext, format, maxTokens = 4000, narrativeStructure, overrideModel }: {
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/engine.test.ts`
Expected: PASS — all 3 tests.

- [ ] **Step 5: Inject `craftDirectives` into both system-block branches of `generate`**

```ts
// OLD
  const model = overrideModel ?? (QUALITY_MODES.has(mode) ? MODELS.quality : MODELS.default);
  const formatRules = FORMAT_RULES[format]
    ? "\n\n" + FORMAT_RULES[format]
    : STORY_FORMAT_RULES[format]
    ? "\n\n" + STORY_FORMAT_RULES[format]
    : "";
  const modeInstruction = (MI as Record<string, (f: string) => string>)[mode](format);
  const narrativeNote = getNarrativeStructureInstruction(narrativeStructure);

  let systemBlocks: any[];
  if (staticContext !== undefined && dynamicContext !== undefined) {
    systemBlocks = [
      {
        type: 'text',
        text: modeInstruction + formatRules + narrativeNote + '\n---\n' + staticContext,
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text',
        text: dynamicContext,
      },
    ];
  } else {
    const fullContext = context ?? '';
    systemBlocks = [{ type: 'text', text: modeInstruction + formatRules + narrativeNote + '\n---\n' + fullContext, cache_control: { type: 'ephemeral' } }];
  }
```

```ts
// NEW
  const model = overrideModel ?? (QUALITY_MODES.has(mode) ? MODELS.quality : MODELS.default);
  const formatRules = FORMAT_RULES[format]
    ? "\n\n" + FORMAT_RULES[format]
    : STORY_FORMAT_RULES[format]
    ? "\n\n" + STORY_FORMAT_RULES[format]
    : "";
  const craftDirectives = getCraftDirectives(format);
  const modeInstruction = (MI as Record<string, (f: string) => string>)[mode](format);
  const narrativeNote = getNarrativeStructureInstruction(narrativeStructure);

  let systemBlocks: any[];
  if (staticContext !== undefined && dynamicContext !== undefined) {
    systemBlocks = [
      {
        type: 'text',
        text: modeInstruction + formatRules + craftDirectives + narrativeNote + '\n---\n' + staticContext,
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text',
        text: dynamicContext,
      },
    ];
  } else {
    const fullContext = context ?? '';
    systemBlocks = [{ type: 'text', text: modeInstruction + formatRules + craftDirectives + narrativeNote + '\n---\n' + fullContext, cache_control: { type: 'ephemeral' } }];
  }
```

This covers both branches: the `staticContext`/`dynamicContext` split (used by Write, Dialogue, and all library modes via `useAIActions.ts`) and the legacy `context` fallback. `craftDirectives` is `""` for creator formats (YouTube/TikTok/Instagram/Podcast), so their system blocks are unchanged.

- [ ] **Step 6: Run the full test suite and typecheck**

Run: `npm test` and `npx tsc --noEmit`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/engine.ts src/lib/ai/__tests__/engine.test.ts
git commit -m "Inject shared WRITE_CRAFT_DIRECTIVES into story-format system blocks"
```

- [ ] **Step 8 (manual, post-deploy): Verify generation quality**

On a project with at least one character that has `backstory`, `characterWant`/`characterNeed`, and `contradiction` filled in:
1. Generate once in Write mode (Novel/Screenplay/Web Series project) — confirm the static context block contains plain `Backstory:` / `Want:` / `Need:` / `Contradiction:` lines (no repeated instructional sentences per character) and that output quality (character embodiment) is unchanged from before.
2. Generate once in a library mode (e.g. Horror) on the same project — confirm `WRITE_CRAFT_DIRECTIVES` is present in the system prompt (character embodiment guidance is no longer Write-mode-only).
3. Generate once in a creator-format project (e.g. YouTube Long-form) — confirm the system prompt does NOT contain `CHARACTER EMBODIMENT RULES`.

---

### Task 5: B-3 — Cost analytics admin endpoint

**Files:**
- Create: `src/app/api/admin/cost-report/route.ts`

- [ ] **Step 1: Implement the endpoint**

Create `src/app/api/admin/cost-report/route.ts`. This follows the same `ADMIN_SECRET` gating pattern as `src/app/api/admin/analytics/route.ts`. Per CLAUDE.md, `generations` has no `userId` column — attribution requires an inner join through `projects`.

```ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { generations, projects } from '@/db/schema';
import { gte, eq, sql } from 'drizzle-orm';

// Blended USD per million tokens (tokensUsed = input + output combined, so a
// single blended rate is used rather than separate input/output pricing).
const BLENDED_COST_PER_MTOK: Record<string, number> = {
  'claude-haiku-4-5-20251001': 1.6,
  'claude-sonnet-4-6':         5.4,
  'claude-opus-4-6':           27.0,
  'claude-opus-4-8':           27.0,
};
const DEFAULT_COST_PER_MTOK = 5.4;

function costForTokens(model: string | null, tokens: number): number {
  const rate = BLENDED_COST_PER_MTOK[model ?? ''] ?? DEFAULT_COST_PER_MTOK;
  return (tokens / 1_000_000) * rate;
}

export async function GET(req: Request) {
  if (!process.env.ADMIN_SECRET) {
    return new Response('Server misconfigured: ADMIN_SECRET not set', { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Per (user, model) token totals — drives topUsers cost ranking.
  const userModelTotals = await db
    .select({
      userId: projects.userId,
      model: generations.model,
      tokens: sql<number>`sum(${generations.tokensUsed})`,
    })
    .from(generations)
    .innerJoin(projects, eq(generations.projectId, projects.id))
    .where(gte(generations.createdAt, since))
    .groupBy(projects.userId, generations.model);

  // Per-model token totals — drives costByModel and the platform total.
  const modelTotals = await db
    .select({
      model: generations.model,
      tokens: sql<number>`sum(${generations.tokensUsed})`,
    })
    .from(generations)
    .innerJoin(projects, eq(generations.projectId, projects.id))
    .where(gte(generations.createdAt, since))
    .groupBy(generations.model);

  // Per-mode token totals — drives topModes.
  const modeTotals = await db
    .select({
      mode: generations.mode,
      tokens: sql<number>`sum(${generations.tokensUsed})`,
    })
    .from(generations)
    .innerJoin(projects, eq(generations.projectId, projects.id))
    .where(gte(generations.createdAt, since))
    .groupBy(generations.mode);

  const costByModel: Record<string, { tokens: number; costUSD: number }> = {};
  let totalEstimatedCostUSD = 0;
  for (const row of modelTotals) {
    const tokens = Number(row.tokens) || 0;
    const costUSD = costForTokens(row.model, tokens);
    costByModel[row.model ?? 'unknown'] = { tokens, costUSD: Number(costUSD.toFixed(4)) };
    totalEstimatedCostUSD += costUSD;
  }

  const userCosts = new Map<string, number>();
  for (const row of userModelTotals) {
    const tokens = Number(row.tokens) || 0;
    const cost = costForTokens(row.model, tokens);
    userCosts.set(row.userId, (userCosts.get(row.userId) ?? 0) + cost);
  }
  const topUsers = [...userCosts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([userId, costUSD]) => ({ userId, costUSD: Number(costUSD.toFixed(4)) }));

  const topModes = modeTotals
    .map((row) => ({ mode: row.mode ?? 'unknown', tokens: Number(row.tokens) || 0 }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 15);

  return NextResponse.json({
    period: '30d',
    since,
    totalEstimatedCostUSD: Number(totalEstimatedCostUSD.toFixed(4)),
    costByModel,
    topUsers,
    topModes,
    note: 'Estimates use blended per-token rates (combined input+output, since tokensUsed does not separate them) and do not account for prompt-caching discounts (~90% cheaper for cached input tokens). Treat as directional, not exact billing figures.',
  });
}
```

- [ ] **Step 2: Run the full test suite and typecheck**

Run: `npm test` and `npx tsc --noEmit`
Expected: both exit 0. (No automated test is added for this route — `src/app/api/admin/analytics/route.ts` and the other admin routes follow the same untested, `ADMIN_SECRET`-gated pattern; this endpoint is verified manually below, consistent with that precedent.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/cost-report/route.ts
git commit -m "Add cost-report admin endpoint with per-user blended cost attribution"
```

- [ ] **Step 4 (manual, post-deploy): Verify against production**

```bash
curl https://www.ghost-writer.cc/api/admin/cost-report -H "Authorization: Bearer $ADMIN_SECRET"
```

Confirm:
1. `topUsers[].userId` values are user UUIDs (matching `users.id`), not project UUIDs.
2. `totalEstimatedCostUSD` and per-model totals are plausible given recent generation volume.
3. `costByModel` keys match values actually present in `generations.model` (`claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, `claude-opus-4-8`) — the `claude-opus-4-6` entry in `BLENDED_COST_PER_MTOK` is a harmless extra key that nothing currently produces.

---

## Follow-up (separate ticket, not this sprint)

Split `generations.tokensUsed` into `inputTokens` / `outputTokens` / `cacheReadTokens` columns so B-3's blended-rate estimates can become exact per-token-type costs.
