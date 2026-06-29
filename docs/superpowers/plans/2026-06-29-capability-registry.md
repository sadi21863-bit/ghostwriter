# Capability Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single capability registry that catalogs every Writer mode + standalone Director/Editor/creator/production tool under a unified `Capability` shape tagged `{stage, role, provider, gate}`, with an availability/preflight function and a `GET /api/capabilities` envelope — the data spine for the 4-stage funnel, the AI-role split, and OpenMontage-style preflight.

**Architecture:** Additive data/query layer only. Extend `MODE_REGISTRY` in place with `role`/`stage` (no duplication), add a new `TOOL_REGISTRY` for the standalone tools, merge both via `getCapabilities()`, and expose availability via `isCapabilityAvailable`/`supportEnvelope` + one read-only endpoint. No existing behavior or UI changes.

**Tech Stack:** TypeScript, Next.js 16 API route, Vitest. Reuses existing `FeatureGate`/`canAccessFeature`/`getUserTier` (subscription), `isCreatorFormat`/`isStoryFormat` (formats), `decrypt` (crypto).

## Global Constraints

- Purely additive — zero change to how any existing tool executes, and no UI in this sub-project.
- Do not duplicate `MODE_REGISTRY` data; modes are extended in place and mapped into the catalog.
- Reuse the existing gate system (`FeatureGate`, `canAccessFeature`) and format helpers (`isCreatorFormat`/`isStoryFormat`) — do not invent parallel ones.
- Spec is the source of truth: `docs/superpowers/specs/2026-06-29-capability-registry-design.md`.
- Test mocking: never `vi.fn(impl)` with a zero-arg `impl` later spread-called; use `vi.fn()` + `.mockResolvedValue(...)`.
- `tsc --noEmit` exit 0 and real `vitest run` output are ground truth over IDE diagnostics.
- Every `tool` capability that declares an `endpoint` must point at a real `route.ts` on disk (enforced by the drift-guard test in Task 2).

---

### Task 1: Add `role` + `stage` to `MODE_REGISTRY`

**Files:**
- Modify: `src/lib/modes/registry.ts` (the `ModeConfig` interface + all 26 entries)
- Test: `src/lib/modes/__tests__/registry-roles.test.ts`

**Interfaces:**
- Produces: `ModeConfig.role: CapabilityRole` and `ModeConfig.stage: CapabilityStage`, where `CapabilityRole = "director" | "writer" | "editor"` and `CapabilityStage = "discover" | "shape" | "write" | "produce"`. Task 2 imports these two string-literal unions from `@/lib/capabilities/registry` — but to avoid a circular import (registry imports MODE_REGISTRY), define the two unions in `registry.ts` (modes file) is wrong directionally. Resolution: define `CapabilityRole`/`CapabilityStage` in the NEW file `src/lib/capabilities/types.ts` (Task 2 Step 0) and import them into `src/lib/modes/registry.ts`. This task therefore depends on that tiny types file existing first.

- [ ] **Step 1: Create the shared types file (no circular import)**

Create `src/lib/capabilities/types.ts`:

```ts
export type CapabilityRole = "director" | "writer" | "editor";
export type CapabilityStage = "discover" | "shape" | "write" | "produce";
export type CapabilityProvider = "anthropic" | "segmind" | "openai" | "internal";
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/modes/__tests__/registry-roles.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { MODE_REGISTRY } from "../registry";

const ROLES = ["director", "writer", "editor"];
const STAGES = ["discover", "shape", "write", "produce"];

describe("MODE_REGISTRY role/stage tagging", () => {
  it("every mode declares a valid role and stage", () => {
    for (const [mode, cfg] of Object.entries(MODE_REGISTRY)) {
      expect(ROLES, `${mode}.role`).toContain((cfg as any).role);
      expect(STAGES, `${mode}.stage`).toContain((cfg as any).stage);
    }
  });

  it("brainstorm is discover/writer and outline is shape/director", () => {
    expect(MODE_REGISTRY.brainstorm.stage).toBe("discover");
    expect(MODE_REGISTRY.brainstorm.role).toBe("writer");
    expect(MODE_REGISTRY.outline.stage).toBe("shape");
    expect(MODE_REGISTRY.outline.role).toBe("director");
  });

  it("write and the craft modes are write/writer", () => {
    expect(MODE_REGISTRY.write.stage).toBe("write");
    expect(MODE_REGISTRY.write.role).toBe("writer");
    expect(MODE_REGISTRY.dialogue.stage).toBe("write");
    expect(MODE_REGISTRY.combat.role).toBe("writer");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/modes/__tests__/registry-roles.test.ts`
