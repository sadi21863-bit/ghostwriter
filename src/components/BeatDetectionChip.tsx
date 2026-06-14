"use client";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";

export default function BeatDetectionChip({ mode, onApply, onDismiss }: {
  mode: GenerationMode;
  onApply: () => void;
  onDismiss: () => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      background: co.accentBg, border: `1px solid ${co.border}`, borderRadius: 8,
      padding: "6px 12px", fontSize: 12,
    }}>
      <span style={{ color: co.text }}>
        Looks like a <strong>{MODE_REGISTRY[mode].label}</strong> beat — apply that library?
      </span>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
        <button style={sBtn} onClick={onApply}>Apply</button>
        <button
          style={{ ...sBtnSm, background: "transparent", border: "none", fontSize: 14, padding: "0 4px" }}
          onClick={onDismiss}
          aria-label="Dismiss suggestion"
        >
          ×
        </button>
      </div>
    </div>
  );
}
