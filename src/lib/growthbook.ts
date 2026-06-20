import { GrowthBook } from "@growthbook/growthbook-react";

export function createGrowthBook(userId: string, tier: string) {
  const gb = new GrowthBook({
    apiHost: process.env.NEXT_PUBLIC_GROWTHBOOK_API_HOST ?? "https://cdn.growthbook.io",
    clientKey: process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY ?? "",
    attributes: { id: userId, tier },
    trackingCallback: (experiment, result) => {
      console.log("Experiment:", experiment.key, "Variant:", result.variationId);
    },
  });
  return gb;
}

export const FLAGS = {
  craftLibrary:        "craft_library",
  constellationView:   "constellation_view",
  draftBranching:      "draft_branching",
  readerMode:          "reader_mode",
  commandPalette:      "command_palette",
  adaptiveOnboarding:  "adaptive_onboarding",
  newDesignTokens:     "new_design_tokens",
  writingRoomShell:    "writing_room_shell",
  homeRedesign:        "home_redesign",
  // Gates ONLY the costly Haiku scene-blueprint pre-pass (default OFF). The
  // free grounding helpers (promise-ledger, voice-exemplars) run unconditionally
  // for qualifying requests — see /api/ai/generate/route.ts. Was "quality_stack"
  // until the 2026-06-21 panel eval showed the bundled all-or-nothing flag
  // couldn't express "keep the free helpers, skip the costly one."
  sceneBlueprint:      "scene_blueprint",
  streaming:           "streaming",
} as const;
