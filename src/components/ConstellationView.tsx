"use client";
import { useEffect } from "react";
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState,
} from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type Props = { projectId: string; onSelectPair?: (aId: string, bId: string) => void };

const RELATIONSHIP_COLORS: Record<string, string> = {
  ally:     "#22c55e", enemy:    "#ef4444",
  rival:    "#f59e0b", romantic: "#ec4899",
  mentor:   "#6366f1", neutral:  "#6b7280",
  family:   "#14b8a6", "":       "#6b7280",
};

// Node styling per entity type — the multi-entity Story Graph (Phase 1).
const NODE_TYPE_STYLE: Record<string, { bg: string; border: string; shape: number }> = {
  character: { bg: "#1A1A1E", border: "#818cf8", shape: 8 },   // rounded rect
  location:  { bg: "#13201a", border: "#22c55e", shape: 20 },  // pill
  thread:    { bg: "#201a13", border: "#f59e0b", shape: 2 },   // sharp
};
const EDGE_KIND_STYLE: Record<string, { stroke: string; dashed?: boolean; label?: string }> = {
  appears_at: { stroke: "#22c55e", dashed: true, label: "at" },
  drives:     { stroke: "#f59e0b", dashed: true, label: "drives" },
};

export function ConstellationView({ projectId, onSelectPair }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/story-graph`)
      .then(r => r.json())
      .then(data => {
        const all = data.nodes || [];
        // Lay out each type on its own ring so the three entity kinds are visually distinct.
        const byType: Record<string, any[]> = { character: [], location: [], thread: [] };
        for (const n of all) (byType[n.type] ?? (byType[n.type] = [])).push(n);
        const RING: Record<string, { r: number; cx: number; cy: number }> = {
          character: { r: 230, cx: 350, cy: 300 },
          location:  { r: 110, cx: 350, cy: 300 },
          thread:    { r: 360, cx: 350, cy: 300 },
        };
        const pos: Record<string, { x: number; y: number }> = {};
        for (const [type, list] of Object.entries(byType)) {
          const ring = RING[type] ?? RING.character;
          list.forEach((n, i) => {
            const ang = (2 * Math.PI * i) / Math.max(list.length, 1);
            pos[n.id] = { x: ring.cx + ring.r * Math.cos(ang), y: ring.cy + ring.r * Math.sin(ang) };
          });
        }

        const rfNodes: Node[] = all.map((n: any) => {
          const st = NODE_TYPE_STYLE[n.type] ?? NODE_TYPE_STYLE.character;
          return {
            id: n.id,
            data: { label: n.type === "thread" ? `🧵 ${n.name}` : n.type === "location" ? `📍 ${n.name}` : n.name },
            position: pos[n.id] ?? { x: 350, y: 300 },
            style: {
              background: st.bg, border: `1px solid ${st.border}`, borderRadius: st.shape,
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

        setNodes(rfNodes);
        setEdges(rfEdges);
      })
      .catch(() => {});
  }, [projectId, setNodes, setEdges]);

  return (
    <div style={{ position: "relative", width: "100%", height: 500, borderRadius: 12, overflow: "hidden", border: "1px solid var(--color-border-subtle, rgba(255,255,255,0.05))" }}>
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onEdgeClick={(_, edge) => {
          // Only character↔character relationship edges are editable pairs.
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
      </div>
    </div>
  );
}
