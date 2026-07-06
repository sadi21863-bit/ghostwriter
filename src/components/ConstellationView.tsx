"use client";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useNodesState, useEdgesState, useReactFlow,
} from "@xyflow/react";
import type { Node, Edge, Connection } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  selectionKinds, confirmMessageFor, isOptionActionable, blockedReasonText, nodeHealthAccent, linkKindForPair,
  layoutCapabilityNodes, planForConnectionTarget, isCapabilityNodeId,
  collapseSelection, nodesHiddenBySubgraphs, expandSubgraph, isSubgraphNodeId, type SubgraphNode,
} from "@/lib/graph/graph-canvas";
import type { GraphNodeKind, GraphRunPlan } from "@/lib/graph/graph-program";
import type { GraphHealthIssue, GraphHealthReport } from "@/lib/graph/graph-health";

// Palette entry per creatable node kind (Phase 2 graph editing — drag onto the
// canvas to create, draw a wire between two existing nodes to link them).
// world_entity/chapter are deliberately excluded: neither has a "create via drag"
// persistence path today (world entities have their own CRUD UI; chapters come
// from writing, not manual creation).
const CREATABLE: { kind: GraphNodeKind; label: string; endpoint: string }[] = [
  { kind: "character", label: "+ Character", endpoint: "characters" },
  { kind: "location",  label: "+ Location",  endpoint: "locations" },
  { kind: "thread",    label: "+ Thread",    endpoint: "plot-threads" },
];
const DEFAULT_NAME: Record<string, string> = {
  character: "New Character", location: "New Location", thread: "New Thread",
};
const DRAG_MIME = "application/x-ghostwriter-node-kind";

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

// Node styling per entity type — the multi-entity Story Graph (Phase 1 + world entities + chapters).
const NODE_TYPE_STYLE: Record<string, { bg: string; border: string; shape: number }> = {
  character:    { bg: "#1A1A1E", border: "#818cf8", shape: 8 },   // rounded rect
  location:     { bg: "#13201a", border: "#22c55e", shape: 20 },  // pill
  thread:       { bg: "#201a13", border: "#f59e0b", shape: 2 },   // sharp
  world_entity: { bg: "#1d1320", border: "#c084fc", shape: 6 },   // world element
  chapter:      { bg: "#201317", border: "#fb7185", shape: 12 },  // rose, distinct rounding
};
const EDGE_KIND_STYLE: Record<string, { stroke: string; dashed?: boolean; label?: string }> = {
  appears_at: { stroke: "#22c55e", dashed: true, label: "at" },
  drives:     { stroke: "#f59e0b", dashed: true, label: "drives" },
  involves:   { stroke: "#c084fc", dashed: true, label: "involves" },
  features:   { stroke: "#fb7185", dashed: true, label: "features" },
};

