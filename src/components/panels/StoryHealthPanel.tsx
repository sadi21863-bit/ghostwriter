"use client";
import { useState, useEffect } from "react";
import { TensionCurve } from "@/components/TensionCurve";
import { ArcHeatMap } from "@/components/ArcHeatMap";
import { toast } from '@/lib/toast';
import { panel } from "@/lib/styles";

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
  passes: panel.success,
  "needs-work": panel.orange,
  rewrite: panel.danger,
};

const SCENE_VERDICT_COLORS: Record<string, string> = {
  alive: panel.success,
  thin: panel.orange,
  dead: panel.danger,
};

interface StoryHealthPanelProps {
  project: any;
  projectId: string;
  activeChapContent: string;
  onClose: () => void;
  onApplyFix?: (content: string) => void;
}

export function StoryHealthPanel({ project, projectId, activeChapContent, onClose, onApplyFix }: StoryHealthPanelProps) {
  const [tab, setTab] = useState<"validator" | "dead-scenes" | "theme" | "tension" | "transport" | "promises" | "heatmap" | "checkpoints" | "audit">("validator");

  // Checkpoints state
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [showCreateCheckpoint, setShowCreateCheckpoint] = useState(false);
  const [cpName, setCpName] = useState("");
  const [cpNotes, setCpNotes] = useState("");
  const [cpSaving, setCpSaving] = useState(false);

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

  // Transportation Check state
  const [checkingTransport, setCheckingTransport] = useState(false);
  const [transportResult, setTransportResult] = useState<any>(null);
  const [transportError, setTransportError] = useState("");

  // Story Promises state
  const [threads, setThreads] = useState<any[]>([]);
  const [showAddPromise, setShowAddPromise] = useState(false);
  const [newPromiseSetup, setNewPromiseSetup] = useState('');
  const [newPromisePriority, setNewPromisePriority] = useState<'A' | 'B' | 'C'>('B');

  // Theme Tracker state
  const [controllingIdea, setControllingIdea] = useState("");
  const [analysingTheme, setAnalysingTheme] = useState(false);
  const [themeResult, setThemeResult] = useState<any>(null);
  const [themeError, setThemeError] = useState("");

  // Manuscript Audit state
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);

  // Fix This state
  const [fixLoading, setFixLoading] = useState<Record<string, boolean>>({});
  const [fixResults, setFixResults] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/projects/${projectId}/story-state`)
      .then(r => r.json())
      .then(d => setThreads(d.threads ?? []));
    fetch(`/api/projects/${projectId}/checkpoints`)
      .then(r => r.json())
      .then(d => setCheckpoints(d.checkpoints ?? []));
  }, [projectId]);

  const saveCheckpoint = async () => {
    setCpSaving(true);
    const res = await fetch(`/api/projects/${projectId}/checkpoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: cpName, notes: cpNotes }),
    });
    const { checkpoint } = await res.json();
    if (checkpoint) setCheckpoints(prev => [checkpoint, ...prev]);
    setCpName(''); setCpNotes(''); setShowCreateCheckpoint(false); setCpSaving(false);
  };

  const deleteCheckpoint = async (checkpointId: string) => {
    await fetch(`/api/projects/${projectId}/checkpoints`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkpointId }),
    });
    setCheckpoints(prev => prev.filter(c => c.id !== checkpointId));
  };

  const healthScore = Math.max(0, 100
    - (project?.plotThreads?.filter((t: any) => t.starvationWarning).length ?? 0) * 5
    - (project?.chapters?.filter((c: any) => c.wordCount < 300 && c.content?.trim()).length ?? 0) * 3
    - (project?.characters?.filter((c: any) => !c.kinesicsBaseline).length ?? 0) * 5
    - (project?.referenceWorks?.length === 0 ? 10 : 0)
    - (threads.flatMap(t => t.promises ?? []).filter((p: any) => p.priority === 'A' && p.status === 'open').length * 8)
  );
  const scoreColor = healthScore >= 80 ? panel.success : healthScore >= 60 ? panel.orange : panel.danger;

  const markPromisePaid = async (promiseId: string) => {
    await fetch(`/api/projects/${projectId}/story-state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promiseId, status: 'paid' }),
    });
    setThreads(prev => prev.map(t => ({
      ...t,
      promises: t.promises.map((p: any) => p.id === promiseId ? { ...p, status: 'paid' } : p),
    })));
  };

  const addPromise = async () => {
    if (!newPromiseSetup.trim()) return;
    const res = await fetch(`/api/projects/${projectId}/story-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'promise', setup: newPromiseSetup, priority: newPromisePriority }),
    });
    const promise = await res.json();
    setThreads(prev => prev.length > 0
      ? [{ ...prev[0], promises: [...(prev[0].promises ?? []), promise] }, ...prev.slice(1)]
      : [{ id: 'default', name: 'General', promises: [promise] }]
    );
    setNewPromiseSetup('');
    setShowAddPromise(false);
  };

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

  const runTransportCheck = async () => {
    if (!activeChapContent?.trim()) { setTransportError("Open a chapter with content first."); return; }
    setCheckingTransport(true); setTransportError(""); setTransportResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/transportation-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterContent: activeChapContent }),
      });
      const data = await res.json();
      if (data.error) { setTransportError(data.error); } else { setTransportResult(data); }
    } catch { setTransportError("Check failed. Try again."); }
    setCheckingTransport(false);
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

  const handleRunAudit = async () => {
    setAuditRunning(true);
    setAuditResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/knowledge-audit`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        setAuditResult(data);
      }
    } catch {
      toast.error('Audit failed. Please try again.');
    } finally {
      setAuditRunning(false);
    }
  };

  const runFix = async (fixInstruction: string, fixId: string) => {
    if (!activeChapContent?.trim()) {
      toast.warning("Open a chapter with content first.");
      return;
    }
    setFixLoading(prev => ({ ...prev, [fixId]: true }));
    setFixResults(prev => { const n = { ...prev }; delete n[fixId]; return n; });
    try {
      const res = await fetch("/api/ai/prose-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: activeChapContent, fixInstruction, projectId }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error === "upgrade_required" ? "Prose tools require Story Pro or higher." : data.error);
      } else {
        setFixResults(prev => ({ ...prev, [fixId]: data.result }));
      }
    } catch {
      toast.error("Fix generation failed. Please try again.");
    }
    setFixLoading(prev => ({ ...prev, [fixId]: false }));
  };

  const dismissFix = (fixId: string) => {
    setFixResults(prev => { const n = { ...prev }; delete n[fixId]; return n; });
  };

  const applyFix = (fixId: string) => {
    const result = fixResults[fixId];
    if (result && onApplyFix) {
      onApplyFix(result);
      toast.success("Fix applied to chapter.");
      dismissFix(fixId);
    }
  };

  const FixThisButton = ({ instruction, fixId }: { instruction: string; fixId: string }) => {
    const isLoading = fixLoading[fixId];
    const hasResult = !!fixResults[fixId];
    if (hasResult) return null;
    return (
      <button
        onClick={() => runFix(instruction, fixId)}
        disabled={isLoading}
        style={{
          padding: "3px 10px", borderRadius: 6, border: `1px solid ${panel.accent}66`,
          background: isLoading ? `${panel.accent}0D` : `${panel.accent}1F`,
          color: isLoading ? panel.muted : panel.accent,
          fontSize: 11, fontWeight: 500, cursor: isLoading ? "not-allowed" : "pointer",
          flexShrink: 0, whiteSpace: "nowrap" as const,
        }}
      >
        {isLoading ? "Fixing…" : "Fix This"}
      </button>
    );
  };

  const FixResult = ({ fixId }: { fixId: string }) => {
    const result = fixResults[fixId];
    if (!result) return null;
    return (
      <div style={{ marginTop: 8, padding: "10px 12px", background: `${panel.accent}14`, borderRadius: 8, border: `1px solid ${panel.accent}33` }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: panel.accent, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Fix Suggestion</div>
        <div style={{ fontSize: 12, color: panel.text, lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto", marginBottom: 8 }}>{result}</div>
        <div style={{ display: "flex", gap: 6 }}>
          {onApplyFix && (
            <button
              onClick={() => applyFix(fixId)}
              style={{ padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: panel.accent, border: "none", color: "#fff", cursor: "pointer" }}
            >
              Apply to Chapter
            </button>
          )}
          <button
            onClick={() => dismissFix(fixId)}
            style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, background: "none", border: "1px solid rgba(255,255,255,0.1)", color: panel.muted, cursor: "pointer" }}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  };

  const tabStyle = (active: boolean) => ({
    padding: "8px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 400,
    background: active ? panel.surface : "transparent",
    color: active ? panel.text : panel.muted,
  });

  const btnStyle = (disabled: boolean, color = panel.warn) => ({
    padding: "9px 18px", borderRadius: 8, border: "none", cursor: disabled ? "not-allowed" : "pointer",
    background: disabled ? panel.border : color, color: "#fff", fontSize: 13, fontWeight: 500,
  });

  const errorBox = (msg: string) => msg ? (
    <div style={{ padding: "10px 14px", background: `${panel.danger}1A`, borderRadius: 8, color: panel.danger, fontSize: 13, marginBottom: 12 }}>{msg}</div>
  ) : null;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1200,
    }}>
      <div style={{
        background: panel.bg, borderRadius: 14, width: 720, maxHeight: "88vh",
        display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        border: `1px solid ${panel.border}`,
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 0" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: panel.text }}>Story Health</div>
            <div style={{ fontSize: 12, color: panel.muted, marginTop: 2 }}>Structure analysis & tension visualisation</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: panel.muted, cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Health Score */}
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${panel.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: panel.muted }}>Story Health Score</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: scoreColor }}>{healthScore}/100</span>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 11, color: panel.muted }}>
            <span>{project?.plotThreads?.filter((t: any) => t.starvationWarning).length ?? 0} starving threads</span>
            <span>{project?.chapters?.filter((c: any) => c.wordCount < 300 && c.content?.trim()).length ?? 0} thin chapters</span>
            <span>{project?.characters?.filter((c: any) => !c.kinesicsBaseline).length ?? 0} shallow characters</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, padding: "14px 20px 0", borderBottom: `1px solid ${panel.border}` }}>
          {([
            { id: "validator", label: "Scene Validator" },
            { id: "dead-scenes", label: "Dead Scenes" },
            { id: "theme", label: "Theme Tracker" },
            { id: "tension", label: "Tension Curve" },
            { id: "transport", label: "Transportation" },
            { id: "promises", label: "Story Promises" },
            { id: "heatmap", label: "Arc Heat Map" },
            { id: "checkpoints", label: "Checkpoints" },
            { id: "audit", label: "Manuscript Audit" },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={tabStyle(tab === t.id)}>{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>

          {/* ── Scene Validator ── */}
          {tab === "validator" && (
            <div>
              <p style={{ fontSize: 13, color: panel.muted, margin: "0 0 14px" }}>
                Declare 2+ purposes for the current chapter, then validate against Swain's Goal→Conflict→Outcome framework.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {SCENE_PURPOSES.map(p => (
                  <button key={p.id} onClick={() => togglePurpose(p.id)} style={{
                    padding: "6px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                    border: "1px solid",
                    borderColor: selectedPurposes.includes(p.id) ? panel.warn : `${panel.border}`,
                    background: selectedPurposes.includes(p.id) ? `${panel.warn}26` : "transparent",
                    color: selectedPurposes.includes(p.id) ? panel.warn : panel.muted,
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
                    {validatorResult.purposeChecks?.map((pc: any) => {
                      const fixId = `purpose-${pc.purpose}`;
                      return (
                        <div key={pc.purpose} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <span style={{ fontSize: 16, flexShrink: 0 }}>{pc.fulfilled ? "✅" : "❌"}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: panel.text }}>{pc.purpose}</div>
                              <div style={{ fontSize: 12, color: panel.muted, marginTop: 2 }}>{pc.evidence}</div>
                              {!pc.fulfilled && pc.suggestion && (
                                <div style={{ fontSize: 12, color: panel.warn, marginTop: 4 }}>Fix: {pc.suggestion}</div>
                              )}
                            </div>
                            {!pc.fulfilled && pc.suggestion && (
                              <FixThisButton instruction={pc.suggestion} fixId={fixId} />
                            )}
                          </div>
                          <FixResult fixId={fixId} />
                        </div>
                      );
                    })}
                  </div>

                  {/* Swain structure */}
                  <div style={{ padding: "12px 14px", background: panel.deeper, borderRadius: 8, marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: panel.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Swain Structure</div>
                    {[
                      { label: "Goal", found: validatorResult.swainStructure?.hasGoal, desc: validatorResult.swainStructure?.goalDescription },
                      { label: "Conflict", found: validatorResult.swainStructure?.hasConflict, desc: validatorResult.swainStructure?.conflictDescription },
                      { label: "Outcome", found: !!validatorResult.swainStructure?.outcome && validatorResult.swainStructure?.outcome !== "not found", desc: validatorResult.swainStructure?.outcome },
                    ].map(s => (
                      <div key={s.label} style={{ display: "flex", gap: 8, fontSize: 13, marginBottom: 4 }}>
                        <span>{s.found ? "✅" : "❌"}</span>
                        <span style={{ color: panel.text, fontWeight: 500 }}>{s.label}:</span>
                        <span style={{ color: panel.muted }}>{s.desc || "not found"}</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 12, color: panel.muted, marginTop: 6 }}>{validatorResult.swainStructure?.outcomeAssessment}</div>
                  </div>

                  {/* Overall verdict */}
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: panel.muted }}>Overall:</span>
                    <span style={{
                      padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                      background: (VERDICT_COLORS[validatorResult.overallVerdict] || "#888") + "22",
                      color: VERDICT_COLORS[validatorResult.overallVerdict] || "#888",
                    }}>{validatorResult.overallVerdict?.toUpperCase()}</span>
                    {validatorResult.removalTest && (
                      <span style={{ fontSize: 12, color: validatorResult.removalTest.removable ? panel.danger : panel.success }}>
                        {validatorResult.removalTest.removable ? "⚠ Removable" : "✓ Necessary"}
                      </span>
                    )}
                  </div>

                  {validatorResult.priorityFix && (
                    <div style={{ padding: "12px 14px", background: `${panel.warn}1A`, borderRadius: 8, borderLeft: `3px solid ${panel.warn}`, fontSize: 13, color: panel.text }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}><strong>Priority fix:</strong> {validatorResult.priorityFix}</div>
                        <FixThisButton instruction={validatorResult.priorityFix} fixId="validator-priority-fix" />
                      </div>
                      <FixResult fixId="validator-priority-fix" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Dead Scenes ── */}
          {tab === "dead-scenes" && (
            <div>
              <p style={{ fontSize: 13, color: panel.muted, margin: "0 0 14px" }}>
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
                        { label: "Total", value: deadScenesResult.summary.total, color: panel.muted },
                        { label: "Alive", value: deadScenesResult.summary.alive, color: panel.success },
                        { label: "Thin", value: deadScenesResult.summary.thin, color: panel.orange },
                        { label: "Dead", value: deadScenesResult.summary.dead, color: panel.danger },
                      ].map(s => (
                        <div key={s.label} style={{ flex: 1, padding: "10px", background: panel.deeper, borderRadius: 8, textAlign: "center" }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                          <div style={{ fontSize: 11, color: panel.muted }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Results table */}
                  <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto auto", gap: 0 }}>
                      {["Chapter", "Power", "Emotion", "Info", "Score", "Verdict"].map(h => (
                        <div key={h} style={{ padding: "8px 12px", background: panel.deeper, fontSize: 11, fontWeight: 600, color: panel.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</div>
                      ))}
                      {deadScenesResult.results?.map((r: any) => (
                        <>
                          <div
                            key={r.chapterId}
                            onClick={() => setExpandedScene(expandedScene === r.chapterId ? null : r.chapterId)}
                            style={{ padding: "9px 12px", fontSize: 13, color: panel.text, borderTop: `1px solid ${panel.border}`, cursor: "pointer" }}
                          >{r.title}</div>
                          {[r.powerShift, r.emotionalDelta, r.informationDelta].map((v, i) => (
                            <div key={i} style={{ padding: "9px 12px", fontSize: 13, textAlign: "center", borderTop: `1px solid ${panel.border}`, color: v ? panel.success : panel.danger }}>{v ? "✓" : "—"}</div>
                          ))}
                          <div style={{ padding: "9px 12px", fontSize: 13, textAlign: "center", fontWeight: 700, borderTop: `1px solid ${panel.border}`, color: SCENE_VERDICT_COLORS[r.verdict] || panel.muted }}>{r.totalScore}</div>
                          <div style={{ padding: "9px 12px", fontSize: 12, textAlign: "center", borderTop: `1px solid ${panel.border}` }}>
                            <span style={{ padding: "2px 8px", borderRadius: 12, background: (SCENE_VERDICT_COLORS[r.verdict] || "#888") + "22", color: SCENE_VERDICT_COLORS[r.verdict] || "#888", fontWeight: 600, fontSize: 11 }}>{r.verdict?.toUpperCase()}</span>
                          </div>
                          {expandedScene === r.chapterId && (
                            <div style={{ gridColumn: "1 / -1", padding: "10px 14px", background: `${panel.warn}0F`, borderTop: `1px solid ${panel.border}`, fontSize: 13 }}>
                              <div style={{ color: panel.muted, marginBottom: 4 }}>{r.diagnosis}</div>
                              {r.suggestion && (
                                <>
                                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                                    <div style={{ color: panel.warn, flex: 1 }}>Fix: {r.suggestion}</div>
                                    <FixThisButton instruction={r.suggestion} fixId={`dead-scene-${r.chapterId}`} />
                                  </div>
                                  <FixResult fixId={`dead-scene-${r.chapterId}`} />
                                </>
                              )}
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
              <p style={{ fontSize: 13, color: panel.muted, margin: "0 0 14px" }}>
                Enter your story's Controlling Idea in the format: <em>"Life is [value/state] because [cause/choice]"</em>
              </p>
              <input
                value={controllingIdea}
                onChange={e => setControllingIdea(e.target.value)}
                placeholder='e.g. "Justice is restored because the protagonist refuses to compromise their integrity"'
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${panel.border}`,
                  background: panel.deeper, color: panel.text, fontSize: 13, marginBottom: 12, boxSizing: "border-box",
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
                    <span style={{ fontSize: 13, color: panel.muted }}>Thematic Health:</span>
                    <span style={{
                      padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                      background: themeResult.overallThematicHealth === "strong" ? `${panel.success}22` : themeResult.overallThematicHealth === "developing" ? `${panel.orange}22` : `${panel.danger}22`,
                      color: themeResult.overallThematicHealth === "strong" ? panel.success : themeResult.overallThematicHealth === "developing" ? panel.orange : panel.danger,
                    }}>{themeResult.overallThematicHealth?.toUpperCase()}</span>
                  </div>

                  {/* Consecutive gaps warning */}
                  {themeResult.consecutiveGaps?.length > 0 && (
                    <div style={{ padding: "10px 14px", background: `${panel.orange}14`, borderRadius: 8, borderLeft: `3px solid ${panel.orange}`, fontSize: 13, color: panel.text, marginBottom: 12 }}>
                      ⚠ Consecutive chapters with no thematic signal: {themeResult.consecutiveGaps.flat().join(", ")}
                    </div>
                  )}

                  {/* Protagonist arc */}
                  {themeResult.protagonistArcAssessment && (
                    <div style={{ padding: "10px 14px", background: panel.deeper, borderRadius: 8, fontSize: 13, color: panel.muted, marginBottom: 12 }}>
                      <strong style={{ color: panel.text }}>Protagonist arc:</strong> {themeResult.protagonistArcAssessment}
                    </div>
                  )}

                  {/* Symbol objects */}
                  {themeResult.symbolObjects?.length > 0 && (
                    <div style={{ padding: "10px 14px", background: panel.deeper, borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                      <div style={{ color: panel.muted, marginBottom: 6, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Potential Symbols</div>
                      <div style={{ color: panel.warn }}>{themeResult.symbolObjects.join(", ")}</div>
                    </div>
                  )}

                  {/* Chapter grid */}
                  <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto" }}>
                      {["Chapter", "Direct", "Structural", "Symbolic", "Score"].map(h => (
                        <div key={h} style={{ padding: "8px 12px", background: panel.deeper, fontSize: 11, fontWeight: 600, color: panel.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</div>
                      ))}
                      {themeResult.chapterAnalysis?.map((ca: any) => (
                        <>
                          <div key={ca.chapterId} style={{ padding: "9px 12px", fontSize: 13, color: panel.text, borderTop: `1px solid ${panel.border}` }}>{ca.title}</div>
                          {[
                            { val: ca.hasDirectSignal, note: ca.directNote },
                            { val: ca.hasStructuralSignal, note: ca.structuralNote },
                            { val: ca.hasSymbolicSignal, note: ca.symbolicNote },
                          ].map((s, i) => (
                            <div key={i} title={s.note} style={{ padding: "9px 12px", fontSize: 13, textAlign: "center", borderTop: `1px solid ${panel.border}`, color: s.val ? panel.success : panel.border, cursor: s.note && s.note !== "none" ? "help" : "default" }}>
                              {s.val ? "✓" : "—"}
                            </div>
                          ))}
                          <div style={{ padding: "9px 12px", fontSize: 13, textAlign: "center", fontWeight: 700, borderTop: `1px solid ${panel.border}`, color: ca.thematicScore >= 2 ? panel.success : ca.thematicScore === 1 ? panel.orange : panel.danger }}>
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

          {/* ── Story Promises ── */}
          {tab === "promises" && (
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: panel.text }}>Open Story Promises</span>
                <button
                  onClick={() => setShowAddPromise(v => !v)}
                  style={{ fontSize: 11, padding: '4px 10px', background: `${panel.warn}26`, border: `1px solid ${panel.warn}66`, borderRadius: 6, color: panel.warn, cursor: 'pointer' }}
                >
                  + Add
                </button>
              </div>

              {showAddPromise && (
                <div style={{ marginBottom: 12, padding: '10px 12px', background: panel.deeper, borderRadius: 8, border: `1px solid ${panel.border}` }}>
                  <input
                    value={newPromiseSetup}
                    onChange={e => setNewPromiseSetup(e.target.value)}
                    placeholder="What promise/setup did you plant? (Chekhov's gun)"
                    style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: panel.text, fontSize: 12, marginBottom: 8, boxSizing: 'border-box' as const }}
                    onKeyDown={e => e.key === 'Enter' && addPromise()}
                  />
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {(['A', 'B', 'C'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setNewPromisePriority(p)}
                        style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', border: `1px solid ${newPromisePriority === p ? panel.warn : panel.border}`, background: newPromisePriority === p ? `${panel.warn}26` : 'transparent', color: newPromisePriority === p ? panel.warn : panel.muted }}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={addPromise}
                      style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 10px', background: panel.warn, border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer' }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {threads.flatMap(t => (t.promises ?? []).filter((p: any) => p.status === 'open')).map((promise: any) => {
                const thread = threads.find(t => (t.promises ?? []).some((p: any) => p.id === promise.id));
                const isPriorityA = promise.priority === 'A';
                return (
                  <div key={promise.id} style={{ padding: '10px 12px', marginBottom: 8, border: `1px solid ${isPriorityA ? panel.danger : panel.border}`, borderRadius: 8, background: panel.deeper }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: isPriorityA ? panel.danger : panel.border, color: isPriorityA ? '#fff' : panel.muted, flexShrink: 0, marginTop: 1 }}>
                        {promise.priority}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: panel.text }}>{promise.setup}</div>
                        {thread && (
                          <div style={{ fontSize: 11, color: panel.muted, marginTop: 3 }}>Thread: {thread.name}</div>
                        )}
                        {promise.payoffIntent && (
                          <div style={{ fontSize: 11, color: panel.muted, marginTop: 3 }}>Intended payoff: {promise.payoffIntent}</div>
                        )}
                      </div>
                      <button
                        onClick={() => markPromisePaid(promise.id)}
                        style={{ fontSize: 10, padding: '3px 8px', background: `${panel.success}1A`, border: `1px solid ${panel.success}4D`, borderRadius: 6, color: panel.success, cursor: 'pointer', flexShrink: 0 }}
                      >
                        Paid ✓
                      </button>
                    </div>
                  </div>
                );
              })}

              {threads.flatMap(t => (t.promises ?? []).filter((p: any) => p.status === 'open')).length === 0 && !showAddPromise && (
                <div style={{ fontSize: 13, color: panel.muted, textAlign: 'center' as const, padding: 24 }}>
                  No open promises. Add one when you plant a Chekhov&apos;s gun.
                </div>
              )}
            </div>
          )}

          {/* ── Transportation Check ── */}
          {tab === "transport" && (
            <div>
              <p style={{ fontSize: 13, color: panel.muted, margin: "0 0 14px" }}>
                Green &amp; Brock's Transportation-Imagery Model: identify the six ejection mechanisms that break reader immersion.
              </p>
              <button onClick={runTransportCheck} disabled={checkingTransport} style={btnStyle(checkingTransport, panel.accent)}>
                {checkingTransport ? "Analysing…" : "Check Current Chapter"}
              </button>
              {errorBox(transportError)}

              {transportResult && (
                <div style={{ marginTop: 16 }}>
                  {/* First Page Test */}
                  {transportResult.firstPageTest && (
                    <div style={{ padding: "12px 14px", background: panel.deeper, borderRadius: 8, marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: panel.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>First Page Test</div>
                      <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
                        {[
                          { label: "Vivid image", pass: transportResult.firstPageTest.vivid },
                          { label: "Specific person", pass: transportResult.firstPageTest.specificPerson },
                          { label: "Clean prose", pass: transportResult.firstPageTest.clean },
                        ].map(t => (
                          <div key={t.label} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                            <span style={{ color: t.pass ? panel.success : panel.danger }}>{t.pass ? "✓" : "✗"}</span>
                            <span style={{ color: panel.muted }}>{t.label}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: 12, color: panel.text }}>{transportResult.firstPageTest.verdict}</div>
                    </div>
                  )}

                  {/* Overall Score */}
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
                    <span style={{ fontSize: 13, color: panel.muted }}>Immersion Score:</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: transportResult.overallScore >= 7 ? panel.success : transportResult.overallScore >= 4 ? panel.orange : panel.danger }}>
                      {transportResult.overallScore}/10
                    </span>
                  </div>

                  {transportResult.summary && (
                    <div style={{ padding: "10px 14px", background: panel.deeper, borderRadius: 8, fontSize: 13, color: panel.muted, marginBottom: 14 }}>
                      {transportResult.summary}
                    </div>
                  )}

                  {/* Ejection mechanisms */}
                  {transportResult.ejections?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: panel.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Ejection Mechanisms ({transportResult.ejections.length})
                      </div>
                      {transportResult.ejections.map((e: any, i: number) => {
                        const fixId = `transport-ejection-${i}`;
                        return (
                          <div key={i} style={{ padding: "12px 14px", background: panel.deeper, borderRadius: 8, marginBottom: 8, borderLeft: `3px solid ${panel.danger}` }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: panel.danger, marginBottom: 4, textTransform: "uppercase" }}>{e.mechanism?.replace(/_/g, " ")}</div>
                            {e.excerpt && (
                              <div style={{ fontSize: 12, color: panel.muted, fontStyle: "italic", marginBottom: 6, borderLeft: `2px solid ${panel.border}`, paddingLeft: 8 }}>"{e.excerpt}"</div>
                            )}
                            <div style={{ fontSize: 13, color: panel.text, marginBottom: 4 }}>{e.explanation}</div>
                            {e.fix && (
                              <>
                                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                                  <div style={{ fontSize: 12, color: panel.accent, flex: 1 }}>Fix: {e.fix}</div>
                                  <FixThisButton instruction={e.fix} fixId={fixId} />
                                </div>
                                <FixResult fixId={fixId} />
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {transportResult.ejections?.length === 0 && (
                    <div style={{ padding: "14px", background: `${panel.success}14`, borderRadius: 8, fontSize: 13, color: panel.success }}>
                      ✓ No ejection mechanisms detected. The prose maintains transportation throughout.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Arc Heat Map ── */}
          {tab === "heatmap" && (
            <ArcHeatMap projectId={projectId} />
          )}

          {/* ── Checkpoints ── */}
          {tab === "checkpoints" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: panel.text }}>Story Checkpoints</span>
                <button
                  onClick={() => setShowCreateCheckpoint(v => !v)}
                  style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, border: `1px solid ${panel.border}`, background: `${panel.text}0F`, color: panel.text, cursor: "pointer" }}
                >
                  + Save checkpoint
                </button>
              </div>

              {showCreateCheckpoint && (
                <div style={{ padding: 14, borderRadius: 8, background: panel.surface, border: `1px solid ${panel.border}`, marginBottom: 12 }}>
                  <input
                    value={cpName}
                    onChange={e => setCpName(e.target.value)}
                    placeholder={`Checkpoint — ${new Date().toLocaleDateString()}`}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 13, background: panel.deeper, border: `1px solid ${panel.border}`, color: panel.text, boxSizing: "border-box", marginBottom: 8 }}
                  />
                  <textarea
                    value={cpNotes}
                    onChange={e => setCpNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    rows={2}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 12, background: panel.deeper, border: `1px solid ${panel.border}`, color: panel.text, boxSizing: "border-box", resize: "none", marginBottom: 8 }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={saveCheckpoint} disabled={cpSaving} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, background: panel.accent, color: "#fff", border: "none", cursor: cpSaving ? "not-allowed" : "pointer", opacity: cpSaving ? 0.7 : 1 }}>
                      {cpSaving ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => setShowCreateCheckpoint(false)} style={{ padding: "6px 12px", borderRadius: 6, fontSize: 12, background: "none", border: `1px solid ${panel.border}`, color: panel.muted, cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {checkpoints.length === 0 && !showCreateCheckpoint && (
                <p style={{ fontSize: 12, color: panel.muted, textAlign: "center", padding: "24px 0" }}>
                  No checkpoints yet. Save one when the story is working well.
                </p>
              )}

              {checkpoints.map((cp: any) => (
                <div key={cp.id} style={{ padding: "12px", marginBottom: 8, borderRadius: 8, border: `1px solid ${panel.border}`, background: panel.surface }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: panel.text }}>{cp.name}</div>
                      <div style={{ fontSize: 11, color: panel.muted, marginTop: 3 }}>
                        {new Date(cp.createdAt).toLocaleDateString()} ·{" "}
                        {cp.snapshot.chapterCount} ch ·{" "}
                        {cp.snapshot.totalWordCount.toLocaleString()} words ·{" "}
                        Health: {cp.snapshot.healthScore}/100
                      </div>
                      {cp.notes && (
                        <div style={{ fontSize: 11, color: panel.muted, marginTop: 4, fontStyle: "italic" }}>{cp.notes}</div>
                      )}
                    </div>
                    <button onClick={() => deleteCheckpoint(cp.id)} style={{ fontSize: 11, background: "none", border: "none", color: panel.muted, cursor: "pointer", padding: "0 4px" }}>✕</button>
                  </div>
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {cp.snapshot.chapters.slice(0, 8).map((c: any) => (
                      <span key={c.id} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: panel.deeper, color: panel.muted }}>
                        {c.title} ({c.wordCount.toLocaleString()}w)
                      </span>
                    ))}
                    {cp.snapshot.chapters.length > 8 && (
                      <span style={{ fontSize: 10, color: panel.muted }}>+{cp.snapshot.chapters.length - 8} more</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Manuscript Audit ── */}
          {tab === "audit" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: panel.text }}>Manuscript Audit</div>
                  <div style={{ fontSize: 11, color: panel.muted, marginTop: 2 }}>
                    Full-manuscript consistency check. Finds character, timeline, and knowledge violations.
                    Story Pro only.
                  </div>
                </div>
                <button onClick={handleRunAudit} disabled={auditRunning} style={btnStyle(auditRunning)}>
                  {auditRunning ? "Auditing…" : "Run audit"}
                </button>
              </div>

              {auditResult && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 11, color: panel.muted }}>
                    {auditResult.chaptersAudited} chapters audited · {auditResult.issues?.length ?? 0} issues found
                  </div>

                  {auditResult.strengths?.map((s: string, i: number) => (
                    <div key={i} style={{ padding: "8px 12px", background: `${panel.success}14`, borderRadius: 8, fontSize: 12, color: panel.success }}>
                      ✓ {s}
                    </div>
                  ))}

                  {auditResult.issues?.map((issue: any, i: number) => {
                    const fixId = `audit-issue-${i}`;
                    return (
                      <div key={i} style={{
                        padding: "10px 12px", borderRadius: 8,
                        background: issue.severity === "high" ? `${panel.danger}14` : `${panel.orange}14`,
                        border: `1px solid ${issue.severity === "high" ? `${panel.danger}40` : `${panel.orange}33`}`,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: panel.text }}>{issue.title}</div>
                          <div style={{ fontSize: 10, color: panel.muted }}>Ch {issue.chapter} · {issue.severity}</div>
                        </div>
                        <div style={{ fontSize: 11, color: panel.muted, marginBottom: 4 }}>{issue.description}</div>
                        {issue.suggestion && (
                          <>
                            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                              <div style={{ fontSize: 11, color: panel.success, fontStyle: "italic", flex: 1 }}>→ {issue.suggestion}</div>
                              <FixThisButton instruction={issue.suggestion} fixId={fixId} />
                            </div>
                            <FixResult fixId={fixId} />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
