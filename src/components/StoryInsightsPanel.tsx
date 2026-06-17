"use client";
import { useState } from "react";
import { co, sBtnSm } from "@/lib/styles";
import { ArcHeatMap } from "@/components/ArcHeatMap";
import { TensionCurve } from "@/components/TensionCurve";
import { ConstellationView } from "@/components/ConstellationView";

interface Props {
  projectId: string;
}

type Tab = "arc" | "tension" | "relationships";

const TABS: { id: Tab; label: string }[] = [
  { id: "arc", label: "Character Arc" },
  { id: "tension", label: "Tension Curve" },
  { id: "relationships", label: "Relationships" },
];

export function StoryInsightsPanel({ projectId }: Props) {
  const [tab, setTab] = useState<Tab>("arc");

  return (
    <div style={{ padding: "10px 12px", background: co.surface, border: `1px solid ${co.border}`, borderRadius: 8 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              ...sBtnSm,
              fontSize: 11,
              background: tab === t.id ? co.accent : "transparent",
              color: tab === t.id ? "#fff" : co.muted,
              border: `1px solid ${tab === t.id ? co.accent : co.border}`,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "arc" && <ArcHeatMap projectId={projectId} />}
      {tab === "tension" && <TensionCurve projectId={projectId} />}
      {tab === "relationships" && <ConstellationView projectId={projectId} />}
    </div>
  );
}
