# 4-Stage Funnel UX — Design Spec

**Status:** Approved design, pre-implementation
**Date:** 2026-06-29
**Sub-project:** #2 of the "4-stage funnel + AI Director/Writer/Editor" roadmap. Depends on #1 (capability registry — shipped).

## Context

WritingRoom currently presents a 5-stage ladder (Idea / Structure / Draft / Polish / Export) computed by `currentStage()` in `src/lib/guide/next-action.ts`, dispatched to `IdeaStageView` / editor / `StructureStageView` / `PolishStageView` / `ExportStageView`. The user wants a 4-stage funnel — **Discover → Shape → Write → Produce** — with the three AI roles (Director = plan, Writer = generate, Editor = review) made visible per stage.

Approved decisions:
- **Present 4, keep 5 internally.** The guide engine keeps its granular 5-stage "next action" logic; the UI presents 4 by merging Polish+Export into Produce. No guide-engine rewrite, no guide-test churn.
- **Role rows: surface + route to existing actions.** Role-grouped rows list each stage's capabilities (from the registry) and route to existing actions (modes via `onSelectMode`, tools via their existing panel/Actions drawer). Deep per-tool inline UI is incremental, not in this pass.

## Goals

1. WritingRoom shows a 4-pill funnel (Discover/Shape/Write/Produce) instead of 5.
2. Produce shows the existing Polish + Export views merged.
3. Each stage surfaces its capabilities grouped under Director/Writer/Editor, with availability, driven by the registry's `supportEnvelope`.
4. No regression to drafting, the guide engine, or any existing stage view.

## Non-goals

