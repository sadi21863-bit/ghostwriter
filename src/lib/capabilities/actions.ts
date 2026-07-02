import type { Capability, CapabilityAvailability } from "./registry";
import type { FeatureGate } from "@/types/subscription";

// Pure routing: given a capability + its availability, decide what the UI should
// do when clicked. Kept separate from the React component so it's unit-testable
// without a DOM. The component just dispatches on `type`.
export type CapabilityActionResult =
  | { type: "upgrade"; gate: FeatureGate }
  | { type: "hint"; reason: "missing_segmind_key" | "missing_openai_key" }
  | { type: "selectMode"; mode: string }
  | { type: "openComicStudio" }
  | { type: "openProductionStudio" }
  | { type: "openInsights"; tab: "arc" | "tension" }
  | { type: "openStoryHealth"; tab: "validator" }
  | { type: "openPolishStage" }
  | { type: "openActions" }
  | { type: "noop" };

const PRODUCTION_TOOL_IDS = new Set(["generate_package", "scene_to_video_prompt", "production_video"]);

const INSIGHTS_TAB_MAP: Record<string, "arc" | "tension"> = {
  arc_heatmap: "arc",
  tension_curve: "tension",
};

export function capabilityAction(cap: Capability, availability: CapabilityAvailability): CapabilityActionResult {
  if (!availability.available) {
    if (availability.reason === "upgrade_required" && cap.gate) return { type: "upgrade", gate: cap.gate };
    if (availability.reason === "missing_segmind_key") return { type: "hint", reason: "missing_segmind_key" };
    if (availability.reason === "missing_openai_key") return { type: "hint", reason: "missing_openai_key" };
    return { type: "noop" };
  }
  if (cap.kind === "mode") return { type: "selectMode", mode: cap.id };
  if (cap.id === "comic_generate") return { type: "openComicStudio" };
  if (PRODUCTION_TOOL_IDS.has(cap.id)) return { type: "openProductionStudio" };
  if (cap.id in INSIGHTS_TAB_MAP) return { type: "openInsights", tab: INSIGHTS_TAB_MAP[cap.id] };
  if (cap.id === "prose_fix") return { type: "openStoryHealth", tab: "validator" };
  if (cap.id === "editor_review") return { type: "openPolishStage" };
  return { type: "openActions" };
}
