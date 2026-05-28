"use client";
import { useState } from "react";
import { co, sBtnSm } from "@/lib/styles";

interface NicheTrend {
  topic: string;
  angle: string;
  audienceResonance: "high" | "medium" | "low";
  exampleHook: string;
  whyItFits: string;
}

interface NicheResult {
  trends: NicheTrend[];
  nicheInsight: string;
  performancePatterns: string[];
  niche: string;
  error?: string;
}

interface Props {
  format: string;
  projectId: string;
  setPrompt: (v: string) => void;
  onUpgradeRequired?: (feature: string) => void;
}

const CREATOR_FORMATS = [
  "YouTube Long-form", "YouTube Short", "TikTok Script",
  "Instagram Reel", "Podcast Script",
];

const RESONANCE_COLOR: Record<string, string> = {
  high: "#16a34a",
  medium: "#d97706",
  low: "#dc2626",
};

export function TrendNichePanel({ format, projectId, setPrompt, onUpgradeRequired }: Props) {
  const [result, setResult] = useState<NicheResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [pastVideos, setPastVideos] = useState("");
  const [showPaste, setShowPaste] = useState(false);

  if (!CREATOR_FORMATS.includes(format)) return null;

  const run = async () => {
    if (loading) return;
    setLoading(true);
    setResult(null);

    // Parse pasted past video data if provided (format: "Title — views\n...")
    let pastVideoData: { title: string; views?: number }[] | undefined;
    if (pastVideos.trim()) {
      const lines = pastVideos.trim().split("\n").filter(Boolean);
      pastVideoData = lines.map(line => {
        const match = line.match(/^(.+?)\s*[—–-]\s*([\d,]+)/);
        if (match) {
          return { title: match[1].trim(), views: parseInt(match[2].replace(/,/g, "")) };
        }
        return { title: line.trim() };
      });
    }

    try {
      const res = await fetch("/api/ai/trend-niche", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, pastVideoData }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") {
        onUpgradeRequired?.(data.feature);
      } else if (data.error) {
        setResult({ trends: [], nicheInsight: "", performancePatterns: [], niche: "", error: data.error });
      } else {
        setResult(data);
      }
    } catch {
      setResult({ trends: [], nicheInsight: "", performancePatterns: [], niche: "", error: "Failed to analyse niche. Try again." });
    }
    setLoading(false);
  };

  return (
    <>
      <button
        style={{ ...sBtnSm, background: "#ecfdf5", color: "#065f46", fontWeight: 600, opacity: loading ? 0.5 : 1 }}
        disabled={loading}
        onClick={run}
      >
        {loading ? "Analysing..." : "🎯 My Niche"}
      </button>

      {result && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setResult(null)}
        >
          <div
            style={{ background: co.surface, borderRadius: 16, padding: 24, width: 600, maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid " + co.border }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>🎯 Niche Trend Intelligence</h3>
                {result.niche && <div style={{ fontSize: 12, color: co.muted, marginTop: 2 }}>Niche: {result.niche}</div>}
              </div>
              <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 18 }} onClick={() => setResult(null)}>×</button>
            </div>

            {result.error ? (
              <div style={{ color: co.danger, fontSize: 13, padding: "12px", background: "#fef2f2", borderRadius: 8 }}>{result.error}</div>
            ) : (
              <>
                {/* Niche insight */}
                {result.nicheInsight && (
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: "#065f46", lineHeight: 1.6 }}>
                    {result.nicheInsight}
                  </div>
                )}

                {/* Trend cards */}
                <div style={{ fontSize: 13, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Niche-Specific Trends</div>
                {result.trends?.map((t, i) => (
                  <div key={i} style={{ background: co.surfaceAlt, borderRadius: 10, padding: 12, marginBottom: 8, border: "1px solid " + co.border }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: co.text, flex: 1 }}>{t.topic}</div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: RESONANCE_COLOR[t.audienceResonance] || co.muted, marginLeft: 8, whiteSpace: "nowrap" }}>
                        {t.audienceResonance === "high" ? "🔥" : t.audienceResonance === "medium" ? "📈" : "📊"} {t.audienceResonance}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: co.muted, marginBottom: 4 }}>{t.angle}</div>
                    <div style={{ fontSize: 12, color: co.accent, fontStyle: "italic", marginBottom: 6 }}>Hook: "{t.exampleHook}"</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>{t.whyItFits}</div>
                    <button
                      style={{ ...sBtnSm, fontSize: 10, background: "#ecfdf5", color: "#065f46" }}
                      onClick={() => { setPrompt(t.exampleHook); setResult(null); }}
                    >
                      Use Hook
                    </button>
                  </div>
                ))}

                {/* Performance patterns */}
                {result.performancePatterns?.length > 0 && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "16px 0 8px" }}>Channel Performance Patterns</div>
                    {result.performancePatterns.map((p, i) => (
                      <div key={i} style={{ fontSize: 12, color: co.text, padding: "8px 12px", background: co.surfaceAlt, borderRadius: 8, marginBottom: 6, border: "1px solid " + co.border }}>
                        • {p}
                      </div>
                    ))}
                  </>
                )}

                {/* Paste past videos */}
                <div style={{ marginTop: 16, borderTop: "1px solid " + co.border, paddingTop: 12 }}>
                  <button
                    style={{ ...sBtnSm, background: "none", color: co.muted, fontSize: 11 }}
                    onClick={() => setShowPaste(v => !v)}
                  >
                    {showPaste ? "▲ Hide" : "▼ Add past video data for performance analysis"}
                  </button>
                  {showPaste && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Paste video titles and views (one per line, e.g. "Video title — 50000"):</div>
                      <textarea
                        style={{ width: "100%", height: 80, fontSize: 12, borderRadius: 6, border: "1px solid " + co.border, padding: "6px 8px", resize: "vertical", fontFamily: "inherit" }}
                        value={pastVideos}
                        onChange={e => setPastVideos(e.target.value)}
                        placeholder={"My best video — 120000\nAnother video — 45000"}
                      />
                      <button style={{ ...sBtnSm, marginTop: 6, background: "#065f46", color: "white" }} onClick={run} disabled={loading}>
                        {loading ? "Analysing..." : "Re-analyse with video data"}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button style={sBtnSm} onClick={() => setResult(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
