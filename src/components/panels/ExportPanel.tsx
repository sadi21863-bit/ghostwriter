"use client";
import { useState } from "react";

interface ExportPanelProps {
  projectId: string;
  onClose: () => void;
}

export function ExportPanel({ projectId, onClose }: ExportPanelProps) {
  const [tab, setTab] = useState<"query-letter" | "blurb">("query-letter");

  // Query Letter state
  const [targetAgent, setTargetAgent] = useState("");
  const [generatingQL, setGeneratingQL] = useState(false);
  const [queryLetter, setQueryLetter] = useState("");
  const [qlError, setQlError] = useState("");
  const [qlCopied, setQlCopied] = useState(false);

  // Blurb state
  const [generatingBlurb, setGeneratingBlurb] = useState(false);
  const [blurb, setBlurb] = useState("");
  const [taglines, setTaglines] = useState<string[]>([]);
  const [blurbError, setBlurbError] = useState("");
  const [blurbCopied, setBlurbCopied] = useState(false);

  const generateQueryLetter = async () => {
    setGeneratingQL(true); setQlError(""); setQueryLetter("");
    try {
      const res = await fetch(`/api/projects/${projectId}/export/query-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetAgent }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setQlError("Upgrade to Story Pro to use Export."); }
      else if (data.error) { setQlError(data.error); }
      else { setQueryLetter(data.queryLetter); }
    } catch { setQlError("Generation failed. Try again."); }
    setGeneratingQL(false);
  };

  const generateBlurb = async () => {
    setGeneratingBlurb(true); setBlurbError(""); setBlurb(""); setTaglines([]);
    try {
      const res = await fetch(`/api/projects/${projectId}/export/blurb`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setBlurbError("Upgrade to Story Pro to use Export."); }
      else if (data.error) { setBlurbError(data.error); }
      else { setBlurb(data.blurb); setTaglines(data.taglines || []); }
    } catch { setBlurbError("Generation failed. Try again."); }
    setGeneratingBlurb(false);
  };

  const copy = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text).then(() => {
      setter(true);
      setTimeout(() => setter(false), 2000);
    });
  };

  const darkInput: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
    background: "#111113", color: "#F2F2F3", fontSize: 13, boxSizing: "border-box",
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 400,
    background: active ? "#2a2a30" : "transparent", color: active ? "#F2F2F3" : "#9898A6",
  });

  const btn = (loading: boolean, color = "#5b4ccc"): React.CSSProperties => ({
    padding: "9px 18px", borderRadius: 8, border: "none", cursor: loading ? "not-allowed" : "pointer",
    background: loading ? "#333" : color, color: "#fff", fontSize: 13, fontWeight: 500,
  });

  const errorBox = (msg: string) => msg ? (
    <div style={{ padding: "10px 14px", background: "#2a1010", borderRadius: 8, color: "#f87171", fontSize: 13, marginTop: 12 }}>{msg}</div>
  ) : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200 }}>
      <div style={{ background: "#18181B", borderRadius: 14, width: 680, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 0" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#F2F2F3" }}>Export & Publishing</div>
            <div style={{ fontSize: 12, color: "#9898A6", marginTop: 2 }}>Generate professional publishing materials from your project</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#9898A6", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, padding: "14px 20px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => setTab("query-letter")} style={tabStyle(tab === "query-letter")}>Query Letter</button>
          <button onClick={() => setTab("blurb")} style={tabStyle(tab === "blurb")}>Back-Cover Blurb</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>

          {tab === "query-letter" && (
            <div>
              <p style={{ fontSize: 13, color: "#9898A6", margin: "0 0 14px" }}>
                Industry-standard query letter generated from your project data. Target a specific agent to personalise the opening.
              </p>
              <input
                value={targetAgent}
                onChange={e => setTargetAgent(e.target.value)}
                placeholder="Target agent name (optional — e.g. Janet Reid, Joanna Volpe)"
                style={{ ...darkInput, marginBottom: 12 }}
              />
              <button onClick={generateQueryLetter} disabled={generatingQL} style={btn(generatingQL)}>
                {generatingQL ? "Generating…" : "Generate Query Letter"}
              </button>
              {errorBox(qlError)}
              {queryLetter && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                    <button onClick={() => copy(queryLetter, setQlCopied)} style={{ padding: "6px 14px", borderRadius: 6, background: qlCopied ? "#22c55e" : "#2a2a30", border: "none", color: "#F2F2F3", fontSize: 12, cursor: "pointer" }}>
                      {qlCopied ? "✓ Copied" : "Copy to Clipboard"}
                    </button>
                  </div>
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.7, color: "#F2F2F3", background: "#111113", padding: "16px", borderRadius: 8, margin: 0 }}>
                    {queryLetter}
                  </pre>
                </div>
              )}
            </div>
          )}

          {tab === "blurb" && (
            <div>
              <p style={{ fontSize: 13, color: "#9898A6", margin: "0 0 14px" }}>
                150-word back-cover blurb + 3 tagline variants using genre-specific blurb conventions.
              </p>
              <button onClick={generateBlurb} disabled={generatingBlurb} style={btn(generatingBlurb)}>
                {generatingBlurb ? "Generating…" : "Generate Blurb & Taglines"}
              </button>
              {errorBox(blurbError)}
              {blurb && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#9898A6", textTransform: "uppercase", letterSpacing: "0.05em" }}>Back-Cover Blurb</div>
                    <button onClick={() => copy(blurb, setBlurbCopied)} style={{ padding: "6px 14px", borderRadius: 6, background: blurbCopied ? "#22c55e" : "#2a2a30", border: "none", color: "#F2F2F3", fontSize: 12, cursor: "pointer" }}>
                      {blurbCopied ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <div style={{ background: "#111113", padding: "14px 16px", borderRadius: 8, fontSize: 14, lineHeight: 1.7, color: "#F2F2F3", marginBottom: 16 }}>
                    {blurb}
                  </div>
                  {taglines.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#9898A6", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Taglines</div>
                      {taglines.map((t, i) => (
                        <div key={i} style={{ padding: "10px 14px", background: "#111113", borderRadius: 8, marginBottom: 6, fontSize: 13, color: "#F2F2F3", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontStyle: "italic" }}>{t}</span>
                          <button onClick={() => navigator.clipboard.writeText(t)} style={{ padding: "4px 10px", borderRadius: 5, background: "#2a2a30", border: "none", color: "#9898A6", fontSize: 11, cursor: "pointer", flexShrink: 0, marginLeft: 12 }}>
                            Copy
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
