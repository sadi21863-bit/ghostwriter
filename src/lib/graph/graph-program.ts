// Story Graph Phase 2 — minimal dataflow ("visual programming") core.
//
// A "wire" connects a selection of graph nodes to a capability from the registry;
// running it executes that capability scoped to the wired nodes. This module is
// the PURE engine: given a node selection + capability context it answers
//   - which capabilities can run on this selection (NODE_CAPABILITIES applicability
//     ∩ isCapabilityAvailable preflight), and
//   - what a run would cost + whether it must be confirmed before spending.
//
// It never fires anything. `buildRunPlan` returns a descriptor; the existing
// capabilityAction + fetch layer executes it ONLY after the UI confirms. This is
// the "QA-before-spend" invariant from the visual-programming vision doc — never
// auto-fire a graph of paid generations.
import {
  getCapabilities, isCapabilityAvailable,
  type Capability, type CapabilityContext, type CapabilityAvailability,
} from "@/lib/capabilities/registry";
import { capabilityAction, type CapabilityActionResult } from "@/lib/capabilities/actions";
import { unitCostFor } from "@/lib/capabilities/cost";

// The node kinds a wire can originate from. Superset of the current Story Graph
// node types (character/location/thread/world_entity) plus chapter/scene, which
// the graph doesn't emit yet but the dataflow engine is ready for — adding those
// nodes later needs no engine change, just the map entry.
export type GraphNodeKind = "character" | "location" | "thread" | "world_entity" | "chapter" | "scene";

// Which capabilities make sense wired to which node kind. Declarative so a new
// node kind or capability is a one-line map edit, not engine surgery.
// knowledge_audit/beta_read/transportation_check are manuscript- or chapter-
// wide Editor tools (see src/lib/roles/editor.ts) — the specific node clicked
// doesn't scope what they check, it's just an entry point into the same
// project-wide call. knowledge_audit fits every entity kind (it audits
// character consistency, continuity, and — since item 44 — the structured
// promise/thread data directly); beta_read/transportation_check need actual
// chapter prose text, so they're chapter-only, not location/world_entity.
export const NODE_CAPABILITIES: Record<GraphNodeKind, string[]> = {
  character:    ["villain_pov", "knowledge_audit"],
  thread:       ["tension_curve", "arc_heatmap", "villain_pov", "knowledge_audit"],
  location:     ["knowledge_audit"],
  world_entity: ["knowledge_audit"],
  chapter:      ["comic_generate", "refine", "prose_fix", "editor_review", "beta_read", "transportation_check", "knowledge_audit"],
  scene:        ["production_video", "scene_to_video_prompt", "generate_package"],
};

// Real-money external providers — runs against these must be confirmed before
// spending. Anthropic/internal are server-metered (no surprise external charge).
const PAID_PROVIDERS = new Set<Capability["provider"]>(["segmind", "openai"]);

export interface GraphRunPlan {
  capabilityId: string;
  label: string;
  endpoint?: string;
  nodeIds: string[];
  available: boolean;
  reason?: CapabilityAvailability["reason"];
  action: CapabilityActionResult;
  /** Estimated USD for this run (0 for non-external-paid capabilities). */
  costUsd: number;
  /** UI MUST confirm before executing when true (available + real external spend). */
  requiresConfirm: boolean;
}

/** Union of the capability ids applicable to the given node kinds, order-stable, deduped. */
export function applicableCapabilityIds(kinds: GraphNodeKind[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const kind of kinds) {
    for (const id of NODE_CAPABILITIES[kind] ?? []) {
      if (!seen.has(id)) { seen.add(id); out.push(id); }
    }
  }
  return out;
}

/**
 * Build the preflight'd run plan for one capability wired to a node selection.
 * Returns null only if the capability id isn't in the registry. Never executes.
 */
export function buildRunPlan(
  capabilityId: string,
  nodeIds: string[],
  ctx: CapabilityContext,
): GraphRunPlan | null {
  const cap = getCapabilities().find(c => c.id === capabilityId);
  if (!cap) return null;
  const availability = isCapabilityAvailable(cap, ctx);
  const action = capabilityAction(cap, availability);
  const isPaid = PAID_PROVIDERS.has(cap.provider);
  const costUsd = isPaid ? unitCostFor(cap.id) * Math.max(nodeIds.length, 1) : 0;
  return {
    capabilityId: cap.id,
    label: cap.label,
    endpoint: cap.endpoint,
    nodeIds,
    available: availability.available,
    reason: availability.reason,
    action,
    costUsd,
    requiresConfirm: availability.available && isPaid && costUsd > 0,
  };
}

export interface GraphCapabilityOption extends GraphRunPlan {}

/**
 * Every capability runnable on a node selection, each annotated with availability
 * + cost + confirm flag. The "what can I wire here" enumerator for the canvas.
 * `nodeIds` is the selected node ids (used for the per-run cost/scope).
 */
export function runnableCapabilities(
  selection: { kinds: GraphNodeKind[]; nodeIds: string[] },
  ctx: CapabilityContext,
): GraphCapabilityOption[] {
  const ids = applicableCapabilityIds(selection.kinds);
  const plans: GraphCapabilityOption[] = [];
  for (const id of ids) {
    const plan = buildRunPlan(id, selection.nodeIds, ctx);
    if (plan) plans.push(plan);
  }
  return plans;
}
