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
