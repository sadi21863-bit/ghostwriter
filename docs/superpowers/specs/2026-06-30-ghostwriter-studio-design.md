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

## Build philosophy: reuse aggressively, reimplement only what's blocked

**Decision (user directive 2026-06-30):** *Be intelligent — minimise work.* We **freely use the
permissively-licensed libraries** (no reinventing wheels) and only **reimplement-by-inspiration the
features that are license-blocked**. Concretely:

- **Use directly (MIT / permissive — already free):** **React Flow** (`@xyflow/react`, already in
  `ConstellationView`) as the canvas for Story Graph + Pipelines; **Cytoscape.js** *if/when* a graph
  outgrows React Flow (don't pull it in early); **Mermaid/Graphviz** libs for portable export;
  Rete's *pattern* we already mirror in `graph-program.ts`. These cost us nothing and save months.
- **Reimplement only the blocked bits:** **GoJS** (and JointJS's commercial tier) have great UX we
  want but a license we won't pay — so we copy *just those specific features* on top of the
  permissive stack (e.g. orthogonal link routing, minimap, palette, collapsible groups). Many of
  these React Flow already provides or has free community plugins for, so the actual reimplementation
  surface is small.
- **Own the domain layer regardless** — the story-aware node model, the capability dataflow +
  cost-gating, the health overlay, narrative-tuned layouts. That's GhostWriter's real value and is
  ~70% built; no library provides it.

The engine stays **decoupled from the renderer** so the substrate can be swapped later if ever needed
— but we do NOT build a canvas engine from scratch.

### Feature harvest — best idea from each (reuse the lib, or copy just the feature)

| Inspiration | License | What we do |
|---|---|---|
| **React Flow / X6** | MIT | **Use directly** — node-editor canvas (handles, snapping, controls, minimap, viewport virtualisation) for both panes. |
| **Cytoscape.js** | MIT | **Use when needed** — large-graph WebGL rendering + auto-layouts (force/concentric/BFS); lazy, only past React Flow's comfort. |
| **Rete.js / Flume** | MIT | **Pattern already ours** — dataflow execution (`graph-program.ts`); extend with control-flow. |
| **Mermaid / Graphviz** | MIT/EPL | **Use as export** — serialize our graph to portable Mermaid/Graphviz text. |
| **GoJS** | commercial | **Copy features only** — orthogonal link routing, link labels, drag-from-palette, collapsible groups/subgraphs, data-bound templates, undo/redo. Implemented on the React Flow substrate. |
| **JointJS** | open-core | **Copy features only** — clean port model + the commercial virtualisation idea (React Flow already virtualises). |
| **ikalas / TinyWow / DevToys** | n/a | **Copy the UX** — tool-grid launcher; ours reads the typed capability registry (stateful, gated, cost-priced — better than their stateless converters). |

**Net:** reuse React Flow (+ Cytoscape/Mermaid when warranted), copy a handful of GoJS UX features,
own the story-domain engine. No commercial deps, no license exposure, minimal new code.

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

## More features to add (researched — story tools + node-AI builders)

Beyond the proposal, two source families the original brief missed: **story/worldbuilding tools**
(Campfire, World Anvil) and **node-based AI workflow builders** (ComfyUI, Langflow, Flowise). The
strongest additive ideas, each cheap because the data already exists in GhostWriter:

1. **Timeline pane** (Campfire) — chronology of beats/scenes/events along horizontal timelines, with
   **multiple simultaneous timelines** for dual-timeline / multi-POV / series stories. Data already
   present: `story_plans` beats, `chapters.sortOrder`, `universe_events`, `storylineId`. High value,
   no new model.
2. **Character-arc track** (Campfire) — each character's trajectory across the manuscript (start →
   transformation beats → end). Data present: `character_evolution_log`, beat `characterIds`, the
   `arc` field. Renders as a swimlane under the timeline.
3. **Pipeline templates + JSON save/share/version** (ComfyUI) — save a wired pipeline as a reusable
   template; export/import as small JSON; version it. ComfyUI's killer trait. Maps onto our subgraph
   presets — a `pipeline_templates` artifact.
4. **Per-node playground / isolated run** (Langflow) — test ONE capability node in isolation (with the
   cost-confirm) before running the whole pipeline. Falls out of `buildRunPlan` for a single node.
5. **Pipeline-as-capability** (Langflow/MCP) — a saved user pipeline becomes a **first-class registry
   capability** other surfaces can call. This is the compounding feature: users *extend* the
   capability registry visually, no code. (Gated, cost-aggregated from its stages.)
6. **Run provenance** (ComfyUI embeds the workflow in output metadata) — store which graph/pipeline +
   inputs produced a chapter/comic/video, for reproducibility and "regenerate with the same recipe."
7. **Template gallery** (Flowise marketplace) — ship a few starter graphs/pipelines/arc-templates
   (Hero's Journey wiring, Three-Act beat graph) seeded per project; later shareable.
8. **Interactive location map** (World Anvil) — spatial pane for locations (lower priority; locations
   + `linkedCharacterIds` exist). Defer unless asked.

These slot into the phases below (Timeline+arcs → Phase 3 Analytics; pipeline templates / playground /
pipeline-as-capability → Phase 2 Pipelines; provenance → cross-cutting; gallery → Phase 4).

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
- **Phase 5 (scale, lazy):** when a real project's graph outgrows React Flow, **drop in Cytoscape.js**
  (MIT) behind the *same* engine + graph data — swap the view layer only, no rewrite, no new license.

## Risks / non-goals

- **Reuse-first** — use the MIT/permissive libs directly (React Flow now, Cytoscape/Mermaid when
  warranted). Only GoJS/JointJS-commercial features are reimplemented, and only the specific ones we
  want, on top of the permissive stack. No commercial deps, no license exposure.
- **Don't reinvent the canvas** — never build pan/zoom/virtualisation from scratch; own the
  domain/execution layers (high leverage), lean on libraries for the substrate.
- Studio must reuse the **one execution path** (`capabilityAction` / run-plan), never a parallel one
  (MASTER-PLAN invariant). The canvas is just a third surface, like the funnel rails and slash menu.
- Keep paid runs **always behind a confirm** — the graph must never auto-fire a fan-out of paid generations.

## Sources (research)
- JointJS, "Top 8 JavaScript diagramming libraries in 2026" — GoJS licensing, JointJS virtualization, Cytoscape for networks.
- portalZINE, "Open-Source Diagram Tools to Replace GoJS" — GoJS commercial restrictiveness.
- Rete.js v2 docs + DEV/Medium writeups — `rete-engine` dataflow/control-flow (the pattern graph-program already implements).
- React Flow (reactflow.dev) — node-based UIs, viewport virtualization, MIT.
- xyflow/awesome-node-based-uis — landscape of node-editor libraries.
- Loreteller / Kindlepreneur / ScribeCount — Campfire Write modules (Relationships map, Timelines, Arcs) + World Anvil (wiki, interactive maps, timelines, 25+ templates).
- ComfyUI docs / Creators AI — node workflow templates, JSON save/version/share, workflow embedded in output metadata.
- Leanware "Langflow vs Flowise" / Runchat comparison — per-component playground (isolated debugging), flow-as-reusable-tool via API/MCP, Flowise template marketplace + multi-agent orchestration.
