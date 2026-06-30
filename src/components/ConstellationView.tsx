"use client";
import { useEffect, useState, useCallback } from "react";
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState,
} from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { selectionKinds, confirmMessageFor, isOptionActionable, blockedReasonText, nodeHealthAccent } from "@/lib/graph/graph-canvas";
import type { GraphRunPlan } from "@/lib/graph/graph-program";
import type { GraphHealthIssue, GraphHealthReport } from "@/lib/graph/graph-health";

type Props = {
  projectId: string;
  onSelectPair?: (aId: string, bId: string) => void;
  /** Host wires actual execution of a confirmed, available capability run. */
  onRunCapability?: (plan: GraphRunPlan) => void;
  /** Container height. Defaults to 500 (the original fixed-height embed used by
   * StoryInsightsPanel); Studio passes a larger value to fill its Graph pane. */
  height?: number | string;
};

const RELATIONSHIP_COLORS: Record<string, string> = {
  ally:     "#22c55e", enemy:    "#ef4444",
  rival:    "#f59e0b", romantic: "#ec4899",
  mentor:   "#6366f1", neutral:  "#6b7280",
  family:   "#14b8a6", "":       "#6b7280",
};

// Node styling per entity type — the multi-entity Story Graph (Phase 1 + world entities).
const NODE_TYPE_STYLE: Record<string, { bg: string; border: string; shape: number }> = {
  character:    { bg: "#1A1A1E", border: "#818cf8", shape: 8 },   // rounded rect
  location:     { bg: "#13201a", border: "#22c55e", shape: 20 },  // pill
  thread:       { bg: "#201a13", border: "#f59e0b", shape: 2 },   // sharp
  world_entity: { bg: "#1d1320", border: "#c084fc", shape: 6 },   // world element
};
const EDGE_KIND_STYLE: Record<string, { stroke: string; dashed?: boolean; label?: string }> = {
  appears_at: { stroke: "#22c55e", dashed: true, label: "at" },
  drives:     { stroke: "#f59e0b", dashed: true, label: "drives" },
  involves:   { stroke: "#c084fc", dashed: true, label: "involves" },
};

