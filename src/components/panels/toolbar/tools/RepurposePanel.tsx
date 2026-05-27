"use client";
import { useState } from "react";
import { isCreatorFormat } from "@/lib/formats";
import { co, sBtnSm, sBtn } from "@/lib/styles";

interface Props {
  format: string;
  mode: string;
  content: string;
  setSavedMsg: (m: string) => void;
  updateProject: (fn: any) => void;
  onUpgradeRequired?: (feature: string) => void;
}

const REPURPOSE_TARGETS: Record<string, string[]> = {
  "YouTube Long-form": ["YouTube Short", "TikTok Script", "Instagram Reel", "Twitter/X Thread"],
  "Podcast Episode": ["YouTube Short", "TikTok Script", "Instagram Reel", "Twitter/X Thread"],
  "YouTube Short": ["TikTok Script", "Instagram Reel", "Twitter/X Thread"],
  "TikTok Script": ["YouTube Short", "Instagram Reel", "Twitter/X Thread"],
  "Instagram Reel": ["YouTube Short", "TikTok Script", "Twitter/X Thread"],
};

/** Repurpose select + button in toolbar + modal. Owns its own state. */
export function RepurposePanel({ format, mode, content, setSavedMsg, updateProject, onUpgradeRequired }: Props) {
  const [repurposeResult, setRepurposeResult] = useState<any>(null);
  const [repurposeLoading, setRepurposeLoading] = useState(false);
  const [repurposeTarget, setRepurposeTarget] = useState("YouTube Short");

  const targets = REPURPOSE_TARGETS[format] ?? [];

  if (mode !== "write" || !isCreatorFormat(format) || !content?.trim() || targets.length === 0) return null;

  const run = async () => {
    if (!content?.trim() || repurposeLoading) return;
    setRepurposeLoading(true);
    setRepurposeResult(null);
    try {
      const res = await fetch("/api/ai/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, sourceFormat: format, targetFormat: repurposeTarget }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { onUpgradeRequired?.(data.feature); }
      else if (data.repurposed) setRepurposeResult(data);
    } catch { /* silent */ }
    setRepurposeLoading(false);
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <select
          style={{ ...sBtnSm, border: "1px solid " + co.border, background: co.surfaceAlt, color: co.text, padding: "4px 6px", fontSize: 11, cursor: "pointer" } as any}
          value={repurposeTarget}
          onChange={e => setRepurposeTarget(e.target.value)}
        >
          {targets.map(t => <option key={t}>{t}</option>)}
        </select>
        <button
          style={{ ...sBtnSm, background: "#ede9fe", color: "#7c3aed", fontWeight: 600, opacity: repurposeLoading ? 0.5 : 1 }}
          disabled={repurposeLoading}
          onClick={run}
        >
          {repurposeLoading ? "..." : "♻️ Repurpose"}
        </button>
      </div>

      {/* Repurpose Modal */}
      {repurposeResult && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setRepurposeResult(null)}>
          <div style={{ background: co.surface, borderRadius: 16, padding: 24, width: 620, maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid " + co.border }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>♻️ Repurposed for {repurposeResult.targetFormat}</h3>
              <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 18 }} onClick={() => setRepurposeResult(null)}>×</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", marginBottom: 6 }}>Best Moment Extracted</div>
              <div style={{ padding: 12, background: co.accentBg, borderRadius: 8, fontSize: 12, color: co.muted, lineHeight: 1.6, fontStyle: "italic", borderLeft: "3px solid " + co.accent }}>{repurposeResult.bestMoment}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: co.accent, textTransform: "uppercase", marginBottom: 6 }}>Repurposed Script</div>
              <div style={{ padding: 16, background: co.surfaceAlt, borderRadius: 10, fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap", border: "1px solid " + co.border }}>{repurposeResult.repurposed}</div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={sBtnSm} onClick={() => setRepurposeResult(null)}>Discard</button>
              <button style={{ ...sBtnSm, background: co.accentBg, color: co.accent }} onClick={() => { navigator.clipboard.writeText(repurposeResult.repurposed); setSavedMsg("Copied!"); setTimeout(() => setSavedMsg(""), 1500); }}>Copy</button>
              <button style={sBtn} onClick={() => {
                updateProject((p: any) => ({ ...p, notes: (p.notes || "") + (p.notes ? "\n---\n" : "") + "[REPURPOSE:" + repurposeResult.targetFormat.toUpperCase() + "]\n" + repurposeResult.repurposed }));
                setSavedMsg("Saved to Notes"); setTimeout(() => setSavedMsg(""), 1500);
                setRepurposeResult(null);
              }}>Save to Notes</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