Expected: FAIL — `cfg.role` is `undefined`, not in `ROLES`.

- [ ] **Step 4: Add the two fields to `ModeConfig` and every entry**

In `src/lib/modes/registry.ts`, add the import at the top (after the existing imports):

```ts
import type { CapabilityRole, CapabilityStage } from "@/lib/capabilities/types";
```

Add to the `ModeConfig` interface (after `minDensity?`):

```ts
  /** AI role this mode plays in the funnel: writer = generate, director = plan, editor = review. */
  role: CapabilityRole;
  /** Funnel stage this mode belongs to. */
  stage: CapabilityStage;
```

Then add `role` + `stage` to each of the 26 entries per this mapping (all craft/generation modes are `write`/`writer`; only the two planning/ideation modes differ):

| mode | role | stage |
|---|---|---|
| brainstorm | writer | discover |
| outline | director | shape |
| write, dialogue, combat, emotional, atmosphere, tension, composition, horror, comedy, mystery, romance, action, monologue, voice, thriller, sports, setting, historical, scitech, ethics, endings, isekai, interrogation, chase | writer | write |

For each entry add `role: "...", stage: "..."` as two more object fields, e.g. for `brainstorm`:

```ts
  brainstorm:    { label: "Brainstorm", /* …existing fields… */, contextPolicy: { ...BRIEF, needsMemories: true, needsPlotThreads: true }, role: "writer", stage: "discover" },
```

for `outline`: `role: "director", stage: "shape"`; for `write` and every craft mode: `role: "writer", stage: "write"`.

- [ ] **Step 5: Run the test + tsc**

Run: `npx vitest run src/lib/modes/__tests__/registry-roles.test.ts && npx tsc --noEmit`
Expected: PASS (3/3) and tsc exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/capabilities/types.ts src/lib/modes/registry.ts src/lib/modes/__tests__/registry-roles.test.ts
git commit -m "Tag MODE_REGISTRY entries with capability role + funnel stage"
```

---

### Task 2: Capability catalog (`Capability`, `TOOL_REGISTRY`, `getCapabilities`)

**Files:**
- Create: `src/lib/capabilities/registry.ts`
- Test: `src/lib/capabilities/__tests__/registry.test.ts`

**Interfaces:**
- Consumes: `CapabilityRole`/`CapabilityStage`/`CapabilityProvider` from `./types`; `MODE_REGISTRY` from `@/lib/modes/registry`; `FeatureGate` from `@/types/subscription`; `ModeVisibility` from `@/lib/modes/registry`.
- Produces:
  - `interface Capability { id: string; label: string; kind: "mode"|"tool"; role: CapabilityRole; stage: CapabilityStage; provider: CapabilityProvider; gate: FeatureGate | null; visibility: ModeVisibility; endpoint?: string; experimental?: boolean; }`
  - `getCapabilities(): Capability[]`
  - `getCapabilitiesByStage(stage: CapabilityStage): Capability[]`
  - `getCapabilitiesByRole(role: CapabilityRole): Capability[]`

- [ ] **Step 1: Write the failing tests (catalog + drift guard + completeness)**

Create `src/lib/capabilities/__tests__/registry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getCapabilities, getCapabilitiesByStage, getCapabilitiesByRole } from "../registry";
import { MODE_REGISTRY } from "@/lib/modes/registry";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");