export function ConstellationView({ projectId, onSelectPair, onRunCapability, height = 500 }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selected, setSelected] = useState<{ id: string; type?: string }[]>([]);
  const [options, setOptions] = useState<GraphRunPlan[] | null>(null);
  const [loadingOpts, setLoadingOpts] = useState(false);
  const [health, setHealth] = useState<GraphHealthReport | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/story-graph`)
      .then(r => r.json())
      .then(data => {
        const all = data.nodes || [];
        const issuesByNode = new Map<string, GraphHealthIssue[]>();
        for (const issue of (data.health?.issues ?? []) as GraphHealthIssue[]) {
          const arr = issuesByNode.get(issue.nodeId) ?? [];
          arr.push(issue);
          issuesByNode.set(issue.nodeId, arr);
        }
        // Lay out each type on its own ring so the entity kinds are visually distinct.
        const byType: Record<string, any[]> = { character: [], location: [], thread: [], world_entity: [] };
        for (const n of all) (byType[n.type] ?? (byType[n.type] = [])).push(n);
        const RING: Record<string, { r: number; cx: number; cy: number }> = {
          location:     { r: 110, cx: 350, cy: 300 },
          character:    { r: 230, cx: 350, cy: 300 },
          thread:       { r: 360, cx: 350, cy: 300 },
          world_entity: { r: 470, cx: 350, cy: 300 },
        };
        const pos: Record<string, { x: number; y: number }> = {};
        for (const [type, list] of Object.entries(byType)) {
          const ring = RING[type] ?? RING.character;
          list.forEach((n, i) => {
            const ang = (2 * Math.PI * i) / Math.max(list.length, 1);
            pos[n.id] = { x: ring.cx + ring.r * Math.cos(ang), y: ring.cy + ring.r * Math.sin(ang) };
          });
        }

        const labelFor = (n: any) =>
          n.type === "thread" ? `🧵 ${n.name}`
          : n.type === "location" ? `📍 ${n.name}`
          : n.type === "world_entity" ? `✦ ${n.name}`
          : n.name;

        const rfNodes: Node[] = all.map((n: any) => {
          const st = NODE_TYPE_STYLE[n.type] ?? NODE_TYPE_STYLE.character;
          const accent = nodeHealthAccent(issuesByNode.get(n.id) ?? []);
          return {
            id: n.id,
            data: { label: labelFor(n), nodeType: n.type },
            position: pos[n.id] ?? { x: 350, y: 300 },
            style: {
              background: st.bg,
              border: accent ? `2px solid ${accent}` : `1px solid ${st.border}`,
              borderRadius: st.shape,
              padding: "8px 12px", fontSize: 12, color: "#F2F2F3",
              minWidth: 70, textAlign: "center" as const,
            },
          };
        });

        const rfEdges: Edge[] = (data.edges || []).map((e: any) => {
          if (e.kind === "relationship") {
            const trust = e.trustLevel ?? 50;
            const color = RELATIONSHIP_COLORS[e.relationshipType ?? ""] ?? "#6b7280";
            return {
              id: e.id, source: e.source, target: e.target,
              label: e.relationshipType || undefined,
              data: { kind: "relationship" },
              style: {
                stroke: color,
                strokeWidth: 1 + (e.sharedChapters || 1) * 0.4,
                strokeDasharray: trust < 30 ? "4 4" : trust < 60 ? "8 4" : undefined,
                opacity: 0.6 + trust * 0.004,
              },
            } as Edge;
          }
          const ks = EDGE_KIND_STYLE[e.kind] ?? EDGE_KIND_STYLE.appears_at;
          return {
            id: e.id, source: e.source, target: e.target, label: ks.label,
            data: { kind: e.kind },
            style: { stroke: ks.stroke, strokeWidth: 1, strokeDasharray: ks.dashed ? "2 4" : undefined, opacity: 0.5 },
          } as Edge;
        });

        setHealth((data.health as GraphHealthReport) ?? null);
        setNodes(rfNodes);
        setEdges(rfEdges);
      })
      .catch(() => {});
  }, [projectId, setNodes, setEdges]);

  // Phase 2 dataflow: when nodes are selected, ask the server which capabilities can
  // run on that selection (preflight + cost + confirm). The server never executes.
  const onSelectionChange = useCallback(({ nodes: selNodes }: { nodes: Node[] }) => {
    setSelected(selNodes.map(n => ({ id: n.id, type: (n.data as any)?.nodeType })));
  }, []);

  useEffect(() => {
    if (selected.length === 0) { setOptions(null); return; }
    const kinds = selectionKinds(selected);
    const nodeIds = selected.map(s => s.id);
    if (kinds.length === 0) { setOptions([]); return; }
    setLoadingOpts(true);
    fetch(`/api/projects/${projectId}/graph/run-plan`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kinds, nodeIds }),
    })
      .then(r => r.json())
      .then(d => setOptions(d.options ?? []))
      .catch(() => setOptions([]))
      .finally(() => setLoadingOpts(false));
  }, [projectId, selected]);

  const runOption = (plan: GraphRunPlan) => {
    if (!isOptionActionable(plan)) return;
    const confirmMsg = confirmMessageFor(plan);
    if (confirmMsg && !window.confirm(confirmMsg)) return; // QA-before-spend gate
    onRunCapability?.(plan);
  };

  return (
    <div style={{ position: "relative", width: "100%", height, borderRadius: 12, overflow: "hidden", border: "1px solid var(--color-border-subtle, rgba(255,255,255,0.05))" }}>
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onSelectionChange={onSelectionChange}
        onEdgeClick={(_, edge) => {
          if ((edge.data as any)?.kind === "relationship") onSelectPair?.(edge.source, edge.target);
        }}
        fitView
      >
        <Background color="var(--color-border-subtle, rgba(255,255,255,0.05))" gap={20} />
        <Controls />
        <MiniMap
          nodeColor="var(--color-bg-elevated, #1A1A1E)"
          style={{ background: "var(--color-bg-surface, #111113)" }}
        />
      </ReactFlow>

      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 10, fontSize: 11, background: "rgba(17,17,19,0.8)", padding: "4px 8px", borderRadius: 6, color: "#9898A6", zIndex: 5 }}>
        <span><span style={{ color: "#818cf8" }}>●</span> Character</span>
        <span><span style={{ color: "#22c55e" }}>●</span> Location</span>
        <span><span style={{ color: "#f59e0b" }}>●</span> Thread</span>
        <span><span style={{ color: "#c084fc" }}>●</span> Element</span>
      </div>

      {health && (
        <div style={{
          position: "absolute", bottom: 8, left: 8, fontSize: 11,
          background: "rgba(17,17,19,0.8)", padding: "4px 8px", borderRadius: 6,
          color: health.score < 70 ? "#f87171" : health.score < 90 ? "#f59e0b" : "#9898A6",
          zIndex: 5,
        }}>
          Health: {health.score}/100{health.counts.warning > 0 ? ` · ${health.counts.warning} warning${health.counts.warning === 1 ? "" : "s"}` : ""}
        </div>
      )}

      {/* Run-on-selection panel (Phase 2 dataflow). Appears when nodes are selected. */}
      {selected.length > 0 && (
        <div style={{ position: "absolute", top: 8, right: 8, width: 240, maxHeight: 460, overflow: "auto", background: "rgba(17,17,19,0.94)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 10, zIndex: 6, color: "#E8E8F0", fontSize: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Run on {selected.length} selected</div>
          {loadingOpts && <div style={{ color: "#9898A6" }}>Checking…</div>}
          {!loadingOpts && options?.length === 0 && <div style={{ color: "#9898A6" }}>No capabilities apply to this selection.</div>}
          {!loadingOpts && options?.map(plan => {
            const blocked = blockedReasonText(plan);
            return (
              <button
                key={plan.capabilityId}
                onClick={() => runOption(plan)}
                disabled={!isOptionActionable(plan)}
                title={blocked ?? (plan.requiresConfirm ? `~$${plan.costUsd.toFixed(2)}` : "")}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
                  padding: "7px 9px", marginBottom: 6, borderRadius: 7, textAlign: "left",
                  border: "1px solid rgba(255,255,255,0.08)", cursor: isOptionActionable(plan) ? "pointer" : "not-allowed",
                  background: isOptionActionable(plan) ? "rgba(129,140,248,0.12)" : "transparent",
                  color: isOptionActionable(plan) ? "#E8E8F0" : "#6b6b80",
                }}
              >
                <span>{plan.label}</span>
                <span style={{ fontSize: 10, color: blocked ? "#e0a05c" : plan.requiresConfirm ? "#c084fc" : "#6b6b80" }}>
                  {blocked ?? (plan.requiresConfirm ? `$${plan.costUsd.toFixed(2)}` : "free")}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
