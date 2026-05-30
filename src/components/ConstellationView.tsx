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

export function ConstellationView({ projectId, onSelectPair }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/relationship-map`)
      .then(r => r.json())
      .then(data => {
        const count = (data.nodes || []).length;
        const rfNodes: Node[] = (data.nodes || []).map((n: any, i: number) => ({
          id: n.id,
          data: { label: n.name },
          position: {
            x: 250 + 220 * Math.cos((2 * Math.PI * i) / Math.max(count, 1)),
            y: 200 + 160 * Math.sin((2 * Math.PI * i) / Math.max(count, 1)),
          },
          style: {
            background: "var(--color-bg-elevated, #1A1A1E)",
            border: "1px solid var(--color-border-default, rgba(255,255,255,0.09))",
            borderRadius: 8, padding: "8px 12px", fontSize: 13,
            color: "var(--color-text-primary, #F2F2F3)", minWidth: 80, textAlign: "center" as const,
          },
        }));

        const rfEdges: Edge[] = (data.edges || []).map((e: any) => {
          const trust = e.trustLevel ?? 50;
          const color = RELATIONSHIP_COLORS[e.relationshipType ?? ""] ?? "#6b7280";
          return {
            id: `${e.charAId}-${e.charBId}`,
            source: e.charAId, target: e.charBId,
            label: e.relationshipType || undefined,
            style: {
              stroke: color,
              strokeWidth: 1 + (e.sharedChapters || 1) * 0.4,
              strokeDasharray: trust < 30 ? "4 4" : trust < 60 ? "8 4" : undefined,
              opacity: 0.6 + trust * 0.004,
            },
          } as Edge;
        });

        setNodes(rfNodes);
        setEdges(rfEdges);
      });
  }, [projectId]);

  return (
    <div style={{ width: "100%", height: 500, borderRadius: 12, overflow: "hidden", border: "1px solid var(--color-border-subtle, rgba(255,255,255,0.05))" }}>
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onEdgeClick={(_, edge) => {
          const parts = edge.id.split("-");
          if (parts.length >= 2) onSelectPair?.(parts[0], parts[1]);
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
    </div>
  );
}