- Rewriting `next-action.ts` to 4 stages (explicitly deferred).
- Bespoke inline execution UI for every capability (incremental).
- New persisted artifacts (those are sub-projects #3/#4).
- Changing how any capability actually executes.

## Architecture

### A. Funnel taxonomy + bridge — `src/lib/guide/funnel.ts` (new)

```ts
import type { GuideStage } from "./next-action";
import type { CapabilityStage } from "@/lib/capabilities/types";

export type FunnelStage = CapabilityStage; // "discover" | "shape" | "write" | "produce"
export const FUNNEL_ORDER: readonly FunnelStage[] = ["discover", "shape", "write", "produce"];

export const FUNNEL_LABELS: Record<FunnelStage, string> =
  { discover: "Discover", shape: "Shape", write: "Write", produce: "Produce" };
export const CREATOR_FUNNEL_LABELS: Record<FunnelStage, string> =
  { discover: "Research", shape: "Hooks", write: "Script", produce: "Publish" };

// 5 internal guide stages → 4 funnel stages.
export function guideStageToFunnel(stage: GuideStage): FunnelStage {
  switch (stage) {
    case "idea": return "discover";
    case "structure": return "shape";
    case "draft": return "write";
    case "polish": return "produce";
    case "export": return "produce";
  }
}

// Funnel pill click → the representative guide stage to set as manualStage.
// Produce enters at "polish" (its first sub-view); the Produce body shows polish+export together.
export function funnelStageToGuide(stage: FunnelStage): GuideStage {
  switch (stage) {
    case "discover": return "idea";
    case "shape": return "structure";
    case "write": return "draft";
    case "produce": return "polish";
  }
}
```

Pure functions, fully unit-testable. `next-action.ts` is unchanged.

### B. WritingRoom pill reframe — `src/components/WritingRoom.tsx`

- Replace the `STAGE_ORDER.map(...)` pill row (currently 5) with `FUNNEL_ORDER.map(...)` (4). Labels from `FUNNEL_LABELS` / `CREATOR_FUNNEL_LABELS` (creator formats).
- Active funnel pill: `const funnelStage = guideStageToFunnel(stage);` highlight by index in `FUNNEL_ORDER`.
- Pill click: `goToStage(funnelStageToGuide(clickedFunnelStage))` (sets `manualStage` to the representative guide stage; existing `goToStage` logic reused).
- The existing `stage`-based body dispatch (`stage === "idea" ? <IdeaStageView/> : ...`) is unchanged EXCEPT the Produce merge (next section). Because `funnelStageToGuide("produce")` returns `polish`, the existing `stage === "polish"` branch fires for Produce — extended to also render Export.

### C. Produce stage view (merge) — `src/components/WritingRoom.tsx`

Replace the two separate branches:

```tsx
) : stage === "polish" ? (
  <PolishStageView .../>
) : stage === "export" ? (
  <ExportStageView .../>
) : null}
```

with a single Produce branch that renders both stacked when the funnel stage is produce:

```tsx
) : guideStageToFunnel(stage) === "produce" ? (
  <div style={{ flex: 1, overflow: "auto" }}>
    <PolishStageView .../>
    <ExportStageView .../>
  </div>
) : null}
```

(Both `polish` and `export` guide stages now resolve to the same Produce body, so a user the guide auto-advanced to `export` still sees Polish + Export together.)

### D. Role-grouped tool rows — `src/components/StageRoleRail.tsx` (new)

A presentational component rendered at the top of each stage body (Discover/Shape/Produce — not Write, which is the editor) showing the stage's capabilities grouped by role.

```ts
interface StageRoleRailProps {
  funnelStage: FunnelStage;
  format: string;                       // project.format (for the capabilities fetch)
  onSelectMode: (mode: GenerationMode) => void;
  onOpenActions: () => void;
  onOpenComicStudio: () => void;
  onOpenProductionStudio: () => void;
  onUpgradeRequired: (feature: string) => void;
}
```

Behavior:
- On mount (and when `format` changes), `fetch('/api/capabilities?format=' + encodeURIComponent(format))` → `envelope`. While loading, render nothing (the stage views already provide content).
- Render `envelope.stages[funnelStage]` as three rows: **📋 Plan** (director), **✍️ Generate** (writer), **🔎 Review** (editor). Skip a row if it has no capabilities for this stage.
- Each capability is a small button (reuse `sBtnSm`):
  - `available === false`: muted style; `title` = the reason; click → `reason === "upgrade_required"` calls `onUpgradeRequired(cap.gate!)`, `missing_segmind_key`/`missing_openai_key` → `toast` hint to add the key in Settings.
  - `available === true`:
    - `kind === "mode"` → `onSelectMode(cap.id as GenerationMode)`.
    - `kind === "tool"` and `cap.id === "comic_generate"` → `onOpenComicStudio()`.
    - `kind === "tool"` and `cap.id === "generate_package" | "scene_to_video_prompt" | "production_video"` → `onOpenProductionStudio()`.
    - any other `kind === "tool"` → `onOpenActions()` (opens the Actions drawer where the tool lives).
- The rail is wrapped in a small bordered container with a one-line caption: "What you can do in {StageLabel}".

This is the visible Director/Writer/Editor split.

### E. Wiring `StageRoleRail` into the stage bodies

In WritingRoom, render `<StageRoleRail funnelStage={guideStageToFunnel(stage)} .../>` immediately above the Discover (`IdeaStageView`), Shape (`StructureStageView`), and Produce bodies. Not in Write (the editor stays clean). Pass the existing `onSelectMode`, `onOpenActions`, `onOpenComicStudio`, `onOpenProductionStudio`, `onUpgradeRequired` props (all already in WritingRoom).

## Data flow

```
GET /api/capabilities?format=… ─► supportEnvelope ─► StageRoleRail
   (registry, sub-project #1)         stages[funnelStage][role][]   ─► three role rows
guideStageToFunnel(currentStage) ─► active funnel pill + which stage body + which envelope slice
```

## Error handling

- `StageRoleRail` fetch failure → render nothing (stage views still work). No throw, no blocking.
- `funnelStageToGuide`/`guideStageToFunnel` are total over their input unions (exhaustive switch) — tsc enforces completeness.
- Unknown/creator formats simply yield a different (smaller) capability set from the envelope — no error.

## Testing

1. **Funnel mapping** (`src/lib/guide/__tests__/funnel.test.ts`): `guideStageToFunnel` covers all 5 guide stages → correct funnel stage; `funnelStageToGuide` round-trips to a guide stage whose funnel is the original; `FUNNEL_ORDER` has the 4 stages in order.
2. **StageRoleRail** (`src/components/__tests__/StageRoleRail.test.tsx`, if jsdom available; else a logic-only test of the action-routing function): given a mocked envelope, renders the right role rows for a stage; an unavailable gated cap calls `onUpgradeRequired`; a mode cap calls `onSelectMode`; the comic tool calls `onOpenComicStudio`. NOTE: the repo has no jsdom/RTL; extract the click-routing into a pure `capabilityAction(cap): {type,...}` helper and unit-test that instead of rendering.
3. **Reachability guard:** extend `live-shell-reachability.test.ts` `MUST_BE_REACHABLE` with `StageRoleRail`, and add `WritingRoom.tsx` already covers funnel imports.
4. Full suite + `tsc --noEmit` green; no existing stage-view or guide test modified.

## Files

- Create: `src/lib/guide/funnel.ts` + `src/lib/guide/__tests__/funnel.test.ts`
- Create: `src/components/StageRoleRail.tsx` + a pure `capabilityAction` helper (in the same file or `src/lib/capabilities/actions.ts`) + its test
- Modify: `src/components/WritingRoom.tsx` (pills → 4, Produce merge, mount StageRoleRail)
- Modify: `src/components/__tests__/live-shell-reachability.test.ts` (add StageRoleRail)

## Success criteria

- WritingRoom shows 4 funnel pills; Produce shows Polish + Export together.
- Each non-Write stage shows Director/Writer/Editor rows of its capabilities with correct availability, routing to existing actions.
- Drafting, the guide engine, and all existing stage views unchanged in behavior.
- `tsc` clean; full suite green.
