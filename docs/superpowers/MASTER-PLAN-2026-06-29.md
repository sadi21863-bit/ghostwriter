# GhostWriter Master Architecture & Wiring Plan (2026-06-29)

The single source of truth for how every initiative connects. Read this before starting any sub-project so the piece you build plugs into the spine instead of becoming another bolt-on. Each individual sub-project still has its own spec/plan; this doc is the map that ties them together.

---

## 1. The thesis (one paragraph)

Everything GhostWriter's AI does is a **Capability** tagged with a **role** (Director / Writer / Editor) and a **stage** (Discover / Shape / Write / Produce). One **capability registry** is the spine. Capabilities are *executed* from a small number of **surfaces** (the funnel rails, the slash menu, and — later — the story-graph canvas), never from bespoke per-feature wiring. Each role owns a **first-class persisted artifact** (Director → beat sheets; Writer → chapters; Editor → notes/issues). Generation flows **forward through the four stages**, and anything that spends real money in **Produce** (comic/video/audio) is gated by the **Editor's approve step** (QA-before-spend). Cross-cutting systems — the World Bible / story graph, the context builder, voice/style, caching/Headroom — feed every stage. That's the whole architecture; every initiative below is one node in it.

---

## 2. The spine + the three layers

```
                          ┌─────────────────────────────────────────────┐
   SURFACES (run caps)    │ Funnel rails ✅ · Slash menu ✅ · Story-graph │
                          │ canvas ⏳ (all read the registry, no logic)  │
                          └───────────────┬─────────────────────────────┘
                                          │ getCapabilities() / supportEnvelope()
   SPINE                  ┌───────────────▼─────────────────────────────┐
   (single source)        │ Capability Registry ✅  src/lib/capabilities │
                          │ Capability{ role, stage, provider, gate }    │
                          │ isCapabilityAvailable() = preflight/cost-gate│
                          └───────────────┬─────────────────────────────┘
                                          │ capabilities are…
   EXECUTION              ┌───────────────▼─────────────────────────────┐
                          │ modes → /api/ai/generate · tools → own routes │
                          └───────────────┬─────────────────────────────┘
                                          │ produce/consume…
   ROLE DATA              ┌───────────────▼─────────────────────────────┐
                          │ Director: story_plans ✅  Writer: chapters ✅ │
                          │ Editor: notes/issues + approve-gate ⏳        │
                          └─────────────────────────────────────────────┘
```

✅ shipped · ⏳ planned. The spine (registry) and two surfaces (rails, slash) and two role-datas (Director beat sheet, Writer chapters) are **already in place**. Everything remaining hangs off these exact attachment points.

---

## 3. The wiring table — how each piece connects to the others

| Piece | Status | Reads from | Writes / feeds | Attachment point |
|---|---|---|---|---|
| **Capability registry** | ✅ | MODE_REGISTRY (+role/stage) + TOOL_REGISTRY | the 3 surfaces | `src/lib/capabilities/registry.ts` |
| **4-stage funnel + rails** | ✅ | registry envelope (`/api/capabilities`) | runs caps via `capabilityAction` | `funnel.ts` + `StageRoleRail` |
| **Director beat sheet** | ✅ | World Bible (char/thread names→ids) | Writer (draft-from-beat), Editor (coverage), Comic (panel planning), Story Graph (beat nodes) | `story_plans` + `BeatSheetPanel` (Shape) |
| **Editor data + approve-gate** | ⏳ #4 | drafts, quality-stack (refine/rhythm/exemplars/story-health/AIisms), beat-sheet coverage | gates Produce pipelines | new `notes`/`issues` tables + `/api/editor/*` |
| **Production-as-pipeline** | ⏳ #5 | Editor approval, beat sheet, World Bible | comic/video/audio adapters | wraps existing `usePipelines` + production routes |
| **Story Graph / visual programming** | ⏳ | World Bible + beats + chapters (nodes); registry (edge `capabilityId` = widget) | a *third surface* that runs caps | extend `ConstellationView` + `relationship-map` |
| **Story Resources** | ⏳ small | static catalog | Discover-stage inspiration | `inspiration-sources.ts` + panel |
| **Comic Studio overhaul** | ⏳ (B1 halted) | beat purposes (layout), char ref sheets, Editor approval | Produce output | 5-phase plan in the B1 doc |
| **Underused features** | audit | — | map onto roles (see §6) | backlog doc |
| **Headroom** | ⏳ last | every AI call | token compression | proxy/wrapper under engine |

