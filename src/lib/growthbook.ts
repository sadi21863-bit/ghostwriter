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
  qualityStack:        "quality_stack",
  streaming:           "streaming",
} as const;
