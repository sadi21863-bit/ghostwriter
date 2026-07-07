// Pure flag-key constants, deliberately zero SDK dependency -- this file is
// imported by both client components (WritingRoom.tsx, dashboard/page.tsx)
// and the server-only /api/ai/generate route. It previously also exported
// createGrowthBook() (unused everywhere, confirmed by grep), which imported
// GrowthBook from @growthbook/growthbook-react at module scope -- that pulls
// in React.createContext even for callers who only wanted FLAGS, which
// crashed the server route ("createContext only works in Client Components").
// Removed rather than fixed in place, since it had zero real callers.
export const FLAGS = {
  craftLibrary:        "craft_library",
  constellationView:   "constellation_view",
  draftBranching:      "draft_branching",
  readerMode:          "reader_mode",
  commandPalette:      "command_palette",
  adaptiveOnboarding:  "adaptive_onboarding",
  newDesignTokens:     "new_design_tokens",
  homeRedesign:        "home_redesign",
  // Gates ONLY the costly Haiku scene-blueprint pre-pass (default OFF). The
  // free grounding helpers (promise-ledger, voice-exemplars) run unconditionally
  // for qualifying requests — see /api/ai/generate/route.ts. Was "quality_stack"
  // until the 2026-06-21 panel eval showed the bundled all-or-nothing flag
  // couldn't express "keep the free helpers, skip the costly one."
  sceneBlueprint:      "scene_blueprint",
  streaming:           "streaming",
} as const;
