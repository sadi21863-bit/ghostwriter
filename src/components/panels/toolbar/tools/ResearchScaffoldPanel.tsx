"use client";
import { useState } from "react";
import { co, sBtnSm, sBtn } from "@/lib/styles";

interface Props {
  format: string;
  mode: string;
  prompt: string;
  topic: string;
  setSavedMsg: (m: string) => void;
  updateProject: (fn: any) => void;
  onUpgradeRequired?: (feature: string) => void;
}

/** Research scaffold button (toolbar) + modal. Owns its own state. */
export function ResearchScaffoldPanel({ format, mode, prompt, topic, setSavedMsg, updateProject, onUpgradeRequired }: Props) {
  const [researchScaffold, setResearchScaffold] = useState<any>(null);
  const [researchLoading, setResearchLoading] = useState(false);

  const visible = format === "YouTube Long-form" && (mode === "brainstorm" || mode === "outline") && prompt.trim().length > 0;
  if (!visible) return null;

  const run = async () => {
    if (!prompt.trim() || researchLoading) return;
    setResearchLoading(true);
    setResearchScaffold(null);
    try {
      const res = await fetch("/api/ai/research-scaffold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic || prompt, angle: prompt }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { onUpgradeRequired?.(data.feature); }
      else if (data.scaffold) setResearchScaffold(data.scaffold);
      else if (data.error) setResearchScaffold({ error: data.error });
    } catch { /* silent */ }
    setResearchLoading(false);
  };

  return (
    <>
      <button
        style={{ ...sBtnSm, background: "#f0fdf4", color: "#15803d", fontWeight: 600, opacity: researchLoading ? 0.5 : 1 }}
        disabled={researchLoading}
        onClick={run}
      >
        {researchLoading ? "Researching..." : "🔬 Research"}
      </button>

      {/* Research Scaffold Modal */}
      {researchScaffold && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setResearchScaffold(null)}>
          <div style={{ background: co.surface, borderRadius: 16, padding: 24, width: 640, maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid " + co.border }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>🔬 Research Brief</h3>
              <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 18 }} onClick={() => setResearchScaffold(null)}>×</button>
            </div>
            {researchScaffold.error
              ? <div style={{ color: co.danger, fontSize: 13 }}>{researchScaffold.error}</div>
              : <>
                {researchScaffold.claims?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#15803d", textTransform: "uppercase", marginBottom: 6 }}>Supporting Claims</div>
                    {researchScaffold.claims.map((c: any, i: number) => (
                      <div key={i} style={{ background: "#f0fdf4", borderRadius: 6, padding: "8px 10px", marginBottom: 4, fontSize: 12 }}>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{c.claim}</div>
                        <div style={{ color: co.muted, fontSize: 10 }}>{c.source}</div>
                      </div>
                    ))}
                  </div>
                )}
                {researchScaffold.counterArguments?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: co.danger, textTransform: "uppercase", marginBottom: 6 }}>Counter-Arguments to Address</div>
                    {researchScaffold.counterArguments.map((a: string, i: number) => (
                      <div key={i} style={{ background: "#fef2f2", borderRadius: 6, padding: "6px 10px", marginBottom: 3, fontSize: 12 }}>⚡ {a}</div>
                    ))}
                  </div>
                )}
                {researchScaffold.quotes?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: co.accent, textTransform: "uppercase", marginBottom: 6 }}>Quotes & Expert Views</div>
                    {researchScaffold.quotes.map((q: string, i: number) => (
                      <div key={i} style={{ background: co.accentBg, borderRadius: 6, padding: "6px 10px", marginBottom: 3, fontSize: 12, fontStyle: "italic" }}>"{q}"</div>
                    ))}
                  </div>
                )}
                {researchScaffold.angles?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#d97706", textTransform: "uppercase", marginBottom: 6 }}>Fresh Angles</div>
                    {researchScaffold.angles.map((a: string, i: number) => (
                      <div key={i} style={{ background: "#fffbeb", borderRadius: 6, padding: "6px 10px", marginBottom: 3, fontSize: 12 }}>→ {a}</div>
                    ))}
                  </div>
                )}
              </>
            }
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
              <button style={sBtnSm} onClick={() => setResearchScaffold(null)}>Close</button>
              {!researchScaffold.error && (
                <button style={sBtn} onClick={() => {
                  const text = [
                    researchScaffold.claims?.map((c: any) => `• ${c.claim} (${c.source})`).join("\n"),
                    researchScaffold.counterArguments?.map((a: string) => `Counter: ${a}`).join("\n"),
                  ].filter(Boolean).join("\n\n");
                  updateProject((p: any) => ({ ...p, notes: (p.notes || "") + (p.notes ? "\n---\n" : "") + "[RESEARCH]\n" + text }));
                  setSavedMsg("Saved to Notes"); setTimeout(() => setSavedMsg(""), 1500);
                  setResearchScaffold(null);
                }}>Save to Notes</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
