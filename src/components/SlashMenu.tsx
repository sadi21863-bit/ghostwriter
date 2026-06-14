"use client";
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";
import { co } from "@/lib/styles";

interface SlashMenuProps {
  modes: GenerationMode[];
  onSelect: (mode: GenerationMode) => void;
}

export default function SlashMenu({ modes, onSelect }: SlashMenuProps) {
  return (
    <div style={{
      position: "absolute", bottom: "100%", left: 0, right: 0, marginBottom: 4,
      background: co.surface, border: `1px solid ${co.border}`, borderRadius: 8,
      maxHeight: 240, overflow: "auto", boxShadow: "0 -4px 20px rgba(0,0,0,0.15)", zIndex: 50,
    }}>
      {modes.length === 0 ? (
        <div style={{ padding: "10px 12px", fontSize: 12, color: co.muted }}>No matching commands</div>
      ) : (
        modes.map(m => {
          const config = MODE_REGISTRY[m];
          return (
            <button
              key={m}
              onMouseDown={(e) => { e.preventDefault(); onSelect(m); }}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                width: "100%", padding: "8px 12px", background: "none", border: "none",
                borderBottom: `1px solid ${co.border}`, cursor: "pointer", textAlign: "left",
                color: co.text, fontSize: 13,
              }}
            >
              <span>{config.label}</span>
              <span style={{ color: co.muted, fontSize: 12 }}>{config.slash}</span>
            </button>
          );
        })
      )}
    </div>
  );
}
