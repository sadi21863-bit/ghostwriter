import type { ProductionPipeline, ProductionStage } from "./pipelines";

export interface PipelineContext {
  hasShots: boolean;          // a production package / shot list exists
  hasGeneratedMedia: boolean; // at least one stitched scene / comic page exists
  chaptersApproved: boolean;  // chapterApprovalSummary(...).allApproved — the Editor gate
  hasSegmindKey: boolean;
  blobConfigured: boolean;
}

export type StageStatus = "done" | "ready" | "blocked_gate" | "blocked_deps" | "blocked_key";

export interface StageState {
  id: string;
  status: StageStatus;
  reason?: string;
}

// Pure: computes each stage's status. Never executes. The UI maps `ready` stages
// to existing route calls and renders `blocked_*` with the reason. The paid stage
// is hard-blocked (`blocked_gate`) until the preceding Editor checkpoint passes —
// the QA-before-spend gate.
export function computePipelineState(pipeline: ProductionPipeline, ctx: PipelineContext): StageState[] {
  // Does a checkpoint precede this stage in the pipeline?
  const checkpointBefore = (idx: number) => pipeline.stages.slice(0, idx).some(s => s.checkpoint);

  return pipeline.stages.map((stage, idx): StageState => {
    if (stage.checkpoint) return reviewState(ctx);
    if (stage.paid) return paidState(stage, ctx, checkpointBefore(idx));
    return plainState(stage, ctx);
  });
}

function reviewState(ctx: PipelineContext): StageState {
  if (ctx.chaptersApproved) return { id: "review", status: "done" };
  if (ctx.hasShots) return { id: "review", status: "ready", reason: "Approve chapters in the Editor panel" };
  return { id: "review", status: "blocked_deps", reason: "Plan the shots first" };
}

function paidState(stage: ProductionStage, ctx: PipelineContext, gated: boolean): StageState {
  if (!ctx.hasShots) return { id: stage.id, status: "blocked_deps", reason: "Plan the shots first" };
  // The hard QA-before-spend gate: a paid stage behind a checkpoint cannot run
  // until chapters are Editor-approved — checked BEFORE keys so the user fixes
  // approval first, not a key nag on work they shouldn't spend on yet.
  if (gated && !ctx.chaptersApproved)
    return { id: stage.id, status: "blocked_gate", reason: "Chapters must be Editor-approved before generating" };
  if (!ctx.hasSegmindKey || !ctx.blobConfigured)
    return { id: stage.id, status: "blocked_key", reason: "Add your Segmind API key in Settings" };
  if (ctx.hasGeneratedMedia) return { id: stage.id, status: "done" };
  return { id: stage.id, status: "ready" };
}

// Non-paid downstream stages (package/letter/export) need generated media first.
// "plan" is the exception: it's the entry stage and only needs shots to be "done".
function plainState(stage: ProductionStage, ctx: PipelineContext): StageState {
  if (stage.id === "plan") return { id: stage.id, status: ctx.hasShots ? "done" : "ready" };
  if (ctx.hasGeneratedMedia) return { id: stage.id, status: "ready" };
  return { id: stage.id, status: "blocked_deps", reason: "Generate the media first" };
}

// ─── Cost preflight (rough, documented-approximate constants) ───────────────
const PAID_UNIT_USD: Record<string, number> = {
  production_video: 0.10, // per shot, Seedance 2.0 ballpark
  comic_generate:   0.04, // per panel
};

export interface CostEstimate {
  usd: number;
  breakdown: { stageId: string; capabilityId: string; items: number; perItem: number }[];
}

export function estimatePipelineCost(pipeline: ProductionPipeline, itemCount: number): CostEstimate {
  const breakdown = pipeline.stages
    .filter(s => s.paid && s.capabilityId)
    .map(s => {
      const perItem = PAID_UNIT_USD[s.capabilityId!] ?? 0.05;
      return { stageId: s.id, capabilityId: s.capabilityId!, items: itemCount, perItem };
    });
  const usd = breakdown.reduce((sum, b) => sum + b.items * b.perItem, 0);
  return { usd, breakdown };
}
