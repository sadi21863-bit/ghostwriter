// The 4-stage funnel presented in the UI, layered over the guide engine's
// granular 5-stage ladder (next-action.ts). The guide engine is unchanged — it
// still computes idea/structure/draft/polish/export and drives "next action"
// suggestions; this just maps those 5 onto the 4 funnel stages the user sees.
import type { GuideStage } from "./next-action";
import type { CapabilityStage } from "@/lib/capabilities/types";

export type FunnelStage = CapabilityStage; // "discover" | "shape" | "write" | "produce"

export const FUNNEL_ORDER: readonly FunnelStage[] = ["discover", "shape", "write", "produce"];

export const FUNNEL_LABELS: Record<FunnelStage, string> = {
  discover: "Discover",
  shape: "Shape",
  write: "Write",
  produce: "Produce",
};

export const CREATOR_FUNNEL_LABELS: Record<FunnelStage, string> = {
  discover: "Research",
  shape: "Hooks",
  write: "Script",
  produce: "Publish",
};

/** 5 internal guide stages → 4 funnel stages (Polish + Export both → Produce). */
export function guideStageToFunnel(stage: GuideStage): FunnelStage {
  switch (stage) {
    case "idea": return "discover";
    case "structure": return "shape";
    case "draft": return "write";
    case "polish": return "produce";
    case "export": return "produce";
  }
}

/** Funnel pill click → the representative guide stage to set as manualStage.
 *  Produce enters at "polish" (its first sub-view); the Produce body renders
 *  polish + export together. */
export function funnelStageToGuide(stage: FunnelStage): GuideStage {
  switch (stage) {
    case "discover": return "idea";
    case "shape": return "structure";
    case "write": return "draft";
    case "produce": return "polish";
  }
}
