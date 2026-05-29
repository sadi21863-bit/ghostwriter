"use client";
import { useState } from "react";
import { sBtnSm } from "@/lib/styles";

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

const TK_RED  = "#fe2c55";
const TK_CYAN = "#25f4ee";
const TK_BG   = "#0a0a0a";
const TK_CARD = "#161616";
const TK_BORDER = "#2a2a2a";
const TK_MUTED  = "#888";

const SOUND_OPTIONS = [
  { key: "Trending audio",  icon: "🔥", label: "Trending" },
  { key: "Original audio",  icon: "🎙️", label: "Original" },
  { key: "Voice-only",      icon: "🗣️", label: "Voice Only" },
  { key: "Mixed",           icon: "🎛️", label: "Mixed" },
];

const HOOK_COLORS = [TK_RED, TK_CYAN, "#a855f7", "#f59e0b", "#10b981"];

function formatScript(text: string) {
  return text.split("\n").map((line, i) => {
    const isTiming = /^\[[\d]+s\]/.test(line.trim());
    const isBeat   = /\[BEAT\s*DROP\]/i.test(line);
    if (isBeat) {
      return (
        <span key={i} style={{ display: "block", background: "linear-gradient(90deg,#fe2c5522,#25f4ee22)", borderLeft: `3px solid ${TK_CYAN}`, paddingLeft: 8, margin: "4px 0", color: TK_CYAN, fontWeight: 700 }}>
          {line}
        </span>
      );
    }
    if (isTiming) {
      return (
        <span key={i} style={{ display: "block", color: TK_CYAN, fontSize: 11, letterSpacing: 1, marginTop: 10, marginBottom: 2, opacity: 0.8 }}>
          {line}
        </span>
      );
    }
    return <span key={i} style={{ display: "block", lineHeight: 1.7 }}>{line || " "}</span>;
  });
}