function Flow({ projectId, onSelectPair, onRunCapability, height = 500 }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selected, setSelected] = useState<{ id: string; type?: string }[]>([]);
  const [options, setOptions] = useState<GraphRunPlan[] | null>(null);
  const [loadingOpts, setLoadingOpts] = useState(false);
  const [health, setHealth] = useState<GraphHealthReport | null>(null);
  // Phase 4 — collapsed subgraphs (Blueprint-style "Collapse Nodes"). Client-side,
  // ephemeral canvas state, not persisted — see graph-canvas.ts's header comment.
  const [subgraphs, setSubgraphs] = useState<SubgraphNode[]>([]);
  const [contextTrimmed, setContextTrimmed] = useState(false);
  const { screenToFlowPosition } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const loadGraph = useCallback(() => {
    return fetch(`/api/projects/${projectId}/story-graph`)
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
        const byType: Record<string, any[]> = { character: [], location: [], thread: [], world_entity: [], chapter: [] };
        for (const n of all) (byType[n.type] ?? (byType[n.type] = [])).push(n);
        const RING: Record<string, { r: number; cx: number; cy: number }> = {
          location:     { r: 110, cx: 350, cy: 300 },
          character:    { r: 230, cx: 350, cy: 300 },
          thread:       { r: 360, cx: 350, cy: 300 },
          world_entity: { r: 470, cx: 350, cy: 300 },
          chapter:      { r: 580, cx: 350, cy: 300 },
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
          : n.type === "chapter" ? `📖 ${n.name}${n.wordCount ? ` · ${n.wordCount}w` : ""}`
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
        setContextTrimmed(Boolean(data.contextTrimmed));
        setNodes(rfNodes);
        setEdges(rfEdges);
      })
      .catch(() => {});
  }, [projectId, setNodes, setEdges]);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  // Drag a palette chip onto the canvas → create a new entity at the drop point.
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DRAG_MIME)) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    const kind = e.dataTransfer.getData(DRAG_MIME);
    const entry = CREATABLE.find(c => c.kind === kind);
    if (!entry) return;
    e.preventDefault();
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });

    fetch(`/api/projects/${projectId}/${entry.endpoint}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: DEFAULT_NAME[kind] }),
    })
      .then(r => r.json())
      .then((created) => {
        if (!created?.id) return;
        const st = NODE_TYPE_STYLE[kind] ?? NODE_TYPE_STYLE.character;
        const newNode: Node = {
          id: created.id,
          data: { label: created.name ?? DEFAULT_NAME[kind], nodeType: kind },
          position,
          style: {
            background: st.bg, border: `1px solid ${st.border}`, borderRadius: st.shape,
            padding: "8px 12px", fontSize: 12, color: "#F2F2F3", minWidth: 70, textAlign: "center" as const,
          },
        };
        setNodes(nds => [...nds, newNode]);
      })
      .catch(() => {});
  }, [projectId, screenToFlowPosition, setNodes]);

  // Draw a wire between two existing nodes → persist a real link (or reject if
  // the pairing has no link semantics — see linkKindForPair). Drawing a wire
  // FROM a selected entity TO a capability icon node instead runs that
  // capability (the literal drag-a-wire-to-a-capability-icon interaction) —
  // checked first, since a capability node has no linkKindForPair pairing at all.
  const onConnect = useCallback((connection: Connection) => {
    const capabilityPlan = planForConnectionTarget(connection.target, options);
    if (capabilityPlan) {
      if (!isOptionActionable(capabilityPlan)) return;
      const confirmMsg = confirmMessageFor(capabilityPlan);
      if (confirmMsg && !window.confirm(confirmMsg)) return; // QA-before-spend gate
      onRunCapability?.(capabilityPlan);
      return;
    }
    if (isCapabilityNodeId(connection.source ?? "")) return; // dragging FROM a capability icon is not a valid gesture

    const sourceKind = nodes.find(n => n.id === connection.source)?.data?.nodeType as GraphNodeKind | undefined;
    const targetKind = nodes.find(n => n.id === connection.target)?.data?.nodeType as GraphNodeKind | undefined;
    if (!sourceKind || !targetKind) return;
    const linkKind = linkKindForPair(sourceKind, targetKind);
    if (!linkKind) return; // unsupported pairing — reject silently, no API call

    const charId = sourceKind === "character" ? connection.source : connection.target;
    const otherId = sourceKind === "character" ? connection.target : connection.source;

    const request = (async () => {
      if (linkKind === "relationship") {
        return fetch(`/api/projects/${projectId}/relationship-map`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterAId: connection.source, characterBId: connection.target }),
        });
      }
      const field = linkKind === "appears_at" ? "linkedLocationIds" : "linkedPlotThreadIds";
      // Read the character's CURRENT link array first — the canvas node only
      // carries {label, nodeType}, not the full DB row — so appending here
      // instead of assuming empty doesn't clobber existing links.
      const project = await fetch(`/api/projects/${projectId}`).then(r => r.json());
      const char = (project?.characters ?? []).find((c: any) => c.id === charId);
      const existing: string[] = char?.[field] ?? [];
      if (existing.includes(otherId)) return { ok: true } as Response;
      return fetch(`/api/projects/${projectId}/characters/${charId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: [...existing, otherId] }),
      });
    })();

    request.then(r => { if (r.ok) loadGraph(); }).catch(() => {});
  }, [nodes, projectId, loadGraph, options, onRunCapability]);

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

  // Collapse the current selection (2+ real entity nodes) into one named
  // subgraph node — Blueprint-style "Collapse Nodes." Double-click the result to
  // expand it back (see onNodeDoubleClick on <ReactFlow> below).
  const collapseSelected = () => {
    const realSelected = selected.filter(s => !isCapabilityNodeId(s.id) && !isSubgraphNodeId(s.id));
    const members = nodes.filter(n => realSelected.some(s => s.id === n.id)).map(n => ({ id: n.id, position: n.position }));
    if (members.length < 2) return;
    const label = window.prompt("Name this arc/subgraph:", "");
    if (label === null) return; // cancelled
    const sg = collapseSelection(members, label, crypto.randomUUID());
    if (sg) setSubgraphs(prev => [...prev, sg]);
  };

  const expandSubgraphNode = useCallback((subgraphId: string) => {
    setSubgraphs(prev => expandSubgraph(prev, subgraphId));
  }, []);

  // Capability icon nodes — one per runnable option, stacked to the right of the
  // selection's centroid. Computed separately from the persisted `nodes` state
  // (never passed to setNodes) so they're purely a render-time overlay: they
  // never get written back to the graph, never survive a loadGraph() refresh
  // unintentionally, and can't confuse onConnect's entity-lookup logic.
  const capabilityDisplayNodes = useMemo<Node[]>(() => {
    if (!options || options.length === 0) return [];
    const selectedIds = new Set(selected.map(s => s.id));
    const selectedPositions = nodes.filter(n => selectedIds.has(n.id)).map(n => n.position);
    if (selectedPositions.length === 0) return [];
    const anchor = {
      x: selectedPositions.reduce((s, p) => s + p.x, 0) / selectedPositions.length,
      y: selectedPositions.reduce((s, p) => s + p.y, 0) / selectedPositions.length,
    };
    return layoutCapabilityNodes(options, anchor).map((slot): Node => {
      const plan = options.find(o => o.capabilityId === slot.capabilityId)!;
      const blocked = blockedReasonText(plan);
      // Cost/blocked info goes directly in the label — a top-level `title` prop
      // on a default (non-custom) React Flow node isn't forwarded to the DOM,
      // so it wouldn't render as a hover tooltip the way a plain HTML attribute would.
      const suffix = blocked ? ` (${blocked})` : plan.requiresConfirm ? ` ($${plan.costUsd.toFixed(2)})` : "";
      return {
        id: slot.id,
        data: { label: `⚡ ${plan.label}${suffix}` },
        position: { x: slot.x, y: slot.y },
        connectable: !blocked, // a valid wire TARGET when actionable; never a source
        draggable: false,
        selectable: false,
        style: {
          background: blocked ? "rgba(60,60,68,0.9)" : "rgba(129,140,248,0.16)",
          border: `1.5px dashed ${blocked ? "#6b6b80" : "#818cf8"}`,
          borderRadius: 20, padding: "6px 12px", fontSize: 11,
          color: blocked ? "#8a8a9a" : "#E8E8F0",
          minWidth: 90, textAlign: "center" as const,
          cursor: blocked ? "not-allowed" : "default",
        },
      };
    });
  }, [options, selected, nodes]);

  // Nodes hidden inside an active subgraph don't render individually — the
  // collapsed subgraph node stands in for them until expanded.
  const hiddenBySubgraph = useMemo(() => nodesHiddenBySubgraphs(subgraphs), [subgraphs]);
  const visibleNodes = useMemo(() => nodes.filter(n => !hiddenBySubgraph.has(n.id)), [nodes, hiddenBySubgraph]);

  const subgraphDisplayNodes = useMemo<Node[]>(() => subgraphs.map((sg): Node => ({
    id: sg.id,
    data: { label: `📦 ${sg.label} (${sg.memberIds.length})` },
    position: sg.centroid,
    draggable: true,
    selectable: true,
    connectable: false,
    style: {
      background: "rgba(20,20,26,0.95)", border: "2px solid #E8E8F0", borderRadius: 10,
      padding: "10px 16px", fontSize: 12, fontWeight: 700, color: "#F2F2F3",
      minWidth: 110, textAlign: "center" as const,
    },
  })), [subgraphs]);

  return (
    <div
      ref={wrapperRef}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{ position: "relative", width: "100%", height, borderRadius: 12, overflow: "hidden", border: "1px solid var(--color-border-subtle, rgba(255,255,255,0.05))" }}
    >
      <ReactFlow
        nodes={[...visibleNodes, ...capabilityDisplayNodes, ...subgraphDisplayNodes]} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onNodeDoubleClick={(_, node) => { if (isSubgraphNodeId(node.id)) expandSubgraphNode(node.id); }}
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

      {/* Drag one of these onto the canvas to create a new entity; draw a wire
          between two existing nodes (character↔location, character↔thread,
          character↔character) to link them — see onDrop / onConnect above. */}
      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 6, zIndex: 5 }}>
        {CREATABLE.map(c => {
          const st = NODE_TYPE_STYLE[c.kind];
          return (
            <div
              key={c.kind}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData(DRAG_MIME, c.kind); e.dataTransfer.effectAllowed = "move"; }}
              title={`Drag onto the canvas to create a ${c.kind}`}
              style={{
                fontSize: 11, padding: "4px 8px", borderRadius: 6, cursor: "grab",
                background: "rgba(17,17,19,0.8)", border: `1px solid ${st.border}`, color: "#E8E8F0",
              }}
            >
              {c.label}
            </div>
          );
        })}
      </div>

      <div style={{ position: "absolute", top: 40, left: 8, display: "flex", gap: 10, fontSize: 11, background: "rgba(17,17,19,0.8)", padding: "4px 8px", borderRadius: 6, color: "#9898A6", zIndex: 5 }}>
        <span><span style={{ color: "#818cf8" }}>●</span> Character</span>
        <span><span style={{ color: "#22c55e" }}>●</span> Location</span>
        <span><span style={{ color: "#f59e0b" }}>●</span> Thread</span>
        <span><span style={{ color: "#c084fc" }}>●</span> Element</span>
        <span><span style={{ color: "#fb7185" }}>●</span> Chapter</span>
      </div>

      {(health || contextTrimmed) && (
        <div style={{
          position: "absolute", bottom: 8, left: 8, fontSize: 11,
          background: "rgba(17,17,19,0.8)", padding: "4px 8px", borderRadius: 6,
          zIndex: 5, display: "flex", flexDirection: "column", gap: 2,
        }}>
          {health && (
            <span style={{ color: health.score < 70 ? "#f87171" : health.score < 90 ? "#f59e0b" : "#9898A6" }}>
              Health: {health.score}/100{health.counts.warning > 0 ? ` · ${health.counts.warning} warning${health.counts.warning === 1 ? "" : "s"}` : ""}
            </span>
          )}
          {contextTrimmed && (
            <span
              style={{ color: "#f59e0b" }}
              title="This project is large enough that lower-priority sections (e.g. World Elements, Plot Threads) are being dropped from what the AI actually sees on each generation, to stay within the per-request context budget. Mark rarely-used entries 'minor' or trim the Story Bible to restore full context."
            >
              ⚠ Context trimmed — some content isn't reaching the AI
            </span>
          )}
        </div>
      )}

      {/* Run-on-selection panel (Phase 2 dataflow). Appears when nodes are selected. */}
      {selected.length > 0 && (
        <div style={{ position: "absolute", top: 8, right: 8, width: 240, maxHeight: 460, overflow: "auto", background: "rgba(17,17,19,0.94)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 10, zIndex: 6, color: "#E8E8F0", fontSize: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Run on {selected.length} selected</div>
          {loadingOpts && <div style={{ color: "#9898A6" }}>Checking…</div>}
          {!loadingOpts && options?.length === 0 && <div style={{ color: "#9898A6" }}>No capabilities apply to this selection.</div>}
          {!loadingOpts && options && options.length > 0 && (
            <div style={{ color: "#6b6b80", fontSize: 10, marginBottom: 6 }}>
              Click below, or drag a wire from a selected node to a ⚡ icon on the canvas.
            </div>
          )}
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
          {selected.filter(s => !isCapabilityNodeId(s.id) && !isSubgraphNodeId(s.id)).length >= 2 && (
            <button
              onClick={collapseSelected}
              title="Collapse this selection into one named node — double-click it later to expand back (Phase 4, Blueprint-style)"
              style={{
                display: "block", width: "100%", marginTop: 4, padding: "7px 9px", borderRadius: 7,
                border: "1px dashed rgba(255,255,255,0.2)", background: "transparent", color: "#9898A6",
                cursor: "pointer", textAlign: "left", fontSize: 12,
              }}
            >
              📦 Collapse into subgraph…
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// screenToFlowPosition (useReactFlow) requires an ancestor ReactFlowProvider —
// Flow renders <ReactFlow> itself, so the provider has to wrap Flow from outside.
export function ConstellationView(props: Props) {
  return (
    <ReactFlowProvider>
      <Flow {...props} />
    </ReactFlowProvider>
  );
}
