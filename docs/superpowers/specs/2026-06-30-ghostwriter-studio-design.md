# Ghostwriter Studio — Reviewed & Polished Design (2026-06-30)

Review of the user's "Ghostwriter Studio" proposal (ikalas/TinyWow toolbox + GoJS/React-Flow/
Cytoscape/Rete graph engines + Mermaid/Kroki auto-diagramming), with my own research and a
sharper architecture that ships *better* by reusing what GhostWriter already has.

## Verdict in one line

The proposal's **three buckets are the right mental model**, but the proposed **tech stack is
2–3× larger than it needs to be**. ~70% of "Studio" already exists in this codebase (capability
registry, React Flow graph, dataflow engine, graph-health). The win is **consolidation into one
Studio shell**, not adopting ~10 new libraries.

## What the proposal gets right (keep)

- **Studio = a story-specific toolbox**, not generic dev utilities. ✅ Correct framing.
- **Graph + Pipelines as the two core visual surfaces.** ✅
- **Auto-diagramming from structured story data** (no hand-written Mermaid). ✅
- **Tiny, sharp, story-centric mini-tools** ("detect orphaned threads", "underused characters"). ✅
  — and we already shipped the first of these as `analyzeGraphHealth` (graph-health probes).

## What to change (research-backed)

| Proposal | Decision | Why |
|---|---|---|
| GoJS for graphs | **Drop entirely** | Commercial, *most restrictive* license on the market, no free tier, per-domain/per-app fees. Conflicts with the MIT React Flow already shipped. |
| Cytoscape.js / AntV X6 as the Story Graph engine | **Defer — lazy escape hatch only** | Cytoscape is the powerhouse for *large* graph-theory networks (WebGL, layouts, algorithms), but adds a second rendering paradigm. Only adopt when a real project exceeds React Flow's comfort (~hundreds of visible nodes). |
| Rete.js / Flume for the pipeline node editor | **Don't adopt** | `src/lib/graph/graph-program.ts` already IS the dataflow engine (Rete's `rete-engine` equivalent): node-selection → capability → preflight + cost + `requiresConfirm`. Rendering rides React Flow. Adopting Rete = a parallel framework for something we built. |
| React Flow | **Keep — single canvas for BOTH surfaces** | MIT, React-native, viewport-virtualized, already in use (`@xyflow/react` v12, `ConstellationView`). One lib for Story Graph *and* Pipelines. |
| Mermaid / Kroki / JSON Crack as a dependency | **Export-only, not UX** | The live UX is our React layer over real data. Generate Mermaid/Graphviz *text* as a secondary portable export (one pure serializer, no runtime dep). |
| LeaderLine / jsPlumb for "light" views | **Not needed** | React Flow + plain SVG/HTML cover the light cases; one fewer lib. |

**Net stack:** React Flow (have) + the existing registry/graph-program/graph-health spine + one
pure Mermaid/Graphviz exporter. Cytoscape stays on the shelf as a documented escape hatch.

## The core reframe: Studio is a shell over an existing spine

GhostWriter already has every primitive the three buckets call for:

| Proposal bucket | Inspiration | GhostWriter primitive that already exists |
|---|---|---|
| Toolbox grid (ikalas/TinyWow/DevToys) | grid of small tools | **Capability registry** (`src/lib/capabilities/registry.ts`) — every tool already tagged `{role, stage, provider, gate, cost, endpoint}`, grouped by role/stage. The grid is a *view* of this. |
| Graph engine (GoJS/Cytoscape/React Flow) | interactive network | **Story Graph** (`story-graph.ts` builder + `ConstellationView` on React Flow) + **graph-health** probes. |
| Node editor / pipelines (Rete/React Flow) | wire blocks | **graph-program.ts** dataflow engine + the **run-plan endpoint** (`POST /graph/run-plan`) — preflight + cost + confirm, *never auto-fires*. |
| Auto-diagram (Mermaid/Kroki) | text→diagram | The graph builder already turns World-Bible data into nodes/edges; add pure serializers for portable export. |

**Why this is structurally better than ikalas/TinyWow:** their tools are *stateless converters*
(JWT decode, Word→PDF). GhostWriter's "tools" are **stateful, story-aware, tier-gated, cost-priced
capabilities**. The palette, per-tool availability, and spend preflight all fall out of the typed
registry for free — something a generic toolbox can't do.

## Studio = four panes, one shell

A single `/project/[id]/studio` surface (or a Studio tab in the existing app), with a tool-grid
launcher into four panes — all reading the same registry + graph data:

