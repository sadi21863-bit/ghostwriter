# Underused / Half-Wired Features — Verified Backlog (2026-06-29)

User-supplied audit of built-but-underused capabilities, **verified against the codebase**. Every claimed feature was confirmed to exist. The "underused" judgment is largely accurate — most are buried in settings panels, gated behind flags, or endpoint-only (a direct symptom of the additive-complexity / dual-shell history, now that the shell is consolidated). Mapped to the existing funnel roadmap where they belong.

Legend: ✅ exists (verified) · 🟡 partially surfaced · ❌ not surfaced

| # | Feature | Verified location | Surfacing | Roadmap home |
|---|---|---|---|---|
| 1 | World/Story Bible + relationship links | `relationship-map/route.ts`, `ConstellationView.tsx`, `characterRelationships` table, `entity-extraction.ts` | 🟡 graph exists but char-only, buried | **Story Graph upgrade** (queued) |
| 2 | Series/Universe architecture | `universes`/`universe_events`/`project_character_states` tables, `buildSeriesUniverseContext` | 🟡 schema+context only, no dedicated path | New: "Series/Universe product path" (backlog) |
| 3 | Voice fingerprint + Style DNA | `voice-fingerprint.ts` (10 markers), Style DNA in engine | 🟡 passive display in settings | Funnel #2 follow-up: "Lock Voice" lever in Write/Polish |
| 4 | AI Initiative (Leads/Collab/Assists) | `aiInitiative` col, WorldBiblePanel settings | 🟡 hidden setting | Funnel #2 follow-up: visible stage-header chip |
| 5 | Quality Stack + `/api/ai/refine` (AI Editor) | `scene-blueprint.ts`, `exemplars.ts`, `promise-ledger.ts`, `rhythm.ts`, `/api/ai/refine` | 🟡 flag-gated, experimental-feeling | **Funnel #4 (Editor data)** — pull refine/rhythm/exemplars into a real "Refine this scene" Editor flow |
| 6 | Multi-agent pipelines | `usePipelines.ts` | 🟡 presented as single-shot | **Funnel #5 (production-as-pipeline)** — show Plan→Generate→QA→Package stages |
| 7 | Reader share + heatmap analytics | `reader/[token]/page.tsx`, reactions/heatmap wired | 🟡 share link only, no author-facing insights | New: "Reader Insights panel" → feeds Editor (backlog) |
| 8 | Density dial + advanced modes | `useDensity`, `minDensity` on ModeConfig | 🟡 ToolbarPanel pill, obscured by new shell | Funnel #2 follow-up: density as global project setting, mapped to stages |
| 9 | Production/Comic/Audio studios | `ProductionStudio.tsx`, `ComicStudio.tsx`, `AudioNovelPanel.tsx` | 🟡 reachable but generate-first, no Director/Editor gating | **Funnel #4/#5 + Comic overhaul** — wrap in Director-plan → Editor-QA pipeline |
| 10 | Admin / cost monitoring | `/api/admin/cost-report`, **+ `/api/admin/analytics`, `/api/admin/cache-stats`** (more than claimed) | ❌ endpoint-only, no UI | New: internal "Ops" dashboard (backlog, low priority) |
| 11 | Semantic + prompt caching | `semantic-cache.ts`, prompt-cache (static block) | ❌ no cache-hit UX/metrics surfaced (though `cache-stats` endpoint exists) | Folds into old #3 "AI plumbing" (semantic-cache key schema) |

## Found more (beyond the 11)

- `storyCheckpoints` / `storyPromises` / `storyThreads` tables — structured continuity artifacts, likely underused in UI (candidate nodes for the Story Graph).
- `character_evolution_log` — per-chapter character evolution tracking; surfaced thinly.
- Work-packet **craft library** (18 packets + embeddings) — powers voice-exemplar retrieval but isn't user-browsable (a Discover-stage asset, overlaps with Story Resources).
- `classifyBeat`/`BeatDetectionChip` + `CraftDepthChip` — surfaced but subtle.
- Surgical Edit / Fix Weakness / Adapt — wired but could be more prominent in the new funnel rails (the capability registry now catalogs the first two as Editor caps).

## How this informs the roadmap

The audit **validates** the funnel direction: the biggest "underused" clusters (Quality Stack/refine = Editor, pipelines = production pipeline, relationships = Story Graph, studios = Produce) are already roadmap sub-projects. The capability registry (sub-project #1) is the mechanism that surfaces #5/#6/#9 by tagging them with role+stage. The net-new backlog items this adds: Series/Universe product path (#2), Reader Insights panel (#7), Ops dashboard (#10), and the Voice/AI-Initiative/Density "first-class levers" (#3/#4/#8) as funnel-#2 follow-ups.

**No new code from this pass — it's a verified backlog to draw from as each sub-project lands.**
