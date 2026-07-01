"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { co, sBtnSm } from "@/lib/styles";
import { studioDeepLink } from "@/lib/graph/studio-deeplink";
import type { GraphRunPlan } from "@/lib/graph/graph-program";

const ConstellationView = dynamic(
  () => import("@/components/ConstellationView").then(m => ({ default: m.ConstellationView })),
  { ssr: false }
);

type Pane = "graph" | "pipelines" | "analytics" | "exports";

const PANES: { id: Pane; label: string }[] = [
  { id: "graph", label: "Graph" },
  { id: "pipelines", label: "Pipelines" },
  { id: "analytics", label: "Analytics" },
  { id: "exports", label: "Exports" },
];

export default function StudioShell({ projectId }: { projectId: string }) {
  const [pane, setPane] = useState<Pane>("graph");
  const router = useRouter();

  const onRunCapability = (plan: GraphRunPlan) => {
    const url = studioDeepLink(projectId, plan.action);
    if (url) router.push(url);
  };

  return (
    <div style={{ minHeight: "100vh", background: co.bg, padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: co.text }}>Studio</div>
          <Link href={`/project/${projectId}`} style={{ fontSize: 12, color: co.muted, textDecoration: "none" }}>
            ← Back to writing room
          </Link>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16, borderBottom: `1px solid ${co.border}`, paddingBottom: 10 }}>
          {PANES.map(p => (
            <button
              key={p.id}
              onClick={() => setPane(p.id)}
              style={{
                ...sBtnSm,
                background: pane === p.id ? co.accentBg : "transparent",
                color: pane === p.id ? co.accent : co.muted,
                border: pane === p.id ? `1px solid ${co.accent}` : `1px solid ${co.border}`,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {pane === "graph" && (
          <ConstellationView projectId={projectId} height={640} onRunCapability={onRunCapability} />
        )}
        {pane === "pipelines" && (
          <div style={{ padding: 40, textAlign: "center", color: co.muted, fontSize: 13 }}>
            Pipelines — coming soon. Select nodes on the Graph pane to run capabilities today.
          </div>
        )}
        {pane === "analytics" && (
          <div style={{ padding: 40, textAlign: "center", color: co.muted, fontSize: 13 }}>
            Analytics — coming soon.
          </div>
        )}
        {pane === "exports" && (
          <div style={{ padding: 40, textAlign: "center", color: co.muted, fontSize: 13 }}>
            Exports — coming soon. Use the Export stage in the writing room for now.
          </div>
        )}
      </div>
    </div>
  );
}
