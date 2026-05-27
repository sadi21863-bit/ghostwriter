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

/** Toolbar button + modal. Owns retention-edit loading/result state. */
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
        {retentionLoading ? "Analyzing..." : "📊 Retention Edit"}
      </button>

      {/* Retention Edit Modal */}
      {retentionEdit && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setRetentionEdit(null)}>
          <div style={{ background: co.surface, borderRadius: 16, padding: 24, width: 620, maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid " + co.border }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📊 Retention Edit</h3>
              <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 18 }} onClick={() => setRetentionEdit(null)}>×</button>
            </div>
            {retentionEdit.strongPoints?.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginBottom: 6 }}>What's Working</div>
                {retentionEdit.strongPoints.map((p: string, i: number) => <div key={i} style={{ fontSize: 12, color: co.text, background: "#f0fdf4", borderRadius: 6, padding: "6px 10px", marginBottom: 4 }}>✓ {p}</div>)}
              </div>
            )}
            {retentionEdit.missingElements?.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#d97706", textTransform: "uppercase", marginBottom: 6 }}>Missing Elements</div>
                {retentionEdit.missingElements.map((p: string, i: number) => <div key={i} style={{ fontSize: 12, color: co.text, background: "#fffbeb", borderRadius: 6, padding: "6px 10px", marginBottom: 4 }}>⚠ {p}</div>)}
              </div>
            )}
            {retentionEdit.issues?.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: co.danger, textTransform: "uppercase", marginBottom: 6 }}>Line-Level Issues</div>
                {retentionEdit.issues.map((issue: any, i: number) => (
                  <div key={i} style={{ background: co.surfaceAlt, borderRadius: 8, padding: 12, marginBottom: 8, borderLeft: "3px solid " + co.danger }}>
                    <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>📍 "{issue.location}"</div>
                    <div style={{ fontSize: 12, color: co.text, marginBottom: 4 }}><strong>Problem:</strong> {issue.problem}</div>
                    <div style={{ fontSize: 12, color: co.accent }}><strong>Fix:</strong> {issue.fix}</div>
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
