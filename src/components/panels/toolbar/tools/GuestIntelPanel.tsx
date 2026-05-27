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

/** Guest Intel button (toolbar) + modal. Owns its own state. */
export function GuestIntelPanel({ format, mode, prompt, topic, setSavedMsg, updateProject, onUpgradeRequired }: Props) {
  const [guestIntel, setGuestIntel] = useState<any>(null);
  const [guestLoading, setGuestLoading] = useState(false);

  const visible = format === "Podcast Episode" && (mode === "brainstorm" || mode === "cohost") && prompt.trim().length > 0;
  if (!visible) return null;

  const run = async () => {
    if (!prompt.trim() || guestLoading) return;
    setGuestLoading(true);
    setGuestIntel(null);
    try {
      const res = await fetch("/api/ai/guest-intel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestName: prompt, topic }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { onUpgradeRequired?.(data.feature); }
      else if (data.intel) setGuestIntel(data.intel);
      else if (data.error) setGuestIntel({ error: data.error });
    } catch { /* silent */ }
    setGuestLoading(false);
  };

  return (
    <>
      <button
        style={{ ...sBtnSm, background: "#fdf4ff", color: "#7e22ce", fontWeight: 600, opacity: guestLoading ? 0.5 : 1 }}
        disabled={guestLoading}
        onClick={run}
      >
        {guestLoading ? "Researching..." : "🎙 Guest Intel"}
      </button>

      {/* Guest Intel Modal */}
      {guestIntel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setGuestIntel(null)}>
          <div style={{ background: co.surface, borderRadius: 16, padding: 24, width: 620, maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid " + co.border }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>🎙 Guest Intel: {prompt}</h3>
              <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 18 }} onClick={() => setGuestIntel(null)}>×</button>
            </div>
            {guestIntel.error
              ? <div style={{ color: co.danger, fontSize: 13 }}>{guestIntel.error}</div>
              : <>
                {guestIntel.background && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: co.accent, textTransform: "uppercase", marginBottom: 4 }}>Background</div>
                    <div style={{ fontSize: 12, lineHeight: 1.6, color: co.text }}>{guestIntel.background}</div>
                  </div>
                )}
                {guestIntel.recentWork?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#15803d", textTransform: "uppercase", marginBottom: 4 }}>Recent Work</div>
                    {guestIntel.recentWork.map((w: string, i: number) => <div key={i} style={{ fontSize: 12, background: "#f0fdf4", borderRadius: 4, padding: "4px 8px", marginBottom: 2 }}>• {w}</div>)}
                  </div>
                )}
                {guestIntel.strongOpinions?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#d97706", textTransform: "uppercase", marginBottom: 4 }}>Strong Opinions</div>
                    {guestIntel.strongOpinions.map((o: string, i: number) => <div key={i} style={{ fontSize: 12, background: "#fffbeb", borderRadius: 4, padding: "4px 8px", marginBottom: 2 }}>⚡ {o}</div>)}
                  </div>
                )}
                {guestIntel.questions?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: co.accent, textTransform: "uppercase", marginBottom: 4 }}>Questions to Ask</div>
                    {guestIntel.questions.map((q: string, i: number) => <div key={i} style={{ background: co.accentBg, borderRadius: 6, padding: "8px 10px", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Q{i + 1}: {q}</div>)}
                  </div>
                )}
                {guestIntel.topicsToAvoid?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: co.danger, textTransform: "uppercase", marginBottom: 4 }}>Avoid</div>
                    {guestIntel.topicsToAvoid.map((t: string, i: number) => <div key={i} style={{ fontSize: 12, background: "#fef2f2", borderRadius: 4, padding: "4px 8px", marginBottom: 2 }}>✕ {t}</div>)}
                  </div>
                )}
              </>
            }
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
              <button style={sBtnSm} onClick={() => setGuestIntel(null)}>Close</button>
              {!guestIntel.error && (
                <button style={sBtn} onClick={() => {
                  const text = `Guest: ${prompt}\n\nQuestions:\n${guestIntel.questions?.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n") || ""}${guestIntel.topicsToAvoid?.length ? "\n\nAvoid: " + guestIntel.topicsToAvoid.join(", ") : ""}`;
                  updateProject((p: any) => ({ ...p, notes: (p.notes || "") + (p.notes ? "\n---\n" : "") + "[GUEST INTEL]\n" + text }));
                  setSavedMsg("Saved to Notes"); setTimeout(() => setSavedMsg(""), 1500);
                  setGuestIntel(null);
                }}>Save to Notes</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