export function TikTokNativePanel({ format, onUpgradeRequired }: Props) {
  const [show, setShow]           = useState(false);
  const [tab, setTab]             = useState<"hooks" | "script">("hooks");
  const [topic, setTopic]         = useState("");
  const [niche, setNiche]         = useState("");
  const [soundStrategy, setSoundStrategy] = useState("Voice-only");
  const [loading, setLoading]     = useState(false);
  const [hooks, setHooks]         = useState<HookResult[]>([]);
  const [script, setScript]       = useState<ScriptResult | null>(null);
  const [copied, setCopied]       = useState<string | null>(null);
  const [genError, setGenError]   = useState<string | null>(null);

  if (!["TikTok Script", "TikTok Native"].includes(format)) return null;

  const run = async () => {
    if (!topic.trim() || loading) return;
    setLoading(true);
    setHooks([]);
    setScript(null);
    setGenError(null);
    try {
      const res = await fetch("/api/ai/tiktok-native", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, niche: niche.trim() || undefined, soundStrategy, mode: tab }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { onUpgradeRequired?.(data.feature); setShow(false); }
      else if (data.error) setGenError(data.error);
      else if (tab === "hooks") setHooks(data.hooks ?? []);
      else setScript(data);
    } catch { setGenError("Generation failed. Please try again."); }
    setLoading(false);
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes tk-spin { to { transform: rotate(360deg); } }
        @keyframes tk-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes tk-slide-up { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .tk-grad-btn {
          background: linear-gradient(135deg, ${TK_RED} 0%, #c026d3 50%, ${TK_CYAN} 100%);
          background-size: 200% 200%;
          transition: background-position 0.4s, opacity 0.2s, transform 0.15s;
        }
        .tk-grad-btn:hover:not(:disabled) {
          background-position: right center;
          transform: translateY(-1px);
        }
        .tk-hook-card { animation: tk-slide-up 0.3s ease both; }
        .tk-hook-card:nth-child(1){animation-delay:0s}
        .tk-hook-card:nth-child(2){animation-delay:0.06s}
        .tk-hook-card:nth-child(3){animation-delay:0.12s}
        .tk-hook-card:nth-child(4){animation-delay:0.18s}
        .tk-hook-card:nth-child(5){animation-delay:0.24s}
        .tk-copy-btn { transition: all 0.15s; }
        .tk-copy-btn:hover { opacity: 0.8; transform: scale(0.97); }
        .tk-tab:hover { opacity: 0.9; }
        .tk-sound:hover { border-color: ${TK_RED} !important; }
      `}</style>

      <button
        style={{ ...sBtnSm, background: show ? "linear-gradient(135deg,#fe2c5522,#25f4ee22)" : undefined, color: show ? TK_RED : undefined, border: `1px solid ${show ? TK_RED : "#e2e8f0"}`, fontWeight: 600 }}
        onClick={() => setShow(v => !v)}
      >
        ♪ TikTok Native
      </button>

      {show && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1500 }}
          onClick={() => setShow(false)}
        >
          <div
            style={{ background: TK_BG, borderRadius: 20, width: 580, maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: `0 0 0 1px ${TK_BORDER}, 0 32px 80px rgba(0,0,0,0.8), 0 0 60px rgba(254,44,85,0.08)`, fontFamily: "'DM Sans', sans-serif" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header gradient bar */}
            <div style={{ height: 3, background: `linear-gradient(90deg, ${TK_RED}, #c026d3 50%, ${TK_CYAN})`, flexShrink: 0 }} />

            {/* Header */}
            <div style={{ padding: "20px 24px 0", flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 2, background: `linear-gradient(135deg, ${TK_RED}, ${TK_CYAN})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}>
                    TIKTOK NATIVE
                  </div>
                  <div style={{ fontSize: 12, color: TK_MUTED, marginTop: 4, letterSpacing: 0.3 }}>
                    {tab === "hooks" ? "Scroll-stopping hooks from 12 native patterns" : "Full script with timing, sound & caption"}
                  </div>
                </div>
                <button
                  style={{ background: TK_CARD, border: `1px solid ${TK_BORDER}`, borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: TK_MUTED, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                  onClick={() => setShow(false)}
                >
                  ×
                </button>
              </div>

              {/* Tab switcher */}
              <div style={{ display: "flex", background: TK_CARD, borderRadius: 10, padding: 4, marginTop: 18, border: `1px solid ${TK_BORDER}` }}>
                {(["hooks", "script"] as const).map(t => (
                  <button
                    key={t}
                    className="tk-tab"
                    style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s", background: tab === t ? `linear-gradient(135deg, ${TK_RED}cc, #c026d3cc)` : "transparent", color: tab === t ? "#fff" : TK_MUTED }}
                    onClick={() => { setTab(t); setHooks([]); setScript(null); }}
                  >
                    {t === "hooks" ? "⚡ Hook Generator" : "📝 Full Script"}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 24px" }}>

              {/* Topic input */}
              <textarea
                style={{ width: "100%", minHeight: 80, padding: "12px 14px", background: TK_CARD, border: `1px solid ${TK_BORDER}`, borderRadius: 10, fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif", color: "#fff", lineHeight: 1.6, transition: "border-color 0.2s" }}
                placeholder={tab === "hooks" ? "What's your video about? Be specific — the more detail, the sharper the hooks." : "Describe the angle, topic, and key point your script should land."}
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onFocus={e => (e.target.style.borderColor = TK_RED)}
                onBlur={e => (e.target.style.borderColor = TK_BORDER)}
              />

              {/* Niche + Sound row */}
              <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <input
                  style={{ flex: 1, padding: "10px 14px", background: TK_CARD, border: `1px solid ${TK_BORDER}`, borderRadius: 10, fontSize: 12, outline: "none", color: "#e2e8f0", fontFamily: "'DM Sans', sans-serif" }}
                  placeholder="Your niche (optional)"
                  value={niche}
                  onChange={e => setNiche(e.target.value)}
                />
              </div>

              {/* Sound strategy pills */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: TK_MUTED, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Sound Strategy</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {SOUND_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      className="tk-sound"
                      style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", transition: "all 0.2s", background: soundStrategy === opt.key ? `linear-gradient(135deg, ${TK_RED}33, ${TK_CYAN}22)` : TK_CARD, border: `1px solid ${soundStrategy === opt.key ? TK_RED : TK_BORDER}`, color: soundStrategy === opt.key ? "#fff" : TK_MUTED }}
                      onClick={() => setSoundStrategy(opt.key)}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate button */}
              <button
                className="tk-grad-btn"
                style={{ width: "100%", marginTop: 16, padding: "13px 0", border: "none", borderRadius: 10, cursor: loading || !topic.trim() ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2, opacity: loading || !topic.trim() ? 0.4 : 1 }}
                disabled={loading || !topic.trim()}
                onClick={run}
              >
                {loading ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "tk-spin 0.7s linear infinite" }} />
                    GENERATING...
                  </span>
                ) : tab === "hooks" ? "GENERATE 5 HOOKS" : "WRITE FULL SCRIPT"}
              </button>

              {genError && (
                <div style={{ marginTop: 12, fontSize: 12, color: TK_RED, padding: "10px 14px", background: "#1a0608", borderRadius: 8, border: `1px solid ${TK_RED}44` }}>{genError}</div>
              )}

              {/* Hook results */}
              {hooks.length > 0 && (
                <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: TK_MUTED, textTransform: "uppercase", letterSpacing: 1.2 }}>{hooks.length} Hooks Generated</div>
                  {hooks.map((h, i) => (
                    <div key={i} className="tk-hook-card" style={{ background: TK_CARD, borderRadius: 12, border: `1px solid ${TK_BORDER}`, overflow: "hidden" }}>
                      <div style={{ height: 2, background: HOOK_COLORS[i % HOOK_COLORS.length] }} />
                      <div style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: HOOK_COLORS[i % HOOK_COLORS.length], textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
                          {h.pattern}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", lineHeight: 1.45, marginBottom: 10 }}>
                          {h.hook}
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12, fontStyle: "italic", paddingLeft: 10, borderLeft: "2px solid #2a2a2a" }}>
                          Open loop: {h.openLoop}
                        </div>
                        <button
                          className="tk-copy-btn"
                          style={{ fontSize: 11, padding: "5px 14px", borderRadius: 6, border: `1px solid ${TK_BORDER}`, background: copied === `hook-${i}` ? `${HOOK_COLORS[i % HOOK_COLORS.length]}22` : "transparent", color: copied === `hook-${i}` ? HOOK_COLORS[i % HOOK_COLORS.length] : TK_MUTED, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
                          onClick={() => copy(h.hook, `hook-${i}`)}
                        >
                          {copied === `hook-${i}` ? "✓ Copied!" : "Copy"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Script result */}
              {script && (
                <div style={{ marginTop: 20, animation: "tk-slide-up 0.3s ease" }}>

                  {/* Opening hook */}
                  <div style={{ background: `linear-gradient(135deg, ${TK_RED}18, ${TK_CARD})`, border: `1px solid ${TK_RED}44`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: TK_RED, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>⚡ Opening Hook</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.4 }}>{script.hook}</div>
                  </div>

                  {/* Script body */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: TK_MUTED, textTransform: "uppercase", letterSpacing: 1.2 }}>
                        Full Script · ~{script.estimatedSeconds}s
                      </div>
                      <button
                        className="tk-copy-btn"
                        style={{ fontSize: 11, padding: "5px 14px", borderRadius: 6, border: `1px solid ${TK_BORDER}`, background: copied === "script" ? `${TK_CYAN}22` : "transparent", color: copied === "script" ? TK_CYAN : TK_MUTED, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
                        onClick={() => copy(script.script, "script")}
                      >
                        {copied === "script" ? "✓ Copied!" : "Copy Script"}
                      </button>
                    </div>
                    <div style={{ background: TK_CARD, borderRadius: 12, padding: "16px 18px", border: `1px solid ${TK_BORDER}`, fontSize: 13, color: "#cbd5e1", lineHeight: 1.7, fontFamily: "'DM Mono', 'Courier New', monospace" }}>
                      {formatScript(script.script)}
                    </div>
                  </div>

                  {/* Caption + Sound row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    <div style={{ background: TK_CARD, borderRadius: 10, padding: "12px 14px", border: `1px solid ${TK_BORDER}` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: TK_MUTED, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Caption</div>
                      <div style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.5 }}>{script.captionSuggestion}</div>
                    </div>
                    <div style={{ background: TK_CARD, borderRadius: 10, padding: "12px 14px", border: `1px solid ${TK_BORDER}` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: TK_MUTED, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Sound</div>
                      <div style={{ fontSize: 12, color: TK_CYAN, fontStyle: "italic" }}>♪ {script.soundNote}</div>
                    </div>
                  </div>

                  {/* Hashtags */}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: TK_MUTED, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Hashtags</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {script.hashtagStack.map((tag, i) => (
                        <span
                          key={i}
                          style={{ fontSize: 12, padding: "4px 12px", background: `linear-gradient(135deg, ${TK_RED}22, ${TK_CYAN}11)`, border: `1px solid ${TK_RED}33`, color: "#f1f5f9", borderRadius: 20, fontWeight: 500, cursor: "pointer" }}
                          onClick={() => copy("#" + tag.replace(/^#/, ""), `tag-${i}`)}
                          title="Click to copy"
                        >
                          #{tag.replace(/^#/, "")}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
