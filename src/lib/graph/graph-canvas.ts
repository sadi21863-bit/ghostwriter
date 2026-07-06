// Pure helpers for the Story Graph canvas drag-wire UI (Phase 2). Kept out of the
// React component so the selection→capability→confirm logic is unit-testable
// without a DOM/React Flow. The component just renders what these return.
import type { GraphNodeKind, GraphRunPlan } from "./graph-program";
import type { GraphHealthIssue } from "./graph-health";

// The canvas node types (from buildStoryGraph) map 1:1 onto the dataflow engine's
// node kinds for the World-Bible entity types plus chapters.
const TYPE_TO_KIND: Record<string, GraphNodeKind> = {
  character: "character",
  location: "location",
  thread: "thread",
  world_entity: "world_entity",
  chapter: "chapter",
};

/** Distinct GraphNodeKinds present in a node selection, order-stable. */
export function selectionKinds(selected: { type?: string }[]): GraphNodeKind[] {
  const seen = new Set<GraphNodeKind>();
  const out: GraphNodeKind[] = [];
  for (const n of selected) {
    const kind = n.type ? TYPE_TO_KIND[n.type] : undefined;
    if (kind && !seen.has(kind)) { seen.add(kind); out.push(kind); }
  }
  return out;
}

/** Human cost-confirm text for a paid run plan (null when no confirm is needed). */
export function confirmMessageFor(plan: GraphRunPlan): string | null {
  if (!plan.available) return null;
  if (!plan.requiresConfirm) return null;
  const n = plan.nodeIds.length || 1;
  const usd = plan.costUsd.toFixed(2);
  return `Run "${plan.label}" on ${n} selected node${n === 1 ? "" : "s"}? This makes paid generations costing about $${usd}.`;
}

/** A run option is actionable (clickable) only when available. */
export function isOptionActionable(plan: GraphRunPlan): boolean {
  return plan.available;
}

/** Short availability reason text for a blocked option. */
export function blockedReasonText(plan: GraphRunPlan): string | null {
  if (plan.available) return null;
  switch (plan.reason) {
    case "upgrade_required":     return "Upgrade required";
    case "missing_segmind_key":  return "Add a Segmind key in Settings";
    case "missing_openai_key":   return "Add an OpenAI key in Settings";
    case "not_applicable_for_format": return "Not available for this format";
    default:                     return "Unavailable";
  }
}

/** Border accent color for a node's health issues; null when it has none.
 * Warning issues (isolated character, unrooted thread) outrank info issues for color. */
export function nodeHealthAccent(issues: GraphHealthIssue[]): string | null {
  if (issues.length === 0) return null;
  return issues.some(i => i.severity === "warning") ? "#f87171" : "#f59e0b";
}

// ── Capability icon nodes (drag-a-wire-to-run) ────────────────────────────────
// Phase 2's "runnable capabilities" were previously only reachable via a
// select-then-click side panel. This adds the literal drag-a-wire-to-a-
// capability-icon interaction the visual-programming vision describes: each
// runnable capability for the current selection is rendered as its own small
// icon node on the canvas; dragging a wire from a selected entity node onto one
// runs that capability (through the same confirm/execute path the button already
// used — this is a second gesture for the same action, not a new execution path).
export const CAPABILITY_NODE_PREFIX = "__capability__:";

/** Synthetic React Flow node id for a capability icon, namespaced so it can never collide with a real entity id. */
export function capabilityNodeId(capabilityId: string): string {
  return `${CAPABILITY_NODE_PREFIX}${capabilityId}`;
}

/** True when a node id is a capability icon, not a real graph entity. */
export function isCapabilityNodeId(id: string): boolean {
  return id.startsWith(CAPABILITY_NODE_PREFIX);
}

/** The capability id encoded in a capability icon's node id, or null if this isn't one. */
export function capabilityIdFromNodeId(id: string): string | null {
  return isCapabilityNodeId(id) ? id.slice(CAPABILITY_NODE_PREFIX.length) : null;
}

/**
 * Position each runnable capability's icon node in a vertical stack to the right
 * of an anchor point (the selection's bounding box). Pure layout math — no
 * React Flow dependency — so it's unit-testable on its own.
 */
