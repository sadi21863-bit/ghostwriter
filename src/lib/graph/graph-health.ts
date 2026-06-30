// Story Graph Phase 3 — probes / graph health.
//
// Pure analysis over the built Story Graph (nodes + edges): surfaces structural
// problems an Editor would care about — entities nobody connected, threads no one
// drives, locations no one visits, world elements floating unused. This is the
// "probe on a wire" idea from the visual-programming vision: read-only signals on
// the graph, no execution, no spend.
import type { StoryGraphResult, StoryGraphNode, StoryGraphEdge } from "./story-graph";

export type GraphHealthKind =
  | "isolated_character"
  | "isolated_location"
  | "isolated_entity"
  | "unrooted_thread"      // a plot thread no character drives
  | "unvisited_location"   // a location no character appears at
  | "unused_entity";       // a world element wired to nothing

export type GraphHealthSeverity = "warning" | "info";

export interface GraphHealthIssue {
  kind: GraphHealthKind;
  severity: GraphHealthSeverity;
  nodeId: string;
  nodeName: string;
  message: string;
}

export interface GraphHealthReport {
  issues: GraphHealthIssue[];
  /** 0–100; 100 = no structural issues. Each warning costs more than each info. */
  score: number;
  counts: { warning: number; info: number };
}

function degreeMap(edges: StoryGraphEdge[]): Map<string, number> {
  const deg = new Map<string, number>();
  const bump = (id: string) => deg.set(id, (deg.get(id) ?? 0) + 1);
  for (const e of edges) { bump(e.source); bump(e.target); }
  return deg;
}

export function analyzeGraphHealth(graph: StoryGraphResult): GraphHealthReport {
  const { nodes, edges } = graph;
  const deg = degreeMap(edges);
  const issues: GraphHealthIssue[] = [];

  // Targeted-by helpers: does any edge of a kind point AT this node?
  const hasIncoming = (id: string, kinds: StoryGraphEdge["kind"][]) =>
    edges.some(e => e.target === id && kinds.includes(e.kind));
  const hasOutgoing = (id: string, kinds: StoryGraphEdge["kind"][]) =>
    edges.some(e => e.source === id && kinds.includes(e.kind));

  for (const node of nodes) {
    const d = deg.get(node.id) ?? 0;

    // A thread is "rooted" only if a CHARACTER drives it — an entity merely
    // referencing it doesn't count. This holds whether or not it has other edges.
    if (node.type === "thread") {
      if (!hasIncoming(node.id, ["drives"])) {
        issues.push({
          kind: "unrooted_thread", severity: "warning", nodeId: node.id, nodeName: node.name,
          message: `Thread "${node.name}" isn't driven by any character — who carries it?`,
        });
      }
      continue;
    }

    if (d === 0) {
      // Fully isolated — flag per type (character isolation is the loudest).
      const kind: GraphHealthKind =
        node.type === "character" ? "isolated_character"
        : node.type === "location" ? "isolated_location"
        : "isolated_entity";
      issues.push({
        kind,
        severity: node.type === "character" ? "warning" : "info",
        nodeId: node.id,
        nodeName: node.name,
        message: `${node.name} (${labelFor(node)}) has no connections — link it into the story.`,
      });
      continue; // a fully-isolated node only gets the one issue
    }

    // Connected but structurally incomplete:
    if (node.type === "location" && !hasIncoming(node.id, ["appears_at", "involves"])) {
      issues.push({
        kind: "unvisited_location", severity: "info", nodeId: node.id, nodeName: node.name,
        message: `No character appears at "${node.name}".`,
      });
    }
    if (node.type === "world_entity" && !hasOutgoing(node.id, ["involves"])) {
      issues.push({
        kind: "unused_entity", severity: "info", nodeId: node.id, nodeName: node.name,
        message: `World element "${node.name}" isn't linked to any character, place, or thread.`,
      });
    }
  }

  const warning = issues.filter(i => i.severity === "warning").length;
  const info = issues.filter(i => i.severity === "info").length;
  const score = Math.max(0, 100 - warning * 12 - info * 4);
  return { issues, score, counts: { warning, info } };
}

function labelFor(node: StoryGraphNode): string {
  if (node.type === "world_entity") return node.kind ?? "element";
  return node.type;
}
