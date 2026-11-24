# Dead-code ledger

v4 Phase 8 is "Cleanup/release: dead code/docs/perf/legacy archive". This file
records code that became unreachable **during the migration**, so that a later
phase can delete it deliberately instead of discovering it by accident — and so
nobody re-wires a component that the plan has already retired.

Each entry states how the code became dead and what evidence proved it. "No
references found" is a claim about the import graph, so each one was verified by
grep at the time of removal, not assumed.

## Deleted

| Code | Why it was dead | Evidence |
|---|---|---|
| `src/components/Home.tsx` | The `homeRedesign` flag it was gated behind is OFF in production, so `if (homeRedesign) return <Home />` never ran. v4 forbids enabling an obsolete pre-Story-OS shell. | Imported from exactly one place (`app/dashboard/page.tsx`), which was its only render site. Everything it imported is used elsewhere. Removed 2026-10. |

## Newly orphaned by that deletion

| Code | Status | Note |
|---|---|---|
| `src/components/BraindumpModal.tsx` | **Unreachable — needs Phase 8** | `Home.tsx` was its only renderer. The live dashboard has its own braindump flow (`creationMode` includes `'braindump'` in `app/dashboard/page.tsx`), so this modal is superseded, not merely orphaned. Not deleted here because "superseded by a different implementation" is a product judgement, and the dashboard's braindump path has not been compared against it feature-by-feature. |

## GrowthBook keys deleted (Phase 0 / v4 item 8)

Seven keys had zero production readers and zero test readers:
`craft_library`, `constellation_view`, `draft_branching`, `reader_mode`,
`command_palette`, `adaptive_onboarding`, `new_design_tokens`. Plus
`home_redesign` (see above). Each had exactly one definition site and no read
site. `src/lib/__tests__/growthbook-flag-decisions.test.ts` now fails if a flag
with no production reader is added back.

## Not dead — deliberately quarantined

| Code | Why it looks dead but is not |
|---|---|
| `src/lib/ai/scene-blueprint.ts` | Behind the `scene_blueprint` flag (default OFF), but retained per v4 as an experimental capability with contract tests and budget metadata. Not a dormant branch to delete. |
| `src/lib/roles/shared.ts` (`runMeteredCall`) | Not dead; it is the shared metering seam for the Director/Writer/Editor tools. |