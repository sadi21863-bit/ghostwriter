"use client";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import type { GuideAction } from "@/lib/guide/next-action";

export function GuideBar({ action, onRun, onDismiss }: {
  action: GuideAction | null;
  onRun: (action: GuideAction) => void;
  onDismiss: (id: string) => void;
}) {
  if (!action) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      background: co.accentBg, borderBottom: `1px solid ${co.border}`,
      padding: "10px 16px", flexShrink: 0,
    }}>
      <span style={{ fontSize: 13, color: co.text }}>{action.message}</span>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        <button style={sBtn} onClick={() => onRun(action)}>{action.cta}</button>
        <button
          style={{ ...sBtnSm, background: "transparent", border: "none", fontSize: 16, padding: "0 4px" }}
          onClick={() => onDismiss(action.id)}
          aria-label="Dismiss suggestion"
        >
          ×
        </button>
      </div>
    </div>
  );
}
