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

## External research (2026-07-05)

Confirmed via direct code read: `ConstellationView.tsx` today is view-only — `onNodesChange` lets you drag existing nodes to reposition them, but there is no `onConnect` (no wire-drawing between nodes) and no `onDrop`/drag-from-palette (no creating new nodes on canvas). Same absence checked and confirmed in the separate dashboard-level Series/Universe system (`UniverseShelf.tsx`, `BibleShelf.tsx`) — zero drag-and-drop anywhere in the app outside one unrelated file (`SceneView.tsx`).

Researched the reference tools this vision is modeled on, plus a few more:

- **Orange** (data mining): drag widgets from a category-grouped sidebar (Data/Visualize/Model/Evaluate) onto a canvas, wire outputs→inputs; each widget does one task, typed data flows downstream. Confirms the "widgets grouped by role, wired into workflows" mapping in the table above is the right shape. [orangedatamining.com](https://orangedatamining.com/home/visual-programming/)
- **Visuino** (Arduino): drag hardware/logic components, wire them via pin-to-pin "OpenWire" connections, compiles the diagram straight to real Arduino C++. Useful precedent for *compiling a graph to a real artifact* rather than just simulating one — the story-graph equivalent is a wire literally triggering a real generation call via the capability action layer (already the plan). [visuino.com](https://www.visuino.com/)
- **Unreal Engine Blueprint**: select a node cluster → right-click → **Collapse Nodes** → becomes one node with its own input/output ("tunnel") pins; double-click to re-enter and edit the internals. This is the concrete, well-documented mechanism Phase 4 ("subgraphs") should copy — a saved arc becomes a literal collapsible/expandable graph node, not a separate abstraction. [Collapsing Graphs — UE5 docs](https://docs.unrealengine.com/5.0/en-US/collapsing-graphs-in-unreal-engine/)

**Reframing for the phased plan**: Phase 2 ("canvas drag-wire UI") was flagged as the hard unknown, but GhostWriter already runs on `@xyflow/react`, and React Flow's own official examples cover exactly the two missing interactions — [Drag and Drop](https://reactflow.dev/examples/interaction/drag-and-drop) (sidebar→canvas via native HTML5 drag API + `onDrop`), [Add Node on Edge Drop](https://reactflow.dev/examples/nodes/add-node-on-edge-drop) (drag a wire into empty space to spawn a connected node), and [Connection Events](https://reactflow.dev/examples/interaction/connection-events) (`onConnect` + `addEdge`). This is not a research problem, it's copying three documented patterns from the library already in `package.json`.

Phase 4 is the actually-open design question, and it's smaller than it looks: the *content* half already exists (`src/lib/graph/arc-presets.ts` has Three-Act/Hero's-Journey/Save-the-Cat as data, used today by `story-plans`' zero-AI-spend preset scaffolding). What's missing is only the *collapse-a-live-canvas-selection-into-one-named-node* UI half, Blueprint-style.

## Status

North-star design only. Concrete next step when this sub-project is picked up = Story Graph **Phase 1** (multi-entity nodes on the existing ConstellationView). Everything downstream depends on Phase 1 + the capability registry (done).
