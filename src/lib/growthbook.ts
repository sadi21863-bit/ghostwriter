// Pure flag-key constants, deliberately zero SDK dependency -- this file is
// imported by both client components (WritingRoom.tsx) and the server-only
// /api/ai/generate route. It previously also exported createGrowthBook()
// (unused everywhere, confirmed by grep), which imported GrowthBook from
// @growthbook/growthbook-react at module scope -- that pulls in React.createContext
// even for callers who only wanted FLAGS, and crashed the server route
// ("createContext only works in Client Components"). Removed rather than fixed in
// place, since it had zero real callers.
//
// Phase 0 / v4 item 8 — GrowthBook flag decisions.
// The seven keys below were DELETED because they had zero production readers and
// zero test readers: craft_library, constellation_view, draft_branching,
// reader_mode, command_palette, adaptive_onboarding, new_design_tokens. A flag
// nothing reads is a dormant branch someone must reason about forever.
//
// `home_redesign` was also deleted. Its only read site was
// `if (homeRedesign) return <Home />` in app/dashboard/page.tsx, and the flag is
// OFF in production, so that branch never ran. Per v4, an obsolete pre-Story-OS
// shell must not be enabled.
//
// `src/components/Home.tsx` has since been DELETED, not just disconnected: the
// import graph proved nothing else referenced it, and everything it imported
// (EmptyState, next-action, formats) is used elsewhere. One consequence is
// tracked in docs/migration/dead-code-ledger.md — removing Home.tsx orphaned
// BraindumpModal, which nothing now renders.
//
// Two flags remain live. Both are documented in
// `docs/migration/growthbook-flag-decisions.md` with their promote/quarantine
// decision; per v4, no NEW product architecture may hide behind GrowthBook —
// use explicit capability availability instead.
export const FLAGS = {
  // Gates ONLY the costly Haiku scene-blueprint pre-pass (default OFF). The
  // free grounding helpers (promise-ledger, voice-exemplars) run unconditionally
  // for qualifying requests — see /api/ai/generate/route.ts. Was "quality_stack"
  // until the 2026-06-21 panel eval showed the bundled all-or-nothing flag
  // couldn't express "keep the free helpers, skip the costly one."
  //
  // v4 decision: QUARANTINE as an experimental capability. It is retained only
  // because its Haiku call is covered by contract tests
  // (src/lib/ai/__tests__/scene-blueprint.test.ts) and carries explicit budget
  // metadata (SCENE_BLUEPRINT_CAPABILITY). It must not remain a silent disabled
  // production path.
  sceneBlueprint:      "scene_blueprint",

  // Client-only. Default OFF. Swaps generateStream() for generate() plus a
  // typewriter editor effect. v4 decision: PROMOTE and test, then remove the
  // flag in Phase 1, once the streaming path is production-tested and is no
  // longer a dormant fork — non-stream must become a provider fallback rather
  // than a parallel untested product branch.
  streaming:           "streaming",
} as const;