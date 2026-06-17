"use client";
import { co, sBtnSm } from "@/lib/styles";
import type { WorkPacket } from "@/lib/ai/influence-context";

interface Props {
  packet: WorkPacket;
  activeMode: string;
  onDismiss: () => void;
}

export default function CraftDepthChip({ packet, activeMode, onDismiss }: Props) {
  const principle =
    packet.craftPrinciples.find((p) => p.applicableTo?.includes(activeMode)) ??
    packet.craftPrinciples[0];

  const raw = principle?.principle ?? "";
  const truncated = raw.length > 60 ? raw.slice(0, 60).trimEnd() + "…" : raw;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      background: co.accentBg, border: `1px solid ${co.border}`, borderRadius: 8,
      padding: "6px 12px", fontSize: 12,
    }}>
      <span title={raw} style={{ color: co.text }}>
        <span style={{ color: co.muted }}>Craft influence: </span>
        <strong>✦ {packet.title}</strong>
        {truncated && <> — {truncated}</>}
      </span>
      <button
        style={{ ...sBtnSm, background: "transparent", border: "none", fontSize: 14, padding: "0 4px", flexShrink: 0 }}
        onClick={onDismiss}
        aria-label="Dismiss craft influence"
      >
        ×
      </button>
    </div>
  );
}
