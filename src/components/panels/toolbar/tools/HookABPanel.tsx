"use client";
import { useState } from "react";
import { co, sBtn, sBtnSm, sInput } from "@/lib/styles";

interface HookResult {
  type: string;
  hook: string;
  ctrScore: number;
  reasoning: string;
  targetEmotion: string;
}

interface Props {
  format: string;
  onUpgradeRequired?: (feature: string) => void;
}

const EMOTION_COLORS: Record<string, string> = {
  curiosity: "#3b82f6",
  fear:      "#ef4444",
  surprise:  "#8b5cf6",
  desire:    "#ec4899",
  validation:"#10b981",
};

export function HookABPanel({ format, onUpgradeRequired }: Props) {
  const [show, setShow] = useState(false);
  const [contentSummary, setContentSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [hooks, setHooks] = useState<HookResult[]>([]);
  const [copied, setCopied] = useState<number | null>(null);

  const generate = async () => {
    if (!contentSummary.trim() || loading) return;
    setLoading(true);
    setHooks([]);
    try {
      const res = await fetch("/api/ai/hook-ab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentSummary, format }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") {
        onUpgradeRequired?.(data.feature);
        setShow(false);
      } else {
        setHooks(data.hooks ?? []);
      }
    } catch {
      // silent
    }
    setLoading(false);
  };

  const copyHook = (hook: string, idx: number) => {
    navigator.clipboard.writeText(hook);
    setCopied(idx);
    setTimeout(() => setCopied(null), 1500);
  };

  if (!["YouTube Long-form", "YouTube Short", "TikTok Script", "Instagram Reel", "Podcast Episode"].includes(format)) return null;

  return (
    <>
      <button
        style={{ ...sBtnSm, background: show ? co.accentBg : co.surfaceAlt, color: show ? co.accent : co.muted, border: "1px solid " + (show ? co.accent : co.border) }}
        onClick={() => setShow(v => !v)}
      >
        🎯 Hook A/B
      </button>

      {show && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1500 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 24, width: 560, maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>🎯 Hook A/B Testing</div>
              <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: co.muted }} onClick={() => setShow(false)}>×</button>
            </div>

            <div style={{ fontSize: 12, color: co.muted, marginBottom: 12 }}>
              Paste your content summary or first paragraph. We'll generate 5 hooks with CTR scores.
            </div>

            <textarea
              style={{ width: "100%", minHeight: 80, padding: "8px 12px", border: "1px solid " + co.border, borderRadius: 8, fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
              placeholder="What is your video about? Paste a one-paragraph summary or your opening..."
              value={contentSummary}
              onChange={e => setContentSummary(e.target.value)}
            />

            <button
              style={{ ...sBtn, width: "100%", marginTop: 10, opacity: loading || !contentSummary.trim() ? 0.5 : 1 }}
              disabled={loading || !contentSummary.trim()}
              onClick={generate}
            >
              {loading ? "Generating & Scoring..." : "Generate & Score 5 Hooks"}
            </button>

            {hooks.length > 0 && (
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                {hooks.map((h, i) => (
                  <div key={i} style={{ padding: "12px 14px", background: co.surfaceAlt, borderRadius: 10, border: "1px solid " + co.border }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase" }}>{h.type}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: (EMOTION_COLORS[h.targetEmotion] ?? co.accent) + "22", color: EMOTION_COLORS[h.targetEmotion] ?? co.accent, fontWeight: 600 }}>
                          {h.targetEmotion}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: h.ctrScore >= 7 ? "#10b981" : h.ctrScore >= 5 ? "#d97706" : "#ef4444" }}>
                          {h.ctrScore}/10
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, marginBottom: 6 }}>{h.hook}</div>
                    <div style={{ fontSize: 11, color: co.muted, marginBottom: 10 }}>{h.reasoning}</div>
                    <button
                      style={{ ...sBtnSm, fontSize: 11 }}
                      onClick={() => copyHook(h.hook, i)}
                    >
                      {copied === i ? "✓ Copied!" : "Copy Hook"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
