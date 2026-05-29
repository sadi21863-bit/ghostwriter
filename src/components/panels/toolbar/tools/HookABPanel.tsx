"use client";
import { useState } from "react";
import { co, sBtn, sBtnSm, sInput } from "@/lib/styles";

interface HookResult {
  archetype: string;
  hook: string;
  ctrScore: number;
  reasoning: string;
  targetEmotion: string;
}

interface ABResult {
  hookA: { archetype: string; hook: string; targetAudience: string; ctrScore: number };
  hookB: { archetype: string; hook: string; targetAudience: string; ctrScore: number };
}

interface Props {
  format: string;
  projectId?: string;
  onUpgradeRequired?: (feature: string) => void;
}

const EMOTION_COLORS: Record<string, string> = {
  curiosity:  "#3b82f6",
  fear:       "#ef4444",
  surprise:   "#8b5cf6",
  desire:     "#ec4899",
  validation: "#10b981",
  ambition:   "#f59e0b",
};

export function HookABPanel({ format, projectId, onUpgradeRequired }: Props) {
  const [show, setShow]               = useState(false);
  const [contentSummary, setSummary]  = useState("");
  const [abMode, setAbMode]           = useState(false);
  const [loading, setLoading]         = useState(false);
  const [hooks, setHooks]             = useState<HookResult[]>([]);
  const [abResult, setAbResult]       = useState<ABResult | null>(null);
  const [warning, setWarning]         = useState<string | null>(null);
  const [copied, setCopied]           = useState<string | null>(null);

  const generate = async () => {
    if (!contentSummary.trim() || loading) return;
    setLoading(true);
    setHooks([]);
    setAbResult(null);
    setWarning(null);
    try {
      const res = await fetch("/api/ai/hook-ab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentSummary, format, projectId, mode: abMode ? "ab" : "standard" }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") {
        onUpgradeRequired?.(data.feature);
        setShow(false);
      } else if (abMode) {
        setAbResult(data);
      } else {
        setHooks(data.hooks ?? []);
        setWarning(data.overusedWarning ?? null);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
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
          <div style={{ background: "#fff", borderRadius: 14, padding: 24, width: 580, maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>🎯 Hook Intelligence</div>
              <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: co.muted }} onClick={() => setShow(false)}>×</button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button
                style={{ ...sBtnSm, flex: 1, background: !abMode ? co.accentBg : co.surfaceAlt, color: !abMode ? co.accent : co.muted, border: "1px solid " + (!abMode ? co.accent : co.border) }}
                onClick={() => setAbMode(false)}
              >
                5 Hook Variants
              </button>
              <button
                style={{ ...sBtnSm, flex: 1, background: abMode ? co.accentBg : co.surfaceAlt, color: abMode ? co.accent : co.muted, border: "1px solid " + (abMode ? co.accent : co.border) }}
                onClick={() => setAbMode(true)}
              >
                A/B Gain vs Avoid
              </button>
            </div>

            <div style={{ fontSize: 12, color: co.muted, marginBottom: 10 }}>
              {abMode
                ? "Generates two opposing hooks: one for viewers who want to gain, one for viewers who want to avoid."
                : "12-archetype hook engine. Avoids over-used patterns based on your hook history."}
            </div>

            <textarea
              style={{ width: "100%", minHeight: 80, padding: "8px 12px", border: "1px solid " + co.border, borderRadius: 8, fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
              placeholder="Paste a one-paragraph summary of your video..."
              value={contentSummary}
              onChange={e => setSummary(e.target.value)}
            />

            <button
              style={{ ...sBtn, width: "100%", marginTop: 10, opacity: loading || !contentSummary.trim() ? 0.5 : 1 }}
              disabled={loading || !contentSummary.trim()}
              onClick={generate}
            >
              {loading ? "Generating..." : abMode ? "Generate A/B Pair" : "Generate 5 Hooks"}
            </button>

            {warning && (
              <div style={{ marginTop: 12, padding: "8px 12px", background: "#fffbeb", borderRadius: 8, border: "1px solid #fbbf24", fontSize: 12, color: "#92400e" }}>
                ⚠️ {warning}
              </div>
            )}

            {hooks.length > 0 && (
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {hooks.map((h, i) => (
                  <div key={i} style={{ padding: "12px 14px", background: co.surfaceAlt, borderRadius: 10, border: "1px solid " + co.border }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase" }}>{h.archetype}</div>
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
                    <button style={{ ...sBtnSm, fontSize: 11 }} onClick={() => copy(h.hook, `hook-${i}`)}>
                      {copied === `hook-${i}` ? "✓ Copied!" : "Copy Hook"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {abResult && (
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "A — GAIN (aspiration/curiosity)", color: "#10b981", data: abResult.hookA },
                  { label: "B — AVOID (loss/fear)",          color: "#ef4444", data: abResult.hookB },
                ].map(({ label, color, data }, i) => (
                  <div key={i} style={{ padding: "14px", background: co.surfaceAlt, borderRadius: 10, border: `1px solid ${color}44` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 10, color: co.muted, marginBottom: 6 }}>Archetype: {data.archetype} · CTR: {data.ctrScore}/10</div>
                    <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, marginBottom: 6 }}>{data.hook}</div>
                    <div style={{ fontSize: 11, color: co.muted, marginBottom: 10 }}>{data.targetAudience}</div>
                    <button style={{ ...sBtnSm, fontSize: 11 }} onClick={() => copy(data.hook, `ab-${i}`)}>
                      {copied === `ab-${i}` ? "✓ Copied!" : "Copy Hook"}
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