1. **Graph** — the multi-entity Story Graph (characters/locations/threads/world-entities, the
   `involves`/`drives`/`appears_at`/`relationship` edges already built). Read + *edit on canvas*
   writing back to the World Bible link-arrays (bidirectional — the proposal treated the graph as
   read-only; our link-array model makes editing cheap).
2. **Pipelines** — node-based editor where entity/data nodes wire into capability nodes. Running a
   wire = `buildRunPlan` → cost-estimate + **QA-before-spend confirm** → the capability's own
   endpoint. This is the differentiator the proposal's pipeline editor lacks: **paid runs are
   gated**, never auto-fired.
3. **Analytics** — graph-health score + issues (isolated cast, unrooted threads, unused elements),
   plus the existing tension-curve / arc-heatmap / character-presence tools surfaced as cards.
4. **Exports** — PDF/EPUB/screenplay/CBZ (have) + a new **portable diagram export** (Mermaid /
   Graphviz text of the current graph) for sharing outside the app.

## Features to ADD beyond the proposal (my contributions)

- **Cost-gated graph execution** — wire-runs go through `isCapabilityAvailable` + `estimatePipelineCost`
  + a confirm modal. The "QA-before-spend" / CINE-LOCK discipline applied to the canvas. *(engine done; needs the modal + canvas affordance.)*
- **Live graph-health overlay** — colour/badge nodes by their health issues (isolated = amber, unrooted
  thread = red) directly on the canvas, not just a list. Turns probes into a debugging HUD.
- **Bidirectional canvas editing** — drag an edge character→thread ⇒ writes `linkedPlotThreadIds`;
  the proposal's graph is view-only. *(link-array model already supports it.)*
- **Subgraph presets** — package an arc (Hero's Journey, Three-Act, Detective) as a reusable node
  with ports (Story-Graph Phase 4). Only generalise after one is used in anger.
- **Registry-driven palette with availability** — the tool grid greys out tier-gated/keyless tools
  and shows per-run cost from the registry — impossible in a stateless toolbox.
- **Probe cards** ("orphaned threads", "underused characters", "POV drift") = thin reads over the
  graph; each is a `graph-health`-style pure analyzer, trivially unit-tested and added over time.

## Phased plan (most of Phase 0 already shipped)

- **Phase 0 — Spine (DONE):** capability registry, Story-Graph builder + ConstellationView, graph-program
  dataflow engine, run-plan endpoint, graph-health probes. *No new libs.*
- **Phase 1 — Studio shell + Graph pane:** a `/studio` route with the tool-grid launcher (reads the
  registry envelope) and the existing graph as the first pane; add the live graph-health overlay.
- **Phase 2 — Pipelines pane:** React-Flow canvas where wiring a capability node to entity nodes calls
  `run-plan` → cost-confirm → execute. Reuse `ProductionPipelineBar`'s gate UX.
- **Phase 3 — Analytics pane:** graph-health card + tension-curve/arc-heatmap/presence probes as cards;
  add 2–3 new pure probes (underused-character, POV-drift).
- **Phase 4 — Exports + subgraph presets:** Mermaid/Graphviz serializer; arc-preset subgraph nodes.
- **Phase 5 (escape hatch):** if a real project's graph gets too big for React Flow, add a Cytoscape
  renderer behind the *same* graph data — swap the view layer only, keep the engine.

## Risks / non-goals

- **No GoJS** (license). **No second graph lib until a real perf wall is hit** (avoid premature Cytoscape).
- **No Rete** — would duplicate `graph-program`.
- Studio must reuse the **one execution path** (`capabilityAction` / run-plan), never a parallel one
  (MASTER-PLAN invariant). The canvas is just a third surface, like the funnel rails and slash menu.
- Keep paid runs **always behind a confirm** — the graph must never auto-fire a fan-out of paid generations.

## Sources (research)
- JointJS, "Top 8 JavaScript diagramming libraries in 2026" — GoJS licensing, JointJS virtualization, Cytoscape for networks.
- portalZINE, "Open-Source Diagram Tools to Replace GoJS" — GoJS commercial restrictiveness.
- Rete.js v2 docs + DEV/Medium writeups — `rete-engine` dataflow/control-flow (the pattern graph-program already implements).
- React Flow (reactflow.dev) — node-based UIs, viewport virtualization, MIT.
- xyflow/awesome-node-based-uis — landscape of node-editor libraries.