export function layoutCapabilityNodes(
  options: GraphRunPlan[],
  anchor: { x: number; y: number },
  spacing = 56,
): { id: string; capabilityId: string; x: number; y: number }[] {
  const startY = anchor.y - ((options.length - 1) * spacing) / 2;
  return options.map((plan, i) => ({
    id: capabilityNodeId(plan.capabilityId),
    capabilityId: plan.capabilityId,
    x: anchor.x + 160,
    y: startY + i * spacing,
  }));
}

/**
 * Given a just-drawn connection's target id and the currently-runnable options,
 * return the matching plan if the target is a capability icon node — this is
 * what onConnect uses to decide "run a capability" vs. "persist an entity link."
 * Returns null when the target isn't a capability node, or matches no current
 * option (e.g. the selection changed between render and drop).
 */
export function planForConnectionTarget(targetId: string | null | undefined, options: GraphRunPlan[] | null): GraphRunPlan | null {
  if (!targetId) return null;
  const capabilityId = capabilityIdFromNodeId(targetId);
  if (!capabilityId) return null;
  return options?.find(o => o.capabilityId === capabilityId) ?? null;
}

// ── Subgraphs (Phase 4 — collapse a selection into one named node) ───────────
// Pattern is Unreal Blueprint's "Collapse Nodes" (see docs/superpowers/story-
// graph-visual-programming-vision.md's external research): select a cluster,
// collapse it into one node; double-click to re-enter and see the members
// again. This is deliberately client-side/ephemeral state, not persisted to the
// DB — the vision doc's own guidance is "only generalize after users actually
// use one," so a v1 that doesn't survive a page reload is the right amount of
// commitment, not a missing feature.
export const SUBGRAPH_NODE_PREFIX = "__subgraph__:";

export interface SubgraphNode {
  id: string;
  label: string;
  memberIds: string[];
  centroid: { x: number; y: number };
}

/** True when a node id is a collapsed-subgraph node, not a real graph entity or a capability icon. */
export function isSubgraphNodeId(id: string): boolean {
  return id.startsWith(SUBGRAPH_NODE_PREFIX);
}

/** Synthetic node id for a new subgraph, namespaced so it can never collide with a real entity or capability id. */
export function subgraphNodeId(rawId: string): string {
  return `${SUBGRAPH_NODE_PREFIX}${rawId}`;
}

/**
 * Collapse a set of selected nodes into one named subgraph node, positioned at
 * their centroid. Requires at least 2 members — collapsing a single node isn't
 * a grouping, it's just renaming, which isn't what this feature is for.
 * `rawId` is caller-generated (e.g. crypto.randomUUID() in the component) —
 * kept as a pure function argument rather than generated in here with module-
 * level counter state, so this stays trivially testable and side-effect-free.
 */
export function collapseSelection(
  members: { id: string; position: { x: number; y: number } }[],
  label: string,
  rawId: string,
): SubgraphNode | null {
  if (members.length < 2) return null;
  const centroid = {
    x: members.reduce((s, m) => s + m.position.x, 0) / members.length,
    y: members.reduce((s, m) => s + m.position.y, 0) / members.length,
  };
  return { id: subgraphNodeId(rawId), label: label.trim() || "Untitled arc", memberIds: members.map(m => m.id), centroid };
}

/** The union of every node id currently hidden inside any active subgraph — filter these out of the main canvas render. */
export function nodesHiddenBySubgraphs(subgraphs: SubgraphNode[]): Set<string> {
  const hidden = new Set<string>();
  for (const sg of subgraphs) for (const id of sg.memberIds) hidden.add(id);
  return hidden;
}

/** Remove a subgraph by id (double-click to expand) — returns the remaining list, unchanged if the id wasn't found. */
export function expandSubgraph(subgraphs: SubgraphNode[], subgraphId: string): SubgraphNode[] {
  return subgraphs.filter(sg => sg.id !== subgraphId);
}

/**
 * What kind of link (if any) drawing a wire between two node kinds should create.
 * Order-independent — character+location and location+character both resolve the
 * same way. Only the three pairings with a real persistence path today are
 * supported; everything else (including any pairing involving world_entity or
 * chapter, which have no user-drawable link today) returns null so the canvas
 * rejects the connection instead of calling a nonexistent write.
 */
export function linkKindForPair(
  aKind: GraphNodeKind,
  bKind: GraphNodeKind
): "relationship" | "appears_at" | "drives" | null {
  const pair = [aKind, bKind].sort().join(":");
  switch (pair) {
    case "character:character": return "relationship";
    case "character:location":  return "appears_at";
    case "character:thread":    return "drives";
    default:                    return null;
  }
}
