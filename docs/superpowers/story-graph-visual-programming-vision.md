# Story Graph → Visual Programming Environment — North-Star Vision (2026-06-29)

Design-only capture. Expands the queued "Story Graph upgrade" sub-project with a LabVIEW/Orange/Tinkercad-inspired visual-programming direction. **Not built — this is the north star to build toward incrementally.**

## The convergence insight

The visual-programming vision is the convergence of three things, two of which already exist:

- **Nodes** = Story Graph entities (characters/locations/threads/events/chapters). Already rendered by `ConstellationView` on React Flow (`@xyflow/react`).
- **Widgets** = capabilities from the **capability registry** (`src/lib/capabilities/registry.ts`, shipped sub-project #1). Each `Capability` is already an Orange-style one-task node: a role (Director/Writer/Editor), a stage, declared availability/inputs (`isCapabilityAvailable` = preflight/cost-gate). ~40% of the "widget" primitive is done.
- **Wires** = edges carrying a `capabilityId` (proposed in the Story Graph Phase-1 design): connecting entity nodes to a capability runs that capability on those nodes as input.

Dataflow execution = "run a capability when its wired inputs are present; `isCapabilityAvailable` gates spend so we don't blind-fire /api/ai/generate." The registry was the right foundation precisely because it makes this possible without re-plumbing.

## Mapping to reference tools

| Reference | Concept | GhostWriter equivalent |
|---|---|---|
| Orange | widgets grouped by function, wired into workflows | Capability registry grouped by role (StageRoleRail already groups Plan/Generate/Review) |
| LabVIEW | dataflow: node fires when inputs ready; subVIs for reuse | run-capability-on-wired-nodes; subgraphs = saved arc patterns |
| Tinkercad/SimulIDE | probes/oscilloscope on signals | probes on edges (scenes where A&B interact; tension-over-time) |
| Flowcode | flowchart blocks for non-technical users | step-view that compiles to the underlying graph |

## Phased plan (hold this staging line — it's the most ambitious roadmap item)

- **Phase 1 — Graph view (realistic next):** multi-entity nodes (add locations/threads/events to the char-only ConstellationView), typed edges, edit on canvas. No execution. Builds on existing React Flow + `relationship-map` endpoint.
- **Phase 2 — Minimal dataflow (realistic):** wire 1–2 pipelines using registry capabilities as widgets (e.g. Outline→Scene Generator→StoryHealth; Thread→Shot-List→Trailer). Wires drive existing APIs via the capability action layer (`src/lib/capabilities/actions.ts` already routes capability→action). `isCapabilityAvailable` gates spend.
- **Phase 3 — Probes & debugging (later):** metrics per edge (scenes per relationship, unused/dangling edges, unresolved threads); heat/width on edges. This is the Editor's graph-health surface.
- **Phase 4 — Subgraphs & presets (last):** package an arc (Hero's Journey, Romantic Triangle, Detective Investigation) as a reusable subgraph node with ports; only generalize after users actually use one.

## Ruthless notes

- The "story simulation / tension-over-time oscilloscope" (Phase 3) is the most beautiful but highest effort-to-validation idea — do it last, after Phase 1–2 prove users wire things at all.
- Dataflow that fires real AI calls MUST go through `isCapabilityAvailable` + a confirm/cost-estimate step (OpenMontage/CINE-LOCK "QA-before-spend" pattern, and the MIT `ai-film-director-mega-skill` checklists) — never auto-fire a graph of paid generations on every edit.
- This is the same surface as the AI-role split: the graph becomes a third place (with the funnel rails and the slash menu) where the same role-tagged capabilities run. Don't build a parallel execution path — reuse the registry + actions layer.

## Status

North-star design only. Concrete next step when this sub-project is picked up = Story Graph **Phase 1** (multi-entity nodes on the existing ConstellationView). Everything downstream depends on Phase 1 + the capability registry (done).
