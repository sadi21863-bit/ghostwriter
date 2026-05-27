"use client";
import { useState } from "react";
import { isCreatorFormat } from "@/lib/formats";
import { co, sBtnSm } from "@/lib/styles";

interface Props {
  format: string;
  mode: string;
  prompt: string;
  topic: string;
  setSavedMsg: (m: string) => void;
  onUpgradeRequired?: (feature: string) => void;
}

/** Renders the Title Ideas button (in prompt bar) + modal overlay. Owns its own loading/result state. */
export function TitleHookPanel({ format, mode, prompt, topic, setSavedMsg, onUpgradeRequired }: Props) {
  const [titleIdeas, setTitleIdeas] = useState<any>(null);
  const [titleLoading, setTitleLoading] = useState(false);

  if (!isCreatorFormat(format) || !prompt.trim() || mode === "cohost") return null;

  const runTitleHook = async () => {
    if (!prompt.trim() || titleLoading) return;
    setTitleLoading(true);
    setTitleIdeas(null);
    try {
      const res = await fetch("/api/ai/title-hook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hook: prompt, format, topic }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { onUpgradeRequired?.(data.feature); }
      else if (data.titles) setTitleIdeas(data.titles);
    } catch { /* silent */ }
    setTitleLoading(false);
  };

  return (
    <>
      <button
        style={{ ...sBtnSm, background: "#e0f2fe", color: "#0369a1", opacity: titleLoading ? 0.5 : 1 }}
        disabled={titleLoading}
        onClick={runTitleHook}
      >
        {titleLoading ? "..." : "💡 Title Ideas"}
      </button>

      {/* Title Ideas Modal */}
      {titleIdeas && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setTitleIdeas(null)}>
          <div style={{ background: co.surface, borderRadius: 16, padding: 24, width: 540, maxHeight: "70vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid " + co.border }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>💡 Title Ideas</h3>
              <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 18 }} onClick={() => setTitleIdeas(null)}>×</button>
            </div>
            {titleIdeas.map((t: any, i: number) => (
              <div key={i} style={{ background: co.surfaceAlt, borderRadius: 8, padding: 12, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: co.text, flex: 1 }}>{t.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: t.ctrScore >= 8 ? "#16a34a" : t.ctrScore >= 5 ? "#d97706" : "#dc2626" }}>{t.ctrScore}/10</span>
                    <button style={{ ...sBtnSm, fontSize: 10 }} onClick={() => { navigator.clipboard.writeText(t.title); }}>Copy</button>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: co.muted, lineHeight: 1.5 }}>{t.alignment}</div>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button style={sBtnSm} onClick={() => setTitleIdeas(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