**The key connections (don't break these):**
- Every surface runs caps **only** through `getCapabilities()` + `capabilityAction()`. No surface re-implements "what can I do here." The story-graph canvas is just a third surface — reuse the same path.
- Beat-sheet beats already carry `characterIds`/`threadIds` resolved against the World Bible → they are **graph-ready nodes** and **context-ready** (the context builder can pull only the cast/threads a beat names).
- The Editor approve-gate (#4) is the **single chokepoint** before any paid Produce generation (comic/video/audio). Comic Phase 4 and the video pipeline both pass through it — same "QA-before-spend" discipline (CINE-LOCK / `video-use` self-eval / `ai-film-director-mega-skill`).

---

## 4. Data flow across the four stages (the forward spine)

```
DISCOVER  research/concept ─► Story-graph seeds (themes, rough cast) ─► Story Resources for inspiration
   │  entities get promoted to real World Bible rows
   ▼
SHAPE     World Bible (chars/locations/threads) ◄──► Story Graph ◄──► Beat Sheet (Director ✅)
   │  beats reference real characterIds/threadIds; voice/style calibration ("Lock Voice")
   ▼
WRITE     draft beats → chapters (Writer ✅); context builder injects only graph-connected
   │      cast/threads + voice fingerprint + story memory; refine/rhythm available (Editor)
   ▼
PRODUCE   Editor review (notes/issues, approve-gate ⏳ #4) ─► APPROVED ─► Produce pipelines (⏳ #5):
          Comic (5-phase) · Video (per-shot+stitch ✅, +EDL/self-eval) · Audio — all gated by approval
```

Cross-cutting (feed every stage): **context builder** (graph-driven selection), **capability preflight** (`isCapabilityAvailable`), **caching/Headroom**, **AI Initiative** (Leads/Collab/Assists — how aggressively caps auto-fire).

---

## 5. Dependency-ordered build plan (what unlocks what)

1. ✅ **Capability registry** — spine. Unlocks every surface + preflight.
2. ✅ **4-stage funnel + role rails** — first surface; makes roles visible.
3. ✅ **Director beat sheet** — first role-data; feeds Writer/Editor/Comic/Graph.
4. ⏳ **Editor data + approve-gate (#4)** — *highest-value next*. Pulls the already-built quality-stack (refine/rhythm/voice-exemplars/story-health/AIisms) into a real Editor flow with persisted notes/issues + an approve step. **Unlocks the Produce gate** that #5 and the Comic/Video pipelines depend on. Build this before any Produce-pipeline work.
5. ⏳ **Production-as-pipeline (#5)** — wraps comic/video/audio in Director-plan → generate → Editor-QA → package, gated by #4's approval. Reuses `usePipelines`. Apply `video-use` EDL+self-eval and `ai-film-director-mega-skill` CINE-LOCK patterns (MIT, adaptable).
6. ⏳ **Story Graph Phase 1** (multi-entity nodes) → **Phase 2** (dataflow on 1–2 pipelines, using registry caps as widgets) → 3 (probes) → 4 (subgraphs). The visual-programming north star; every phase rides the registry + `capabilityAction`.
7. ⏳ **Comic Studio overhaul** — Phase 1 generation-core (batched page gen + char ref sheets + style presets) is the real non-toy unlock; B1 lettering is Phase 2. Gated by #4 at Phase 4.
8. ⏳ **Story Resources** — small, drop in anytime (Discover).
9. ⏳ **Headroom** — last; compression under all AI calls once flows are stable.

**Why this order:** #4 is the linchpin — it's both the missing AI-Editor surface (validated by the underused-features audit: refine/rhythm/story-health all exist but feel experimental) AND the approve-gate every paid Produce flow needs. Doing #4 before #5/Comic/Video means those pipelines plug into a real gate instead of generating-first.

---

## 6. Where every loose feature/idea slots (nothing orphaned)

| Loose item (from audits/research) | Home |
|---|---|
| Voice fingerprint, Style DNA | Writer levers — "Lock Voice" in Write/Polish (funnel #2 follow-up) |
| AI Initiative (Leads/Collab/Assists) | Cross-cutting cap-autofire setting — visible stage-header chip |
| Quality stack: refine, rhythm, voice-exemplars, story-health, AIisms | **Editor data #4** — the core of it |
| Multi-agent `usePipelines` | **Production pipeline #5** — make stages visible |
| Reader share + heatmap | Editor feedback loop — "cold chapters → run Fix This" (post-#4) |
| Density dial + advanced modes | Global project setting; modes already carry stage/role in registry |
| Series/Universe architecture | New "Series/Universe product path" (rides the same stages) |
| Relationships / ConstellationView | **Story Graph** (the visual-programming surface) |
| Semantic + prompt caching | Old AI-plumbing item + Headroom |
| Admin cost/cache/analytics endpoints | Ops dashboard (low priority) |
| Density/beat/craft chips, Surgical Edit, Fix Weakness, Adapt | already cataloged as registry caps; surface in the rails |

---

## 7. Invariants (the rules that keep it wired)

1. **One spine:** new AI action → add a `Capability` (extend MODE_REGISTRY or TOOL_REGISTRY), never a bespoke surface hook. The drift-guard test enforces endpoints stay real.
2. **One execution path per surface:** surfaces call `capabilityAction()`; they don't branch on feature names.
3. **One Produce gate:** no paid media generation without Editor approval (#4). Comic/Video/Audio all pass through it.
4. **Typed JSONB everywhere:** new structured blobs get `decode`/`encode` guards in `src/lib/types/story.ts` (the pattern is set: aiRules, character JSONB, memory, beats).
5. **Preflight before spend:** `isCapabilityAvailable` (tier/key/format) gates UI affordances and pipeline steps; cost-estimate before running a graph/pipeline.
6. **Forward stages:** data flows Discover→Shape→Write→Produce; the guide engine's 5 internal stages map to the 4 funnel stages via `funnel.ts` (don't re-fork this).

---

## 8. Current state snapshot

Shipped this cycle: per-shot ref fix (real-money validated) · zod-typed JSONB · dual-shell deletion · capability registry (#1) · 4-stage funnel + rails (#2) · Director beat sheet (#3). **54 test files / 351 tests green, tsc clean.** Live DB migrations through 0013 (`story_plans`).

Next per §5: **Editor data + approve-gate (#4)** — the linchpin.
