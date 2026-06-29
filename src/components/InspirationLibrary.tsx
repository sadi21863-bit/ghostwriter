"use client";
import { useState } from "react";
import { co, sBtnSm } from "@/lib/styles";
import { INSPIRATION_CATEGORIES } from "@/lib/resources/inspiration-sources";

const LICENSE_COLOR: Record<string, string> = {
  "Public Domain": co.green,
  "CC0": co.green,
  "CC / Public Domain": co.green,
  "Mixed CC": co.orange,
  "Tool": co.muted,
};

export default function InspirationLibrary() {
  const [open, setOpen] = useState(false);
  const [activeCat, setActiveCat] = useState(INSPIRATION_CATEGORIES[0].id);
  const cat = INSPIRATION_CATEGORIES.find(c => c.id === activeCat) ?? INSPIRATION_CATEGORIES[0];

  return (
    <div style={{ border: `1px solid ${co.border}`, borderRadius: 10, background: co.surface, marginTop: 20 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: "12px 14px", fontFamily: "inherit" }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1 }}>
          💡 Inspiration Library
        </span>
        <span style={{ fontSize: 12, color: co.muted }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 14px 14px" }}>
          <p style={{ fontSize: 12, color: co.muted, lineHeight: 1.6, marginTop: 0, marginBottom: 10 }}>
            Public-domain and Creative-Commons sources for research and inspiration. Verify each work&apos;s specific license before reuse.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {INSPIRATION_CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setActiveCat(c.id)}
                style={{ ...sBtnSm, ...(c.id === activeCat ? { borderColor: co.accent, color: co.accent } : {}) }}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cat.sources.map(s => (
              <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer"
                style={{ display: "block", padding: "10px 12px", borderRadius: 8, border: `1px solid ${co.border}`, background: co.bg, textDecoration: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: co.accent }}>{s.name}</span>
                  <span style={{ fontSize: 9, padding: "1px 7px", borderRadius: 20, background: `${LICENSE_COLOR[s.license] ?? co.muted}1a`, color: LICENSE_COLOR[s.license] ?? co.muted }}>
                    {s.license}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: co.muted }}>↗</span>
                </div>
                <div style={{ fontSize: 12, color: co.text, marginTop: 3, lineHeight: 1.5 }}>{s.description}</div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
