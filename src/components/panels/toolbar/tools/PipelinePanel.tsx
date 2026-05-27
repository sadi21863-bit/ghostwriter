"use client";
import { getPipelines, AGENT_LABELS, type Pipeline, type AgentKey } from "@/lib/ai/pipelines";
import { co, sBtn, sBtnSm } from "@/lib/styles";

interface Props {
  show: boolean;
  pipelineRunning: boolean;
  pipelineResults: { agent: string; output: string }[];
  setPipelineResults: (v: any) => void;
  expandedAgent: string | null;
  setExpandedAgent: (v: string | null) => void;
  activePipelineId: string | null;
  runPipeline: (p: Pipeline) => Promise<void>;
  usePipelineOutput: (output: string) => void;
  prompt: string;
  format: string;
  mode: string;
}

export function PipelinePanel({
  show, pipelineRunning, pipelineResults, setPipelineResults,
  expandedAgent, setExpandedAgent, activePipelineId,
  runPipeline, usePipelineOutput, prompt, format, mode,
}: Props) {
  if (!show) return null;

  return (
    <div style={{ borderBottom: "1px solid " + co.border, background: co.surfaceAlt, padding: "12px 16px", maxHeight: 420, overflowY: "auto" }}>
      {pipelineResults.length === 0 ? (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, marginBottom: 10, textTransform: "uppercase" }}>
            Agent Pipelines — {format} / {mode}
          </div>
          {getPipelines(format, mode).length === 0
            ? <div style={{ fontSize: 12, color: co.muted }}>No pipelines available for this format + mode combination.</div>
            : getPipelines(format, mode).map((pipeline: Pipeline) => (
              <div key={pipeline.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: co.surface, borderRadius: 10, marginBottom: 8, border: "1px solid " + co.border }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{pipeline.name}</div>
                  <div style={{ fontSize: 11, color: co.muted, marginTop: 2 }}>{pipeline.description}</div>
                  <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                    {pipeline.agents.map((a: AgentKey) => (
                      <span key={a} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: co.accentBg, color: co.accent, fontWeight: 600 }}>
                        {AGENT_LABELS[a]}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  style={{ ...sBtn, opacity: pipelineRunning || !prompt.trim() ? 0.5 : 1 }}
                  disabled={pipelineRunning || !prompt.trim()}
                  onClick={() => runPipeline(pipeline)}
                >
                  {pipelineRunning && activePipelineId === pipeline.id ? "Running..." : "Run ▶"}
                </button>
              </div>
            ))
          }
          {!prompt.trim() && (
            <div style={{ fontSize: 11, color: co.muted, marginTop: 8 }}>
              Type a prompt below first, then run a pipeline.
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: co.accent, textTransform: "uppercase" }}>Pipeline Results</div>
            <button style={sBtnSm} onClick={() => { setPipelineResults([]); setExpandedAgent(null); }}>← Back</button>
          </div>
          {pipelineResults.map((r, i) => (
            <div key={r.agent} style={{ marginBottom: 8, border: "1px solid " + co.border, borderRadius: 10, overflow: "hidden" }}>
              <div
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: co.surface, cursor: "pointer" }}
                onClick={() => setExpandedAgent(expandedAgent === r.agent ? null : r.agent)}
              >
                <span style={{ fontSize: 12, fontWeight: 700, flex: 1 }}>
                  {AGENT_LABELS[r.agent as keyof typeof AGENT_LABELS] ?? r.agent}
                </span>
                <span style={{ fontSize: 10, color: co.muted }}>{expandedAgent === r.agent ? "▲" : "▼"}</span>
              </div>
              {expandedAgent === r.agent && (
                <div style={{ padding: 12, background: co.surfaceAlt }}>
                  <div style={{ fontSize: 13, lineHeight: 1.7, fontFamily: "Georgia,serif", whiteSpace: "pre-wrap", marginBottom: 10 }}>
                    {r.output}
                  </div>
                  {i === pipelineResults.length - 1 && (
                    <button style={sBtn} onClick={() => usePipelineOutput(r.output)}>Use Final Output</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
