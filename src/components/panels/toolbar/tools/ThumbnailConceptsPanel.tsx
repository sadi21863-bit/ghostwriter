"use client";
import { useState } from "react";
import { co, sBtn, sBtnSm, sInput } from "@/lib/styles";

interface Concept {
  conceptName: string;
  emotionalHook: string;
  foreground: string;
  background: string;
  textOverlay: string;
  textPosition: string;
  colourPalette: string;
  facialExpression: string;
  whyItWorks: string;
}

interface Props {
  format: string;
  onUpgradeRequired?: (feature: string) => void;
}

export function ThumbnailConceptsPanel({ format, onUpgradeRequired }: Props) {
  const [show, setShow] = useState(false);
  const [videoTitle, setVideoTitle] = useState("");
  const [contentSummary, setContentSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [concepts, setConcepts] = useState<Concept[]>([]);

  const generate = async () => {
    if (!videoTitle.trim() || loading) return;
    setLoading(true);
    setConcepts([]);
    try {
      const res = await fetch("/api/ai/thumbnail-concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoTitle, contentSummary, format }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") {
        onUpgradeRequired?.(data.feature);
        setShow(false);
      } else {
        setConcepts(data.concepts ?? []);
      }
    } catch {
      // silent
    }
    setLoading(false);
  };

  if (!["YouTube Long-form", "YouTube Short"].includes(format)) return null;

  return (
    <>
      <button
        style={{ ...sBtnSm, background: show ? co.accentBg : co.surfaceAlt, color: show ? co.accent : co.muted, border: "1px solid " + (show ? co.accent : co.border) }}
        onClick={() => setShow(v => !v)}
      >
        🖼 Thumbnails
      </button>

      {show && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1500 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 24, width: 580, maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>🖼 Thumbnail Concepts</div>
              <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: co.muted }} onClick={() => setShow(false)}>×</button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Video Title</div>
              <input
                style={sInput}
                placeholder="Your exact video title..."
                value={videoTitle}
                onChange={e => setVideoTitle(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: co.muted, marginBottom: 4 }}>Content Summary (optional)</div>
              <textarea
                style={{ width: "100%", minHeight: 60, padding: "8px 12px", border: "1px solid " + co.border, borderRadius: 8, fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                placeholder="Brief summary of what the video covers..."
                value={contentSummary}
                onChange={e => setContentSummary(e.target.value)}
              />
            </div>

            <button
              style={{ ...sBtn, width: "100%", opacity: loading || !videoTitle.trim() ? 0.5 : 1 }}
              disabled={loading || !videoTitle.trim()}
              onClick={generate}
            >
              {loading ? "Generating 3 Concepts..." : "Generate 3 Thumbnail Concepts"}
            </button>

            {concepts.length > 0 && (
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                {concepts.map((c, i) => (
                  <div key={i} style={{ padding: "14px 16px", background: co.surfaceAlt, borderRadius: 12, border: "1px solid " + co.border }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{c.conceptName}</div>
                    <div style={{ fontSize: 11, color: co.accent, fontWeight: 600, marginBottom: 10 }}>{c.emotionalHook}</div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                      {[
                        ["Foreground", c.foreground],
                        ["Background", c.background],
                        ["Text Overlay", c.textOverlay],
                        ["Text Position", c.textPosition],
                        ["Colour Palette", c.colourPalette],
                        ["Facial Expression", c.facialExpression],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: co.muted, textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: 12 }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ padding: "8px 10px", background: "#f0fdf4", borderRadius: 6, borderLeft: "3px solid #10b981", fontSize: 11, color: "#065f46" }}>
                      {c.whyItWorks}
                    </div>
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
