"use client";
import { useState } from "react";
import { isCreatorFormat } from "@/lib/formats";
import { co, sBtnSm } from "@/lib/styles";

interface Props {
  format: string;
  mode: string;
  content: string;
  setSavedMsg: (m: string) => void;
  updateProject: (fn: any) => void;
  onUpgradeRequired?: (feature: string) => void;
}

const MECHANIC_LABELS: Record<string, string> = {
  hookStrength:              "Hook Strength",
  openLoopDensity:           "Open Loop Density",
  patternInterruptFrequency: "Pattern Interrupt",
  payoffArchitecture:        "Payoff Architecture",
};

const MECHANIC_COLORS: Record<string, string> = {
  HOOK_STRENGTH:    "#3b82f6",
  OPEN_LOOP:        "#8b5cf6",
  PATTERN_INTERRUPT:"#f59e0b",
  PAYOFF:           "#10b981",
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 7 ? "#10b981" : score >= 5 ? "#d97706" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: co.surfaceAlt, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${score * 10}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color, minWidth: 32 }}>{score}/10</span>
    </div>
  );
}

export function RetentionEditPanel({ format, mode, content, setSavedMsg, updateProject, onUpgradeRequired }: Props) {
  const [retentionEdit, setRetentionEdit] = useState<any>(null);
  const [retentionLoading, setRetentionLoading] = useState(false);

  if (mode !== "write" || !isCreatorFormat(format) || !content?.trim()) return null;

  const run = async () => {
    if (!content?.trim() || retentionLoading) return;
    setRetentionLoading(true);
    setRetentionEdit(null);
    try {
      const res = await fetch("/api/ai/retention-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: content, format }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { onUpgradeRequired?.(data.feature); }
      else if (data.edit) setRetentionEdit(data.edit);
    } catch { /* silent */ }
    setRetentionLoading(false);
  };

  return (
    <>
      <button
        style={{ ...sBtnSm, background: "#fef3c7", color: "#d97706", fontWeight: 600, opacity: retentionLoading ? 0.5 : 1 }}
        disabled={retentionLoading}
        onClick={run}
      >
        {retentionLoading ? "Analyzing..." : "📊 Watch-Time"}
      </button>

      {retentionEdit && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setRetentionEdit(null)}>
          <div style={{ background: co.surface, borderRadius: 16, padding: 24, width: 640, maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid " + co.border }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📊 Watch-Time Analysis</h3>
              <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 18 }} onClick={() => setRetentionEdit(null)}>×</button>
            </div>

            {retentionEdit.scores && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase" }}>4-Mechanic Scores</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: retentionEdit.scores.overall >= 7 ? "#10b981" : retentionEdit.scores.overall >= 5 ? "#d97706" : "#ef4444" }}>
                    Overall: {retentionEdit.scores.overall}/10
                  </div>
                </div>
                {Object.entries(MECHANIC_LABELS).map(([key, label]) => {
                  const s = retentionEdit.scores[key];
                  if (!s) return null;
                  return (
                    <div key={key} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
                      </div>
                      <ScoreBar score={s.score} />
                      <div style={{ fontSize: 11, color: co.muted, marginTop: 4 }}>{s.reasoning}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {retentionEdit.topPriority && (
              <div style={{ marginBottom: 14, padding: "10px 14px", background: "#fffbeb", borderRadius: 8, border: "1px solid #fbbf24" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", textTransform: "uppercase", marginBottom: 4 }}>Top Priority</div>
                <div style={{ fontSize: 13, color: "#78350f", fontWeight: 600 }}>{retentionEdit.topPriority}</div>
              </div>
            )}

            {retentionEdit.strongPoints?.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginBottom: 6 }}>What's Working</div>
                {retentionEdit.strongPoints.map((p: string, i: number) => (
                  <div key={i} style={{ fontSize: 12, color: co.text, background: "#f0fdf4", borderRadius: 6, padding: "6px 10px", marginBottom: 4 }}>✓ {p}</div>
                ))}
              </div>
            )}

            {retentionEdit.dropRiskMoments?.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: co.danger, textTransform: "uppercase", marginBottom: 6 }}>Drop-Risk Moments</div>
                {retentionEdit.dropRiskMoments.map((m: any, i: number) => (
                  <div key={i} style={{ background: co.surfaceAlt, borderRadius: 8, padding: 12, marginBottom: 8, borderLeft: `3px solid ${MECHANIC_COLORS[m.mechanic] ?? co.danger}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: MECHANIC_COLORS[m.mechanic] ?? co.accent, textTransform: "uppercase" }}>{m.mechanic?.replace(/_/g, " ")}</span>
                      <span style={{ fontSize: 11, color: co.muted, fontStyle: "italic" }}>"{m.location}"</span>
                    </div>
                    <div style={{ fontSize: 12, color: co.text, marginBottom: 4 }}><strong>Risk:</strong> {m.risk}</div>
                    <div style={{ fontSize: 12, color: co.accent }}><strong>Fix:</strong> {m.fix}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button style={sBtnSm} onClick={() => setRetentionEdit(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
