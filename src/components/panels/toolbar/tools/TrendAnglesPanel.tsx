"use client";
import { useState } from "react";
import { co, sBtnSm } from "@/lib/styles";

interface Props {
  format: string;
  prompt: string;
  setPrompt: (v: string) => void;
  onUpgradeRequired?: (feature: string) => void;
}

const TREND_FORMATS = ["TikTok Script", "YouTube Short", "Instagram Reel"];

/** Trends button (toolbar) + modal. Owns its own state. */
export function TrendAnglesPanel({ format, prompt, setPrompt, onUpgradeRequired }: Props) {
  const [trendAngles, setTrendAngles] = useState<any>(null);
  const [trendLoading, setTrendLoading] = useState(false);

  if (!TREND_FORMATS.includes(format) || !prompt.trim()) return null;

  const run = async () => {
    if (!prompt.trim() || trendLoading) return;
    setTrendLoading(true);
    setTrendAngles(null);
    try {
      const res = await fetch("/api/ai/trend-angles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: prompt, format }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { onUpgradeRequired?.(data.feature); }
      else if (data.trends) setTrendAngles(data.trends);
      else if (data.error) setTrendAngles({ error: data.error });
    } catch { /* silent */ }
    setTrendLoading(false);
  };

  return (
    <>
      <button
        style={{ ...sBtnSm, background: "#fef9c3", color: "#854d0e", fontWeight: 600, opacity: trendLoading ? 0.5 : 1 }}
        disabled={trendLoading}
        onClick={run}
      >
        {trendLoading ? "Searching..." : "📈 Trends"}
      </button>

      {/* Trend Angles Modal */}
      {trendAngles && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setTrendAngles(null)}>
          <div style={{ background: co.surface, borderRadius: 16, padding: 24, width: 560, maxHeight: "75vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid " + co.border }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📈 Trend Angles</h3>
              <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 18 }} onClick={() => setTrendAngles(null)}>×</button>
            </div>
            {trendAngles.error
              ? <div style={{ color: co.danger, fontSize: 13 }}>{trendAngles.error}</div>
              : trendAngles.angles?.map((a: any, i: number) => (
                <div key={i} style={{ background: co.surfaceAlt, borderRadius: 10, padding: 12, marginBottom: 8, border: "1px solid " + co.border }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: co.text, flex: 1 }}>{a.angle}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: a.trendScore >= 8 ? "#16a34a" : a.trendScore >= 5 ? "#d97706" : "#dc2626", marginLeft: 8 }}>🔥 {a.trendScore}/10</span>
                  </div>
                  <div style={{ fontSize: 12, color: co.accent, fontStyle: "italic", marginBottom: 4 }}>Hook: "{a.hook}"</div>
                  <div style={{ fontSize: 11, color: co.muted }}>{a.why}</div>
                  <button style={{ ...sBtnSm, marginTop: 8, fontSize: 10 }} onClick={() => { setPrompt(a.hook); setTrendAngles(null); }}>Use Hook</button>
                </div>
              ))
            }
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button style={sBtnSm} onClick={() => setTrendAngles(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
