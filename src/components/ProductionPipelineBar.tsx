"use client";
import type { ProductionPipeline } from "@/lib/production/pipelines";
import { computePipelineState, estimatePipelineCost, type PipelineContext, type StageStatus } from "@/lib/production/pipeline-state";

const STATUS_ICON: Record<StageStatus, string> = {
  done: "✓", ready: "●", blocked_gate: "🔒", blocked_deps: "⏳", blocked_key: "⚙️",
};
const STATUS_COLOR: Record<StageStatus, string> = {
  done: "#2d9e5e", ready: "#5b4ccc", blocked_gate: "#c9860a", blocked_deps: "#777", blocked_key: "#777",
};

interface Props {
  pipeline: ProductionPipeline;
  ctx: PipelineContext;
  itemCount: number;
  onRunStage: (stageId: string) => void;
}

export default function ProductionPipelineBar({ pipeline, ctx, itemCount, onRunStage }: Props) {
  const states = computePipelineState(pipeline, ctx);
  const cost = estimatePipelineCost(pipeline, itemCount);

  return (
    <div style={{ border: "1px solid #e2e0d8", borderRadius: 10, background: "#fff", padding: "12px 14px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#777", textTransform: "uppercase", letterSpacing: 1 }}>
          🎬 {pipeline.name} pipeline
        </span>
        {cost.usd > 0 && (
          <span style={{ fontSize: 11, color: "#777" }}>
            est. ~${cost.usd.toFixed(2)} · {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "stretch", gap: 6, flexWrap: "wrap" }}>
        {pipeline.stages.map((stage, i) => {
          const st = states[i];
          const color = STATUS_COLOR[st.status];
          const runnable = st.status === "ready" && !stage.checkpoint;
          return (
            <div key={stage.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                title={st.reason ?? stage.label}
                onClick={() => runnable && onRunStage(stage.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8,
                  border: `1px solid ${color}`,
                  background: st.status === "ready" ? `${color}12` : "transparent",
                  cursor: runnable ? "pointer" : "default",
                  opacity: st.status === "blocked_deps" ? 0.55 : 1,
                }}
              >
                <span style={{ color, fontSize: 12 }}>{STATUS_ICON[st.status]}</span>
                <span style={{ fontSize: 12, color: "#1a1a1a", fontWeight: st.status === "ready" ? 600 : 400 }}>{stage.label}</span>
                {stage.paid && <span style={{ fontSize: 9, color: "#c9860a" }}>$</span>}
              </div>
              {i < pipeline.stages.length - 1 && <span style={{ color: "#bbb", fontSize: 11 }}>→</span>}
            </div>
          );
        })}
      </div>

      {/* Surface the first blocking reason as a one-line nudge (esp. the QA gate). */}
      {(() => {
        const blocker = states.find(s => s.status === "blocked_gate") ?? states.find(s => s.status === "blocked_key");
        if (!blocker?.reason) return null;
        return (
          <div style={{ marginTop: 8, fontSize: 11, color: blocker.status === "blocked_gate" ? "#c9860a" : "#777" }}>
            {blocker.status === "blocked_gate" ? "🔒 " : "⚙️ "}{blocker.reason}.
          </div>
        );
      })()}
    </div>
  );
}
