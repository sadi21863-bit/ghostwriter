# Production-as-Pipeline — Design Spec

**Status:** Approved design, pre-implementation
**Date:** 2026-06-29
**Sub-project:** #5 of the funnel roadmap (the last core one). Depends on #1 (registry), #4 (approve-gate). See `MASTER-PLAN-2026-06-29.md`.

## Context

The Produce/media side is bespoke: `ProductionStudio` runs shot-list → preview → animate/video → stitch as loose buttons with no pipeline model, no QA gate, and no cost preflight — unlike the existing **text** pipeline-as-data (`PIPELINES` + `/api/ai/pipeline`). Research (OpenMontage pipeline-defs: sequential stages + per-stage tools + human-approval checkpoints + "estimate before execution"; video-use/CINE-LOCK: QA-before-spend) converges on: make Produce a **declarative pipeline** whose paid stages are gated by the Editor approve-gate (#4), with a cost estimate shown first.

Approved scope: **declarative pipeline defs + a pure gate engine + cost estimate + a thin status bar** in ProductionStudio that drives the *existing* routes. No new generation plumbing; no self-eval loop (deferred); no tool-scoring selection (deferred).

## Goals

1. Declarative `ProductionPipeline` definitions (media analog of `PIPELINES`).
2. A pure, fully-tested `computePipelineState` gate engine: each stage → status, with **paid stages hard-blocked until the Editor checkpoint passes** (QA-before-spend).
3. A rough `estimatePipelineCost` preflight.
4. A `ProductionPipelineBar` in ProductionStudio showing stage status + gate + cost, driving existing actions.

## Non-goals

- The video-use render→inspect→auto-fix self-eval loop (deferred; needs real-money validation).
- OpenMontage 7-dimension tool-scoring selection / fallback chains (deferred).
- Rewriting any generation route — stages call the existing routes.
- Budget caps / per-action spend thresholds (deferred).

## Architecture

### A. `src/lib/production/pipelines.ts` (pure data)

```ts
export type ProductionStageRole = "director" | "writer" | "editor";
export type ProductionOutput = "trailer" | "comic" | "animatic" | "audio";

export interface ProductionStage {
  id: string;                 // "plan" | "review" | "generate" | "package" | "letter" | "export"
  label: string;
  role: ProductionStageRole;
  capabilityId?: string;      // links to the capability registry (sub-project #1)
  checkpoint?: boolean;       // requires Editor approval before the NEXT paid stage runs
  paid?: boolean;             // spends real money (preflight + gate apply)
}

export interface ProductionPipeline {
  id: string;
  name: string;
  output: ProductionOutput;
  formats: string[];
  stages: ProductionStage[];
}

export const PRODUCTION_PIPELINES: ProductionPipeline[] = [
  {
    id: "book_trailer", name: "Book Trailer", output: "trailer",
    formats: ["Novel", "Screenplay", "Web Series"],
    stages: [
      { id: "plan",     label: "Plan shots",        role: "director", capabilityId: "generate_package" },
      { id: "review",   label: "Editor review",     role: "editor",   capabilityId: "editor_review", checkpoint: true },
      { id: "generate", label: "Generate + stitch", role: "writer",   capabilityId: "production_video", paid: true },
      { id: "package",  label: "Package",           role: "director" },
    ],
  },
  {
    id: "comic_page", name: "Comic Page", output: "comic",
    formats: ["Novel", "Screenplay", "Web Series"],
    stages: [
      { id: "plan",     label: "Plan panels",   role: "director", capabilityId: "generate_package" },
      { id: "review",   label: "Editor review", role: "editor",   capabilityId: "editor_review", checkpoint: true },
      { id: "generate", label: "Generate art",  role: "director", capabilityId: "comic_generate", paid: true },
      { id: "letter",   label: "Letter",        role: "editor" },
      { id: "export",   label: "Export",        role: "director" },
    ],
  },
];

export const getProductionPipelines = (format: string): ProductionPipeline[] =>
  PRODUCTION_PIPELINES.filter(p => p.formats.includes(format));
```

### B. `src/lib/production/pipeline-state.ts` (pure gate engine)

```ts
export interface PipelineContext {
  hasShots: boolean;          // a production package/shot list exists
  hasGeneratedMedia: boolean; // at least one stitched scene / comic page exists
  chaptersApproved: boolean;  // chapterApprovalSummary(...).allApproved
  hasSegmindKey: boolean;
  blobConfigured: boolean;
}
export type StageStatus = "done" | "ready" | "blocked_gate" | "blocked_deps" | "blocked_key";
export interface StageState { id: string; status: StageStatus; reason?: string; }

export function computePipelineState(pipeline: ProductionPipeline, ctx: PipelineContext): StageState[];
```

Rules (per stage, in order):
- **plan**: `done` if `hasShots`, else `ready`.
- **review** (checkpoint): `done` if `chaptersApproved`; `ready` if `hasShots`; else `blocked_deps` (plan first).
- **paid stage** (`generate`): `blocked_deps` if no shots; `blocked_gate` if the preceding checkpoint isn't satisfied (`!chaptersApproved`) — this is the **hard QA-before-spend gate**; `blocked_key` if `!hasSegmindKey || !blobConfigured`; `done` if `hasGeneratedMedia`; else `ready`.
- **later stages** (package/letter/export): `ready` once `hasGeneratedMedia`, else `blocked_deps`.

The engine never executes — it only computes status; the UI maps `ready` stages to existing route calls and renders `blocked_*` with the reason. Pure → unit-tested across the matrix.

### C. `estimatePipelineCost(pipeline, ctx, shotCount)` (pure)

Rough USD estimate for the paid stages only (e.g. `production_video` ≈ shotCount × $0.10; `comic_generate` ≈ panelCount × $0.04 — constants documented as approximate, surfaced as "~$X, N items"). Returns `{ usd: number, breakdown: {stageId, items, perItem}[] }`. Reuses `isCapabilityAvailable` upstream for hard key/tier gating; this is the *estimate*, not the gate.

### D. `ProductionPipelineBar` — `src/components/ProductionPipelineBar.tsx`

Props: `{ project, pipeline, ctx, shotCount, onRunStage(stageId) }`. Renders the stages as a horizontal stepper with status chips (✓ done · ● ready · 🔒 blocked_gate "Approve chapters in the Editor panel first" · ⏳ blocked_deps · ⚙️ blocked_key "Add Segmind key"), a one-line cost estimate before the paid stage, and a run button on the `ready` stage that calls the existing ProductionStudio handler via `onRunStage`. Mounted near the top of `ProductionStudio`. Thin — all logic is in the pure engine.

## Data flow

```
ProductionStudio state (shots, scenes, keys) + chapterApprovalSummary
   └─► PipelineContext ─► computePipelineState(pipeline) ─► StageState[] ─► ProductionPipelineBar
                          estimatePipelineCost ─► cost line
   paid stage runs ONLY when status === "ready" (gate satisfied) ─► existing generate routes
```

## Error handling

- Engine is pure/total — cannot throw; unknown stage ids just pass through with computed status.
- The bar reflects `blocked_*` states read-only; it cannot trigger a paid stage that isn't `ready` (the run button only renders on `ready`).
- Soft vs hard: the ExportStageView banner (#4) stays the soft nudge; the pipeline `generate` stage is the **hard** gate (button hidden/disabled until approved). Both reference the same `chapterApprovalSummary`.

## Testing

1. **pipeline-state** (`__tests__/pipeline-state.test.ts`): matrix over ctx — paid stage is `blocked_gate` when `!chaptersApproved`, `blocked_key` when key/blob missing (but only after the gate passes — gate precedence), `ready` when approved+keyed+shots, `done` when media exists; review checkpoint `done` only when approved; plan/package deps.
2. **pipelines data** test: every `capabilityId` referenced exists in `getCapabilities()` (drift guard — ties #5 to the registry); every pipeline has ≥1 paid stage preceded by a checkpoint.
3. **estimateCost** test: sums paid stages, ignores unpaid.
4. **Reachability**: add `ProductionPipelineBar` to MUST_BE_REACHABLE.
5. Full suite + `tsc` green; no existing route/behavior changed (additive lib + one component + a mount).

## Files

- Create: `src/lib/production/pipelines.ts`, `src/lib/production/pipeline-state.ts` (+ cost) + `__tests__/`
- Create: `src/components/ProductionPipelineBar.tsx`
- Modify: `src/components/ProductionStudio.tsx` (compute ctx, mount the bar, wire `onRunStage` to existing handlers), reachability test

## Success criteria

- ProductionStudio shows explicit pipeline stages with status + gate + cost.
- A paid generate stage is **hard-blocked** until chapters are Editor-approved (QA-before-spend) — the gate #4 set up is now enforced on the media side.
- Pipeline `capabilityId`s are validated against the registry (drift guard).
- `tsc` clean; full suite green.