function routeFileForEndpoint(endpoint: string): string {
  // "/api/ai/refine" → "src/app/api/ai/refine/route.ts"
  return join(REPO_ROOT, "src", "app", endpoint.replace(/^\//, ""), "route.ts");
}

describe("getCapabilities", () => {
  const caps = getCapabilities();

  it("includes every MODE_REGISTRY mode exactly once as kind:mode", () => {
    const modeIds = caps.filter(c => c.kind === "mode").map(c => c.id).sort();
    expect(modeIds).toEqual(Object.keys(MODE_REGISTRY).sort());
  });

  it("has no duplicate ids across modes + tools", () => {
    const ids = caps.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every capability has a valid role, stage, and provider", () => {
    for (const c of caps) {
      expect(["director", "writer", "editor"]).toContain(c.role);
      expect(["discover", "shape", "write", "produce"]).toContain(c.stage);
      expect(["anthropic", "segmind", "openai", "internal"]).toContain(c.provider);
    }
  });

  it("drift guard: every tool capability with an endpoint points at a real route.ts", () => {
    const missing: string[] = [];
    for (const c of caps) {
      if (c.kind === "tool" && c.endpoint && !c.endpoint.includes("[")) {
        // skip dynamic-segment endpoints (can't statically resolve [param] dirs here)
        if (!existsSync(routeFileForEndpoint(c.endpoint))) missing.push(`${c.id} -> ${c.endpoint}`);
      }
    }
    expect(missing, `tool endpoints with no route.ts: ${missing.join(", ")}`).toEqual([]);
  });

  it("groups by stage and role", () => {
    expect(getCapabilitiesByStage("write").length).toBeGreaterThan(0);
    expect(getCapabilitiesByRole("director").length).toBeGreaterThan(0);
    expect(getCapabilitiesByStage("write").every(c => c.stage === "write")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/capabilities/__tests__/registry.test.ts`
Expected: FAIL — `Cannot find module '../registry'`.

- [ ] **Step 3: Implement `registry.ts`**

Create `src/lib/capabilities/registry.ts`:

```ts
import type { FeatureGate } from "@/types/subscription";
import { MODE_REGISTRY, type ModeVisibility } from "@/lib/modes/registry";
import type { CapabilityRole, CapabilityStage, CapabilityProvider } from "./types";

export type { CapabilityRole, CapabilityStage, CapabilityProvider } from "./types";

export interface Capability {
  id: string;
  label: string;
  kind: "mode" | "tool";
  role: CapabilityRole;
  stage: CapabilityStage;
  provider: CapabilityProvider;
  gate: FeatureGate | null;
  visibility: ModeVisibility;
  endpoint?: string;
  experimental?: boolean;
}

function modeToCapability(id: string, cfg: typeof MODE_REGISTRY[keyof typeof MODE_REGISTRY]): Capability {
  return {
    id,
    label: cfg.label,
    kind: "mode",
    role: cfg.role,
    stage: cfg.stage,
    provider: "anthropic",
    gate: cfg.gate,
    visibility: cfg.visibility,
  };
}

// Standalone (non-mode) tools. Endpoints with [dynamic] segments are not
// route-checked by the drift guard but must still be real.
export const TOOL_REGISTRY: Capability[] = [
  { id: "prose_fix",            label: "Fix Weakness",          kind: "tool", role: "editor",   stage: "write",    provider: "anthropic", gate: null,                     visibility: "story_and_creator", endpoint: "/api/ai/prose-fix" },
  { id: "surgical_edit",        label: "Find & Edit",           kind: "tool", role: "editor",   stage: "write",    provider: "anthropic", gate: null,                     visibility: "story_and_creator", endpoint: "/api/ai/surgical-edit" },
  { id: "refine",               label: "Refine (critic pass)",  kind: "tool", role: "editor",   stage: "write",    provider: "anthropic", gate: null,                     visibility: "story_and_creator", endpoint: "/api/ai/refine" },
  { id: "knowledge_audit",      label: "Knowledge Audit",       kind: "tool", role: "editor",   stage: "produce",  provider: "anthropic", gate: null,                     visibility: "story_only",        endpoint: "/api/projects/[projectId]/knowledge-audit" },
  { id: "transportation_check", label: "Transportation Check",  kind: "tool", role: "editor",   stage: "produce",  provider: "anthropic", gate: null,                     visibility: "story_only",        endpoint: "/api/projects/[projectId]/transportation-check" },
  { id: "tension_curve",        label: "Tension Curve",         kind: "tool", role: "director", stage: "shape",    provider: "anthropic", gate: null,                     visibility: "story_only",        endpoint: "/api/projects/[projectId]/tension-curve" },
  { id: "arc_heatmap",          label: "Arc Heat Map",          kind: "tool", role: "director", stage: "shape",    provider: "anthropic", gate: null,                     visibility: "story_only",        endpoint: "/api/projects/[projectId]/arc-heatmap" },
  { id: "villain_pov",          label: "Villain POV",           kind: "tool", role: "director", stage: "shape",    provider: "anthropic", gate: null,                     visibility: "story_only",        endpoint: "/api/projects/[projectId]/villain-pov" },
  { id: "series_plan",          label: "Series Plan",           kind: "tool", role: "director", stage: "discover", provider: "anthropic", gate: null,                     visibility: "story_only",        endpoint: "/api/ai/series-plan" },
  { id: "research_scaffold",    label: "Research Scaffold",     kind: "tool", role: "director", stage: "discover", provider: "anthropic", gate: null,                     visibility: "story_and_creator", endpoint: "/api/ai/research-scaffold" },
  { id: "generate_package",     label: "Production Package",    kind: "tool", role: "director", stage: "produce",  provider: "anthropic", gate: null,                     visibility: "story_only",        endpoint: "/api/projects/[projectId]/production/generate-package" },
  { id: "scene_to_video_prompt",label: "Scene → Video Prompt",  kind: "tool", role: "director", stage: "produce",  provider: "anthropic", gate: null,                     visibility: "story_only",        endpoint: "/api/ai/scene-to-video-prompt" },
  { id: "comic_generate",       label: "Comic Studio",          kind: "tool", role: "director", stage: "produce",  provider: "segmind",   gate: "comic_studio",           visibility: "story_only",        endpoint: "/api/projects/[projectId]/comics" },
  { id: "production_video",     label: "Scene Video",           kind: "tool", role: "writer",   stage: "produce",  provider: "segmind",   gate: null,                     visibility: "story_only",        endpoint: "/api/projects/[projectId]/production/scenes/[sceneNumber]/generate-video" },
  { id: "audio_generate",       label: "Audio Novel",           kind: "tool", role: "writer",   stage: "produce",  provider: "openai",    gate: "audio_novel",            visibility: "story_only",        endpoint: "/api/audio/generate" },
  { id: "trend_youtube",        label: "YouTube Trends",        kind: "tool", role: "director", stage: "discover", provider: "anthropic", gate: "creator_tools_advanced", visibility: "story_and_creator", endpoint: "/api/ai/trend-youtube" },
  { id: "trend_instagram",      label: "Instagram Trends",      kind: "tool", role: "director", stage: "discover", provider: "anthropic", gate: "creator_tools_advanced", visibility: "story_and_creator", endpoint: "/api/ai/trend-instagram" },
  { id: "trend_niche",          label: "Niche Trends",          kind: "tool", role: "director", stage: "discover", provider: "anthropic", gate: "creator_tools_advanced", visibility: "story_and_creator", endpoint: "/api/ai/trend-niche" },
  { id: "trend_angles",         label: "Trend Angles",          kind: "tool", role: "director", stage: "discover", provider: "anthropic", gate: null,                     visibility: "story_and_creator", endpoint: "/api/ai/trend-angles" },
  { id: "creator_research",     label: "Creator Research",      kind: "tool", role: "director", stage: "discover", provider: "anthropic", gate: "creator_tools_advanced", visibility: "story_and_creator", endpoint: "/api/ai/creator-research" },
  { id: "dissect_video",        label: "Video Dissection",      kind: "tool", role: "director", stage: "discover", provider: "internal",  gate: "creator_tools_advanced", visibility: "story_and_creator", endpoint: "/api/ai/dissect-video" },
  { id: "hook_ab",              label: "Hook A/B",              kind: "tool", role: "editor",   stage: "shape",    provider: "anthropic", gate: null,                     visibility: "story_and_creator", endpoint: "/api/ai/hook-ab" },
  { id: "score_hook",           label: "Hook Score",            kind: "tool", role: "editor",   stage: "shape",    provider: "anthropic", gate: null,                     visibility: "story_and_creator", endpoint: "/api/ai/score-hook" },
  { id: "retention_edit",       label: "Retention Edit",        kind: "tool", role: "editor",   stage: "produce",  provider: "anthropic", gate: "creator_tools_advanced", visibility: "story_and_creator", endpoint: "/api/ai/retention-edit" },
  { id: "virality_predict",     label: "Virality Predict",      kind: "tool", role: "editor",   stage: "produce",  provider: "anthropic", gate: "virality_predict",       visibility: "story_and_creator", endpoint: "/api/ai/virality-predict" },
];

export function getCapabilities(): Capability[] {
  const modeCaps = Object.entries(MODE_REGISTRY).map(([id, cfg]) => modeToCapability(id, cfg));
  return [...modeCaps, ...TOOL_REGISTRY];
}

export function getCapabilitiesByStage(stage: CapabilityStage): Capability[] {
  return getCapabilities().filter(c => c.stage === stage);
}

export function getCapabilitiesByRole(role: CapabilityRole): Capability[] {
  return getCapabilities().filter(c => c.role === role);
}
```

NOTE for the implementer: before finalizing, confirm each non-dynamic endpoint above resolves to a real `route.ts` (the drift-guard test enforces this). If a slug differs from the real route, fix the `endpoint` here — do not weaken the test. `story_health` is intentionally omitted from `TOOL_REGISTRY` for now because it is invoked from `StoryHealthPanel` via composed calls rather than one named route; it will be added in sub-project #2 when its surfaced action is defined.

- [ ] **Step 4: Run the tests + tsc**

Run: `npx vitest run src/lib/capabilities/__tests__/registry.test.ts && npx tsc --noEmit`
Expected: PASS (all) and tsc exit 0. If the drift guard reports a missing route, correct that capability's `endpoint` to the real path.

- [ ] **Step 5: Commit**

```bash
git add src/lib/capabilities/registry.ts src/lib/capabilities/__tests__/registry.test.ts
git commit -m "Add capability catalog (modes + standalone tools) with drift guard"
```

---

### Task 3: Availability + support envelope

**Files:**
- Modify: `src/lib/capabilities/registry.ts` (append availability + envelope)
- Test: `src/lib/capabilities/__tests__/availability.test.ts`

**Interfaces:**
- Consumes: `Capability`/`getCapabilities` (Task 2); `SubscriptionTier`/`canAccessFeature` from `@/lib/subscription` + `@/types/subscription`; `isCreatorFormat`/`isStoryFormat` from `@/lib/formats`.
- Produces:
  - `interface CapabilityContext { tier: SubscriptionTier; hasSegmindKey: boolean; hasOpenAIKey: boolean; format: string; }`
  - `interface CapabilityAvailability { available: boolean; reason?: "upgrade_required" | "missing_segmind_key" | "missing_openai_key" | "not_applicable_for_format"; }`
  - `isCapabilityAvailable(cap: Capability, ctx: CapabilityContext): CapabilityAvailability`
  - `interface SupportEnvelope { stages: Record<CapabilityStage, Record<CapabilityRole, Array<Capability & CapabilityAvailability>>>; }`
  - `supportEnvelope(ctx: CapabilityContext): SupportEnvelope`

- [ ] **Step 1: Write the failing availability tests**

Create `src/lib/capabilities/__tests__/availability.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isCapabilityAvailable, supportEnvelope, type Capability } from "../registry";

const base: Capability = {
  id: "x", label: "X", kind: "tool", role: "writer", stage: "write",
  provider: "anthropic", gate: null, visibility: "universal",
};
const ctx = { tier: "free" as const, hasSegmindKey: false, hasOpenAIKey: false, format: "Novel" };

describe("isCapabilityAvailable", () => {
  it("anthropic ungated universal cap is available to everyone", () => {
    expect(isCapabilityAvailable(base, ctx)).toEqual({ available: true });
  });

  it("gated cap is unavailable to a tier without access (upgrade_required)", () => {
    const cap = { ...base, gate: "comic_studio" as const };
    expect(isCapabilityAvailable(cap, ctx)).toEqual({ available: false, reason: "upgrade_required" });
  });

  it("gated cap is available to a tier with access", () => {
    const cap = { ...base, gate: "comic_studio" as const };
    expect(isCapabilityAvailable(cap, { ...ctx, tier: "all_access" })).toEqual({ available: true });
  });

  it("segmind cap needs a segmind key", () => {
    const cap = { ...base, provider: "segmind" as const };
    expect(isCapabilityAvailable(cap, ctx)).toEqual({ available: false, reason: "missing_segmind_key" });
    expect(isCapabilityAvailable(cap, { ...ctx, hasSegmindKey: true })).toEqual({ available: true });
  });

  it("openai cap needs an openai key", () => {
    const cap = { ...base, provider: "openai" as const };
    expect(isCapabilityAvailable(cap, ctx)).toEqual({ available: false, reason: "missing_openai_key" });
    expect(isCapabilityAvailable(cap, { ...ctx, hasOpenAIKey: true })).toEqual({ available: true });
  });

  it("story_only cap is not applicable on a creator format", () => {
    const cap = { ...base, visibility: "story_only" as const };
    expect(isCapabilityAvailable(cap, { ...ctx, format: "TikTok Script" })).toEqual({ available: false, reason: "not_applicable_for_format" });
  });

  it("format check precedes gate/provider checks", () => {
    const cap = { ...base, visibility: "story_only" as const, provider: "segmind" as const, gate: "comic_studio" as const };
    expect(isCapabilityAvailable(cap, { ...ctx, format: "TikTok Script" })).toEqual({ available: false, reason: "not_applicable_for_format" });
  });
});

describe("supportEnvelope", () => {
  it("groups every capability under stage → role with availability annotated", () => {
    const env = supportEnvelope(ctx);
    expect(Object.keys(env.stages).sort()).toEqual(["discover", "produce", "shape", "write"]);
    const writeWriters = env.stages.write.writer;
    expect(writeWriters.length).toBeGreaterThan(0);
    for (const c of writeWriters) expect(typeof c.available).toBe("boolean");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/capabilities/__tests__/availability.test.ts`
Expected: FAIL — `isCapabilityAvailable` / `supportEnvelope` not exported.

- [ ] **Step 3: Append the implementation to `registry.ts`**

Add to the bottom of `src/lib/capabilities/registry.ts`:

```ts
import type { SubscriptionTier } from "@/types/subscription";
import { canAccessFeature } from "@/lib/subscription";
import { isCreatorFormat, isStoryFormat } from "@/lib/formats";

export interface CapabilityContext {
  tier: SubscriptionTier;
  hasSegmindKey: boolean;
  hasOpenAIKey: boolean;
  format: string;
}

export interface CapabilityAvailability {
  available: boolean;
  reason?: "upgrade_required" | "missing_segmind_key" | "missing_openai_key" | "not_applicable_for_format";
}

export function isCapabilityAvailable(cap: Capability, ctx: CapabilityContext): CapabilityAvailability {
  // 1. Format applicability (checked first so an inapplicable tool never shows an upgrade/key nag).
  if (cap.visibility === "story_only" && isCreatorFormat(ctx.format))
    return { available: false, reason: "not_applicable_for_format" };
  // (No creator_only visibility exists today; story_and_creator + universal apply to both.)

  // 2. Tier gate.
  if (cap.gate && !canAccessFeature(ctx.tier, cap.gate))
    return { available: false, reason: "upgrade_required" };

  // 3. Provider key.
  if (cap.provider === "segmind" && !ctx.hasSegmindKey)
    return { available: false, reason: "missing_segmind_key" };
  if (cap.provider === "openai" && !ctx.hasOpenAIKey)
    return { available: false, reason: "missing_openai_key" };

  return { available: true };
}

export interface SupportEnvelope {
  stages: Record<CapabilityStage, Record<CapabilityRole, Array<Capability & CapabilityAvailability>>>;
}

const STAGES: CapabilityStage[] = ["discover", "shape", "write", "produce"];
const ROLES: CapabilityRole[] = ["director", "writer", "editor"];

export function supportEnvelope(ctx: CapabilityContext): SupportEnvelope {
  const stages = {} as SupportEnvelope["stages"];
  for (const stage of STAGES) {
    stages[stage] = {} as Record<CapabilityRole, Array<Capability & CapabilityAvailability>>;
    for (const role of ROLES) stages[stage][role] = [];
  }
  for (const cap of getCapabilities()) {
    const availability = isCapabilityAvailable(cap, ctx);
    stages[cap.stage][cap.role].push({ ...cap, ...availability });
  }
  return { stages };
}
```

Note: `isStoryFormat` is imported for symmetry/future creator-only caps; if `tsc` flags it as unused, drop it from the import — only `isCreatorFormat` is referenced today.

- [ ] **Step 4: Run the tests + tsc**

Run: `npx vitest run src/lib/capabilities/__tests__/availability.test.ts && npx tsc --noEmit`
Expected: PASS (all) and tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/capabilities/registry.ts src/lib/capabilities/__tests__/availability.test.ts
git commit -m "Add capability availability preflight + support envelope"
```

---

### Task 4: `GET /api/capabilities` endpoint

**Files:**
- Create: `src/app/api/capabilities/route.ts`
- Test: `src/app/api/capabilities/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `supportEnvelope`/`CapabilityContext` (Task 3); `getRequiredSession` (`@/lib/auth-helpers`); `getUserTier` (`@/lib/subscription`); `db` users query; `decrypt` (`@/lib/crypto`).
- Produces: `GET` returning `{ envelope: SupportEnvelope }`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/capabilities/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getRequiredSession = vi.fn();
vi.mock("@/lib/auth-helpers", () => ({ getRequiredSession: (...a: any[]) => getRequiredSession(...a) }));

const getUserTier = vi.fn();
vi.mock("@/lib/subscription", async (orig) => ({ ...(await orig() as any), getUserTier: (...a: any[]) => getUserTier(...a) }));

const findFirstUsers = vi.fn();
vi.mock("@/db", () => ({ db: { query: { users: { findFirst: (...a: any[]) => findFirstUsers(...a) } } } }));

const decrypt = vi.fn();
vi.mock("@/lib/crypto", () => ({ decrypt: (...a: any[]) => decrypt(...a) }));

import { GET } from "../route";

function req(url = "http://localhost/api/capabilities") { return new Request(url); }

describe("GET /api/capabilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequiredSession.mockResolvedValue({ user: { id: "u1" } });
    getUserTier.mockResolvedValue("free");
    findFirstUsers.mockResolvedValue({ segmindApiKey: "enc", openaiApiKey: "" });
    decrypt.mockImplementation((v: string) => (v === "enc" ? "SG_key" : ""));
  });

  it("returns a stage→role grouped envelope reflecting the user's tier and keys", async () => {
    const res = await GET(req("http://localhost/api/capabilities?format=Novel"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Object.keys(body.envelope.stages).sort()).toEqual(["discover", "produce", "shape", "write"]);
    // hasSegmindKey true (decrypt → SG_key), hasOpenAIKey false → a segmind cap is available, an openai cap is not.
    const produceWriters = body.envelope.stages.produce.writer;
    const audio = produceWriters.find((c: any) => c.id === "audio_generate");
    if (audio) expect(audio.available).toBe(false); // openai key missing
  });

  it("401s without a session", async () => {
    getRequiredSession.mockRejectedValue(new Error("unauthenticated"));
    await expect(GET(req())).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "src/app/api/capabilities/__tests__/route.test.ts"`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Implement the route**

Create `src/app/api/capabilities/route.ts`:

```ts
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { getUserTier } from "@/lib/subscription";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";
import { supportEnvelope } from "@/lib/capabilities/registry";

export async function GET(req: Request) {
  const s = await getRequiredSession();
  const tier = await getUserTier(s.user.id);
  const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
  const format = new URL(req.url).searchParams.get("format") ?? "Novel";

  const envelope = supportEnvelope({
    tier,
    hasSegmindKey: !!decrypt(user?.segmindApiKey ?? ""),
    hasOpenAIKey: !!decrypt(user?.openaiApiKey ?? ""),
    format,
  });

  return NextResponse.json({ envelope });
}
```

- [ ] **Step 4: Run the tests + tsc + full suite**

Run: `npx vitest run "src/app/api/capabilities/__tests__/route.test.ts" && npx tsc --noEmit`
Expected: PASS and tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/capabilities/route.ts" "src/app/api/capabilities/__tests__/route.test.ts"
git commit -m "Add GET /api/capabilities support-envelope endpoint"
```

---

### Final Task: Whole-sub-project verification

- [ ] Run the full suite: `npx vitest run` — expect all green, count up by the new test files.
- [ ] Run `npx tsc --noEmit` — exit 0.
- [ ] Confirm zero behavior change: no existing route, component, or test was modified except `MODE_REGISTRY` (additive fields only).
- [ ] Update `CLAUDE.md` Architecture section with a one-line entry: "Capability registry (`src/lib/capabilities/registry.ts`): single catalog of all modes + standalone tools tagged {stage, role, provider, gate}; `supportEnvelope()` powers preflight; exposed at `GET /api/capabilities`. Spine for the 4-stage funnel + AI-role split."
- [ ] Dispatch a final whole-sub-project code review before moving to sub-project #2 (funnel UX).
