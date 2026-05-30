"use client";
import { useState } from "react";
import { CRAFT_LIBRARY } from "@/lib/craft-library";

type Props = { activeMode: string };

export function CraftLibraryPanel({ activeMode }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const entries = showAll
    ? CRAFT_LIBRARY
    : CRAFT_LIBRARY.filter(e => e.libraryMode === activeMode);

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div style={{ padding: "12px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#9898A6" }}>
          📚 Craft Library
        </span>
        <button
          onClick={() => setShowAll(v => !v)}
          style={{ fontSize: 10, color: "#9898A6", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          {showAll ? "Current mode" : "Show all"}
        </button>
      </div>

      {entries.length === 0 && (
        <div style={{ padding: "16px", fontSize: 12, color: "#5C5C6B", textAlign: "center", lineHeight: 1.6 }}>
          No craft entries for this mode yet.
          <br />
          <button onClick={() => setShowAll(true)} style={{ marginTop: 8, background: "none", border: "none", color: "#D97706", cursor: "pointer", fontSize: 12 }}>
            Browse all libraries →
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {entries.map((entry, i) => {
          const key = `${entry.libraryMode}-${i}`;
          const isOpen = expanded.has(key);
          const firstSentence = entry.coreInsight.split(". ")[0] + ".";

          return (
            <div key={key} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <button
                onClick={() => toggle(key)}
                style={{
                  width: "100%", textAlign: "left", background: "none", border: "none",
                  padding: "10px 16px", cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 10, color: "#D97706", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
                  {entry.libraryMode}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#F2F2F3", marginBottom: 4, lineHeight: 1.4 }}>
                  {entry.theorist.split(" — ")[0]}
                </div>
                <div style={{ fontSize: 11, color: "#9898A6", lineHeight: 1.5 }}>
                  {isOpen ? "" : firstSentence}
                </div>
                <div style={{ fontSize: 10, color: "#5C5C6B", marginTop: 2 }}>
                  {isOpen ? "▲ Collapse" : "▼ Expand"}
                </div>
              </button>

              {isOpen && (
                <div style={{ padding: "0 16px 14px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ fontSize: 11, color: "#9898A6", marginBottom: 10, fontStyle: "italic", lineHeight: 1.5 }}>
                    {entry.theorist}
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#D97706", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Core Insight</div>
                    <div style={{ fontSize: 12, color: "#F2F2F3", lineHeight: 1.65 }}>{entry.coreInsight}</div>
                  </div>

                  <div style={{ background: "rgba(217,119,6,0.06)", borderLeft: "2px solid #D97706", padding: "8px 10px", borderRadius: "0 4px 4px 0", marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#D97706", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                      {entry.fictionExample.work} — {entry.fictionExample.author}
                    </div>
                    <div style={{ fontSize: 11, color: "#9898A6", lineHeight: 1.6 }}>{entry.fictionExample.howItApplies}</div>
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Writing Rule</div>
                    <div style={{ fontSize: 12, color: "#F2F2F3", lineHeight: 1.65 }}>{entry.writingRule}</div>
                  </div>

                  <div style={{ fontSize: 10, color: "#5C5C6B", lineHeight: 1.5, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 8 }}>
                    <span style={{ fontWeight: 600 }}>Further reading: </span>{entry.furtherReading}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
