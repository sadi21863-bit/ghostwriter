"use client";
import { useState } from "react";
import { co, sBtn, sBtnSm, sInput } from "@/lib/styles";

interface Props {
  format: string;
  onUpgradeRequired?: (feature: string) => void;
}

interface HookResult {
  hook: string;
  pattern: string;
  openLoop: string;
}

interface ScriptResult {
  hook: string;
  script: string;
  captionSuggestion: string;
  hashtagStack: string[];
  soundNote: string;
  estimatedSeconds: number;
}

export function TikTokNativePanel({ format, onUpgradeRequired }: Props) {
  const [show, setShow]         = useState(false);
  const [tab, setTab]           = useState<"hooks" | "script">("hooks");
  const [topic, setTopic]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [hooks, setHooks]       = useState<HookResult[]>([]);
  const [script, setScript]     = useState<ScriptResult | null>(null);
  const [copied, setCopied]     = useState<string | null>(null);

  if (!["TikTok Script", "TikTok Native"].includes(format)) return null;

  const run = async () => {
    if (!topic.trim() || loading) return;
    setLoading(true);
    setHooks([]);
    setScript(null);
    try {
      const res = await fetch("/api/ai/tiktok-native", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, mode: tab }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { onUpgradeRequired?.(data.feature); setShow(false); }
      else if (tab === "hooks") setHooks(data.hooks ?? []);
      else setScript(data);
    } catch { /* silent */ }
    setLoading(false);
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <>
      <button
        style={{ ...sBtnSm, background: show ? "#fce7f3" : co.surfaceAlt, color: show ? "#be185d" : co.muted, border: "1px solid " + (show ? "#be185d" : co.border) }}
        onClick={() => setShow(v => !v)}
      >
        🎵 TikTok Native
      </button>

      {show && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1500 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 24, width: 560, maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>🎵 TikTok Native</div>
              <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: co.muted }} onClick={() => setShow(false)}>×</button>
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {(["hooks", "script"] as const).map(t => (
                <button
                  key={t}
                  style={{ ...sBtnSm, flex: 1, background: tab === t ? "#fce7f3" : co.surfaceAlt, color: tab === t ? "#be185d" : co.muted, border: "1px solid " + (tab === t ? "#be185d" : co.border) }}
                  onClick={() => { setTab(t); setHooks([]); setScript(null); }}
                >
                  {t === "hooks" ? "Hook Generator" : "Full Script"}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 12, color: co.muted, marginBottom: 10 }}>
              {tab === "hooks"
                ? "Generates 5 scroll-stopping hook options using 12 native TikTok patterns."
                : "Full script with timing markers, beat drops, caption, and hashtag stack."}
            </div>

            <textarea
              style={{ width: "100%", minHeight: 72, padding: "8px 12px", border: "1px solid " + co.border, borderRadius: 8, fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
              placeholder={tab === "hooks" ? "What is your video about? (topic or angle)" : "Describe the full topic/angle for the script…"}
              value={topic}
              onChange={e => setTopic(e.target.value)}
            />

            <button
              style={{ ...sBtn, width: "100%", marginTop: 10, background: "#be185d", opacity: loading || !topic.trim() ? 0.5 : 1 }}
              disabled={loading || !topic.trim()}
              onClick={run}
            >
              {loading ? "Generating…" : tab === "hooks" ? "Generate 5 Hooks" : "Write Full Script"}
            </button>

            {hooks.length > 0 && (
              <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                {hooks.map((h, i) => (
                  <div key={i} style={{ padding: "12px 14px", background: co.surfaceAlt, borderRadius: 10, border: "1px solid " + co.border }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#be185d", textTransform: "uppercase", marginBottom: 4 }}>{h.pattern}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4, marginBottom: 6 }}>{h.hook}</div>
                    <div style={{ fontSize: 11, color: co.muted, marginBottom: 8 }}>❓ Open loop: {h.openLoop}</div>
                    <button style={{ ...sBtnSm, fontSize: 11 }} onClick={() => copy(h.hook, `hook-${i}`)}>
                      {copied === `hook-${i}` ? "✓ Copied!" : "Copy Hook"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {script && (
              <div style={{ marginTop: 18 }}>
                <div style={{ padding: "10px 14px", background: "#fce7f3", borderRadius: 8, marginBottom: 12, border: "1px solid #fbcfe8" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#be185d", marginBottom: 4 }}>OPENING HOOK</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{script.hook}</div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase" }}>Script · ~{script.estimatedSeconds}s</div>
                    <button style={{ ...sBtnSm, fontSize: 11 }} onClick={() => copy(script.script, "script")}>
                      {copied === "script" ? "✓ Copied!" : "Copy Script"}
                    </button>
                  </div>
                  <div style={{ padding: "12px 14px", background: co.surfaceAlt, borderRadius: 10, fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap", fontFamily: "inherit", border: "1px solid " + co.border }}>
                    {script.script}
                  </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", marginBottom: 4 }}>Caption</div>
                  <div style={{ fontSize: 12, padding: "8px 12px", background: co.surfaceAlt, borderRadius: 8 }}>{script.captionSuggestion}</div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", marginBottom: 4 }}>Sound</div>
                  <div style={{ fontSize: 12, color: "#be185d", fontStyle: "italic" }}>🎵 {script.soundNote}</div>
                </div>

                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", marginBottom: 6 }}>Hashtags</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {script.hashtagStack.map((tag, i) => (
                      <span key={i} style={{ fontSize: 11, padding: "3px 10px", background: "#fce7f3", color: "#be185d", borderRadius: 20, fontWeight: 600 }}>#{tag.replace(/^#/, "")}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
