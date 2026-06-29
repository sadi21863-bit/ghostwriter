"use client";
import { useEffect, useState } from "react";
import { co, sBtnSm } from "@/lib/styles";
import { toast } from "@/lib/toast";
import type { GenerationMode } from "@/lib/modes/registry";
import type { FunnelStage } from "@/lib/guide/funnel";
import { FUNNEL_LABELS } from "@/lib/guide/funnel";
import type { Capability, CapabilityAvailability, CapabilityRole } from "@/lib/capabilities/registry";
import { capabilityAction } from "@/lib/capabilities/actions";

type AnnotatedCapability = Capability & CapabilityAvailability;
type Envelope = { stages: Record<FunnelStage, Record<CapabilityRole, AnnotatedCapability[]>> };

const ROLE_ROWS: { role: CapabilityRole; label: string }[] = [
  { role: "director", label: "📋 Plan" },
  { role: "writer", label: "✍️ Generate" },
  { role: "editor", label: "🔎 Review" },
];

interface StageRoleRailProps {
  funnelStage: FunnelStage;
  format: string;
  onSelectMode: (mode: GenerationMode) => void;
  onOpenActions: () => void;
  onOpenComicStudio: () => void;
  onOpenProductionStudio: () => void;
  onUpgradeRequired: (feature: string) => void;
}

export default function StageRoleRail({
  funnelStage, format,
  onSelectMode, onOpenActions, onOpenComicStudio, onOpenProductionStudio, onUpgradeRequired,
}: StageRoleRailProps) {
  const [envelope, setEnvelope] = useState<Envelope | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/capabilities?format=${encodeURIComponent(format)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (!cancelled && data?.envelope) setEnvelope(data.envelope); })
      .catch(() => { /* fetch failure → render nothing; stage views still work */ });
    return () => { cancelled = true; };
  }, [format]);

  if (!envelope) return null;
  const byRole = envelope.stages[funnelStage];
  if (!byRole) return null;

  const handle = (cap: AnnotatedCapability) => {
    const action = capabilityAction(cap, { available: cap.available, reason: cap.reason });
    switch (action.type) {
      case "selectMode": onSelectMode(action.mode as GenerationMode); break;
      case "openComicStudio": onOpenComicStudio(); break;
      case "openProductionStudio": onOpenProductionStudio(); break;
      case "openActions": onOpenActions(); break;
      case "upgrade": onUpgradeRequired(action.gate); break;
      case "hint":
        toast.info(action.reason === "missing_segmind_key"
          ? "Add your Segmind API key in Settings to use this."
          : "Add your OpenAI API key in Settings to use this.");
        break;
      case "noop": break;
    }
  };

  const rows = ROLE_ROWS
    .map(r => ({ ...r, caps: (byRole[r.role] ?? []).filter(c => c.reason !== "not_applicable_for_format") }))
    .filter(r => r.caps.length > 0);

  if (rows.length === 0) return null;

  return (
    <div style={{ border: `1px solid ${co.border}`, borderRadius: 10, background: co.surface, padding: "10px 12px", margin: "0 0 12px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
        What you can do in {FUNNEL_LABELS[funnelStage]}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map(({ role, label, caps }) => (
          <div key={role} style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: co.text, minWidth: 84 }}>{label}</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {caps.map(cap => (
                <button
                  key={cap.id}
                  title={cap.available ? cap.label : reasonLabel(cap.reason)}
                  onClick={() => handle(cap)}
                  style={{
                    ...sBtnSm,
                    opacity: cap.available ? 1 : 0.5,
                    borderStyle: cap.available ? "solid" : "dashed",
                    color: cap.available ? co.text : co.muted,
                  }}
                >
                  {cap.label}{cap.available ? "" : cap.reason === "upgrade_required" ? " 🔒" : " ⚙️"}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function reasonLabel(reason?: CapabilityAvailability["reason"]): string {
  switch (reason) {
    case "upgrade_required": return "Upgrade to unlock";
    case "missing_segmind_key": return "Add your Segmind key in Settings";
    case "missing_openai_key": return "Add your OpenAI key in Settings";
    default: return "";
  }
}
