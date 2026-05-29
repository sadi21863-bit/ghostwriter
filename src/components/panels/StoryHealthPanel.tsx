"use client";
import { useState } from "react";
import { TensionCurve } from "@/components/TensionCurve";

const SCENE_PURPOSES = [
  { id: "plot-advance", label: "Plot Advance" },
  { id: "character-reveal", label: "Character Reveal" },
  { id: "relationship-shift", label: "Relationship Shift" },
  { id: "world-reveal", label: "World Reveal" },
  { id: "thematic-beat", label: "Thematic Beat" },
  { id: "tension-escalation", label: "Tension Escalation" },
  { id: "emotional-payoff", label: "Emotional Payoff" },
];

const VERDICT_COLORS: Record<string, string> = {
  passes: "#22c55e",
  "needs-work": "#f59e0b",
  rewrite: "#ef4444",
};

const SCENE_VERDICT_COLORS: Record<string, string> = {
  alive: "#22c55e",
  thin: "#f59e0b",
  dead: "#ef4444",
};

interface StoryHealthPanelProps {
  projectId: string;
  activeChapContent: string;
  onClose: () => void;
}

export function StoryHealthPanel({ projectId, activeChapContent, onClose }: StoryHealthPanelProps) {
  const [tab, setTab] = useState<"validator" | "dead-scenes" | "theme" | "tension">("validator");

  // Scene Validator state
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>([]);
  const [validating, setValidating] = useState(false);
  const [validatorResult, setValidatorResult] = useState<any>(null);
  const [validatorError, setValidatorError] = useState("");

  // Dead Scenes state
  const [scanning, setScanning] = useState(false);
  const [deadScenesResult, setDeadScenesResult] = useState<any>(null);
  const [deadScenesError, setDeadScenesError] = useState("");
  const [expandedScene, setExpandedScene] = useState<string | null>(null);

  // Theme Tracker state
  const [controllingIdea, setControllingIdea] = useState("");
  const [analysingTheme, setAnalysingTheme] = useState(false);
  const [themeResult, setThemeResult] = useState<any>(null);
  const [themeError, setThemeError] = useState("");

  const togglePurpose = (id: string) => {
    setSelectedPurposes(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const runValidator = async () => {
    if (!activeChapContent?.trim()) { setValidatorError("Open a chapter with content first."); return; }
    if (selectedPurposes.length === 0) { setValidatorError("Select at least one purpose."); return; }
    setValidating(true); setValidatorError(""); setValidatorResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/scene-validator`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneContent: activeChapContent, declaredPurposes: selectedPurposes }),
      });
      const data = await res.json();
      if (data.error) { setValidatorError(data.error); } else { setValidatorResult(data); }
    } catch { setValidatorError("Validation failed. Try again."); }
    setValidating(false);
  };

  const runDeadScenes = async () => {
    setScanning(true); setDeadScenesError(""); setDeadScenesResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/dead-scenes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) { setDeadScenesError(data.error); } else { setDeadScenesResult(data); }
    } catch { setDeadScenesError("Scan failed. Try again."); }
    setScanning(false);
  };

  const runTheme = async () => {
    if (!controllingIdea.trim()) { setThemeError("Enter your Controlling Idea first."); return; }
    setAnalysingTheme(true); setThemeError(""); setThemeResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/theme-tracker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controllingIdea }),
      });
      const data = await res.json();
      if (data.error) { setThemeError(data.error); } else { setThemeResult(data); }
    } catch { setThemeError("Analysis failed. Try again."); }
    setAnalysingTheme(false);
  };

  const tabStyle = (active: boolean) => ({
    padding: "8px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 400,
    background: active ? "#2a2a30" : "transparent",
    color: active ? "#F2F2F3" : "#9898A6",
  });

  const btnStyle = (disabled: boolean, color = "#D97706") => ({
    padding: "9px 18px", borderRadius: 8, border: "none", cursor: disabled ? "not-allowed" : "pointer",
    background: disabled ? "#333" : color, color: "#fff", fontSize: 13, fontWeight: 500,
  });

  const errorBox = (msg: string) => msg ? (
    <div style={{ padding: "10px 14px", background: "#2a1010", borderRadius: 8, color: "#f87171", fontSize: 13, marginBottom: 12 }}>{msg}</div>
  ) : null;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1200,
    }}>
      <div style={{
        background: "#18181B", borderRadius: 14, width: 720, maxHeight: "88vh",
        display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 0" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#F2F2F3" }}>Story Health</div>
            <div style={{ fontSize: 12, color: "#9898A6", marginTop: 2 }}>Structure analysis & tension visualisation</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#9898A6", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, padding: "14px 20px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {([
            { id: "validator", label: "Scene Validator" },
            { id: "dead-scenes", label: "Dead Scenes" },
            { id: "theme", label: "Theme Tracker" },
            { id: "tension", label: "Tension Curve" },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={tabStyle(tab === t.id)}>{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>

          {/* ── Scene Validator ── */}
          {tab === "validator" && (
            <div>
              <p style={{ fontSize: 13, color: "#9898A6", margin: "0 0 14px" }}>
                Declare 2+ purposes for the current chapter, then validate against Swain's Goal→Conflict→Outcome framework.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {SCENE_PURPOSES.map(p => (
                  <button key={p.id} onClick={() => togglePurpose(p.id)} style={{
                    padding: "6px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                    border: "1px solid",
                    borderColor: selectedPurposes.includes(p.id) ? "#D97706" : "rgba(255,255,255,0.12)",
                    background: selectedPurposes.includes(p.id) ? "rgba(217,119,6,0.15)" : "transparent",
                    color: selectedPurposes.includes(p.id) ? "#D97706" : "#9898A6",
                  }}>{p.label}</button>
                ))}
              </div>
              <button onClick={runValidator} disabled={validating} style={btnStyle(validating)}>
                {validating ? "Validating…" : "Validate Current Scene"}
              </button>
              {errorBox(validatorError)}

              {validatorResult && (
                <div style={{ marginTop: 16 }}>
                  {/* Purpose checks */}
                  <div style={{ marginBottom: 14 }}>
                    {validatorResult.purposeChecks?.map((pc: any) => (
                      <div key={pc.purpose} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{pc.fulfilled ? "✅" : "❌"}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#F2F2F3" }}>{pc.purpose}</div>
                          <div style={{ fontSize: 12, color: "#9898A6", marginTop: 2 }}>{pc.evidence}</div>
                          {!pc.fulfilled && pc.suggestion && (
                            <div style={{ fontSize: 12, color: "#D97706", marginTop: 4 }}>Fix: {pc.suggestion}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Swain structure */}
                  <div style={{ padding: "12px 14px", background: "#111113", borderRadius: 8, marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#9898A6", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Swain Structure</div>
                    {[
                      { label: "Goal", found: validatorResult.swainStructure?.hasGoal, desc: validatorResult.swainStructure?.goalDescription },
                      { label: "Conflict", found: validatorResult.swainStructure?.hasConflict, desc: validatorResult.swainStructure?.conflictDescription },
                      { label: "Outcome", found: !!validatorResult.swainStructure?.outcome && validatorResult.swainStructure?.outcome !== "not found", desc: validatorResult.swainStructure?.outcome },
                    ].map(s => (
                      <div key={s.label} style={{ display: "flex", gap: 8, fontSize: 13, marginBottom: 4 }}>
                        <span>{s.found ? "✅" : "❌"}</span>
                        <span style={{ color: "#F2F2F3", fontWeight: 500 }}>{s.label}:</span>
                        <span style={{ color: "#9898A6" }}>{s.desc || "not found"}</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 12, color: "#9898A6", marginTop: 6 }}>{validatorResult.swainStructure?.outcomeAssessment}</div>
                  </div>

                  {/* Overall verdict */}
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: "#9898A6" }}>Overall:</span>
                    <span style={{
                      padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                      background: (VERDICT_COLORS[validatorResult.overallVerdict] || "#888") + "22",
                      color: VERDICT_COLORS[validatorResult.overallVerdict] || "#888",
                    }}>{validatorResult.overallVerdict?.toUpperCase()}</span>
                    {validatorResult.removalTest && (
                      <span style={{ fontSize: 12, color: validatorResult.removalTest.removable ? "#f87171" : "#22c55e" }}>
                        {validatorResult.removalTest.removable ? "⚠ Removable" : "✓ Necessary"}
                      </span>
                    )}
                  </div>

                  {validatorResult.priorityFix && (
                    <div style={{ padding: "12px 14px", background: "rgba(217,119,6,0.1)", borderRadius: 8, borderLeft: "3px solid #D97706", fontSize: 13, color: "#F2F2F3" }}>
                      <strong>Priority fix:</strong> {validatorResult.priorityFix}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Dead Scenes ── */}
          {tab === "dead-scenes" && (
            <div>
              <p style={{ fontSize: 13, color: "#9898A6", margin: "0 0 14px" }}>
                McKee's scene value shift test: a scene is alive only when power, emotion, or information changes.
              </p>
              <button onClick={runDeadScenes} disabled={scanning} style={btnStyle(scanning)}>
                {scanning ? "Scanning…" : "Scan All Chapters"}
              </button>
              {errorBox(deadScenesError)}

              {deadScenesResult && (
                <div style={{ marginTop: 16 }}>
                  {/* Summary */}
                  {deadScenesResult.summary && (
                    <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                      {[
                        { label: "Total", value: deadScenesResult.summary.total, color: "#9898A6" },
                        { label: "Alive", value: deadScenesResult.summary.alive, color: "#22c55e" },
                        { label: "Thin", value: deadScenesResult.summary.thin, color: "#f59e0b" },
                        { label: "Dead", value: deadScenesResult.summary.dead, color: "#ef4444" },
                      ].map(s => (
                        <div key={s.label} style={{ flex: 1, padding: "10px", background: "#111113", borderRadius: 8, textAlign: "center" }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                          <div style={{ fontSize: 11, color: "#9898A6" }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Results table */}
                  <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto auto", gap: 0 }}>
                      {["Chapter", "Power", "Emotion", "Info", "Score", "Verdict"].map(h => (
                        <div key={h} style={{ padding: "8px 12px", background: "#111113", fontSize: 11, fontWeight: 600, color: "#9898A6", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</div>
                      ))}
                      {deadScenesResult.results?.map((r: any) => (
                        <>
                          <div
                            key={r.chapterId}
                            onClick={() => setExpandedScene(expandedScene === r.chapterId ? null : r.chapterId)}
                            style={{ padding: "9px 12px", fontSize: 13, color: "#F2F2F3", borderTop: "1px solid rgba(255,255,255,0.05)", cursor: "pointer" }}
                          >{r.title}</div>
                          {[r.powerShift, r.emotionalDelta, r.informationDelta].map((v, i) => (
                            <div key={i} style={{ padding: "9px 12px", fontSize: 13, textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.05)", color: v ? "#22c55e" : "#ef4444" }}>{v ? "✓" : "—"}</div>
                          ))}
                          <div style={{ padding: "9px 12px", fontSize: 13, textAlign: "center", fontWeight: 700, borderTop: "1px solid rgba(255,255,255,0.05)", color: SCENE_VERDICT_COLORS[r.verdict] || "#9898A6" }}>{r.totalScore}</div>
                          <div style={{ padding: "9px 12px", fontSize: 12, textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                            <span style={{ padding: "2px 8px", borderRadius: 12, background: (SCENE_VERDICT_COLORS[r.verdict] || "#888") + "22", color: SCENE_VERDICT_COLORS[r.verdict] || "#888", fontWeight: 600, fontSize: 11 }}>{r.verdict?.toUpperCase()}</span>
                          </div>
                          {expandedScene === r.chapterId && (
                            <div style={{ gridColumn: "1 / -1", padding: "10px 14px", background: "rgba(217,119,6,0.06)", borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
                              <div style={{ color: "#9898A6", marginBottom: 4 }}>{r.diagnosis}</div>
                              {r.suggestion && <div style={{ color: "#D97706" }}>Fix: {r.suggestion}</div>}
                            </div>
                          )}
                        </>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Theme Tracker ── */}
          {tab === "theme" && (
            <div>
              <p style={{ fontSize: 13, color: "#9898A6", margin: "0 0 14px" }}>
                Enter your story's Controlling Idea in the format: <em>"Life is [value/state] because [cause/choice]"</em>
              </p>
              <input
                value={controllingIdea}
                onChange={e => setControllingIdea(e.target.value)}
                placeholder='e.g. "Justice is restored because the protagonist refuses to compromise their integrity"'
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
                  background: "#111113", color: "#F2F2F3", fontSize: 13, marginBottom: 12, boxSizing: "border-box",
                }}
              />
              <button onClick={runTheme} disabled={analysingTheme} style={btnStyle(analysingTheme)}>
                {analysingTheme ? "Analysing…" : "Analyse Theme"}
              </button>
              {errorBox(themeError)}

              {themeResult && (
                <div style={{ marginTop: 16 }}>
                  {/* Health badge */}
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
                    <span style={{ fontSize: 13, color: "#9898A6" }}>Thematic Health:</span>
                    <span style={{
                      padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                      background: themeResult.overallThematicHealth === "strong" ? "#22c55e22" : themeResult.overallThematicHealth === "developing" ? "#f59e0b22" : "#ef444422",
                      color: themeResult.overallThematicHealth === "strong" ? "#22c55e" : themeResult.overallThematicHealth === "developing" ? "#f59e0b" : "#ef4444",
                    }}>{themeResult.overallThematicHealth?.toUpperCase()}</span>
                  </div>

                  {/* Consecutive gaps warning */}
                  {themeResult.consecutiveGaps?.length > 0 && (
                    <div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.08)", borderRadius: 8, borderLeft: "3px solid #f59e0b", fontSize: 13, color: "#F2F2F3", marginBottom: 12 }}>
                      ⚠ Consecutive chapters with no thematic signal: {themeResult.consecutiveGaps.flat().join(", ")}
                    </div>
                  )}

                  {/* Protagonist arc */}
                  {themeResult.protagonistArcAssessment && (
                    <div style={{ padding: "10px 14px", background: "#111113", borderRadius: 8, fontSize: 13, color: "#9898A6", marginBottom: 12 }}>
                      <strong style={{ color: "#F2F2F3" }}>Protagonist arc:</strong> {themeResult.protagonistArcAssessment}
                    </div>
                  )}

                  {/* Symbol objects */}
                  {themeResult.symbolObjects?.length > 0 && (
                    <div style={{ padding: "10px 14px", background: "#111113", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                      <div style={{ color: "#9898A6", marginBottom: 6, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Potential Symbols</div>
                      <div style={{ color: "#D97706" }}>{themeResult.symbolObjects.join(", ")}</div>
                    </div>
                  )}

                  {/* Chapter grid */}
                  <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto" }}>
                      {["Chapter", "Direct", "Structural", "Symbolic", "Score"].map(h => (
                        <div key={h} style={{ padding: "8px 12px", background: "#111113", fontSize: 11, fontWeight: 600, color: "#9898A6", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</div>
                      ))}
                      {themeResult.chapterAnalysis?.map((ca: any) => (
                        <>
                          <div key={ca.chapterId} style={{ padding: "9px 12px", fontSize: 13, color: "#F2F2F3", borderTop: "1px solid rgba(255,255,255,0.05)" }}>{ca.title}</div>
                          {[
                            { val: ca.hasDirectSignal, note: ca.directNote },
                            { val: ca.hasStructuralSignal, note: ca.structuralNote },
                            { val: ca.hasSymbolicSignal, note: ca.symbolicNote },
                          ].map((s, i) => (
                            <div key={i} title={s.note} style={{ padding: "9px 12px", fontSize: 13, textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.05)", color: s.val ? "#22c55e" : "#555", cursor: s.note && s.note !== "none" ? "help" : "default" }}>
                              {s.val ? "✓" : "—"}
                            </div>
                          ))}
                          <div style={{ padding: "9px 12px", fontSize: 13, textAlign: "center", fontWeight: 700, borderTop: "1px solid rgba(255,255,255,0.05)", color: ca.thematicScore >= 2 ? "#22c55e" : ca.thematicScore === 1 ? "#f59e0b" : "#ef4444" }}>
                            {ca.thematicScore}/3
                          </div>
                        </>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tension Curve ── */}
          {tab === "tension" && (
            <TensionCurve projectId={projectId} />
          )}
        </div>
      </div>
    </div>
  );
}
