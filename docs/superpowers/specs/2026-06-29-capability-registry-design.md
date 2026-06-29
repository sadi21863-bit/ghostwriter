# Capability Registry — Design Spec

**Status:** Approved design, pre-implementation
**Date:** 2026-06-29
**Sub-project:** #1 of the "4-stage funnel + AI Director/Writer/Editor" roadmap (the foundation spine)

## Context

The user's directive: rebuild GhostWriter's UX around a 4-stage funnel (Discover → Shape → Write → Produce) with three explicit AI roles (Director = plan, Writer = generate, Editor = review/fix), folding in OpenMontage's research-first / capability-envelope pattern, keeping what's good and rebuilding what isn't.

Research finding that shapes this sub-project: all three roles **already exist** as endpoints, but only the 26 **Writer** generation modes have a single source of truth (`MODE_REGISTRY`). The Director tools (outline, tension-curve, arc-heatmap, villain-pov, generate-package, scene-to-video-prompt, creator trend/research tools) and Editor tools (story_health, prose-fix, surgical-edit, refine, knowledge-audit, transportation-check, retention-edit) are standalone endpoints with no catalog — which is exactly why they feel scattered.

A single capability registry that catalogs every tool with `{ stage, role, provider, gate, availability }` is simultaneously: the data model for the funnel (group by stage), the role taxonomy (group by role), and the OpenMontage tool registry (provider/availability for preflight). It is the spine the remaining sub-projects (#2 funnel UX, #3 Director data, #4 Editor data, #5 pipelines/preflight) all read from.

**This sub-project is purely an additive data/query layer. It changes no existing behavior and adds no UI.**

## Goals

1. One module that catalogs every Writer mode + standalone Director/Editor/creator/production tool under a unified `Capability` shape.
2. No duplication of `MODE_REGISTRY` — modes are extended in place with `role`/`stage` and mapped into the catalog.
3. An availability/preflight function + a `supportEnvelope` report ("what can I do in this environment?") exposed at `GET /api/capabilities`.
4. A drift-guard test so the registry can't silently diverge from the real routes/modes.

## Non-goals (explicitly deferred to later sub-projects)

- Any UI / funnel rendering (sub-project #2).
- New persisted artifacts — story_plans, notes/issues (sub-projects #3, #4).
- Cost estimation, pipeline-as-data (sub-project #5).
- Re-routing existing endpoints through the registry, or changing how any tool executes.

## Architecture

### The `Capability` type

```ts
export type CapabilityRole = "director" | "writer" | "editor";
export type CapabilityStage = "discover" | "shape" | "write" | "produce";
export type CapabilityProvider = "anthropic" | "segmind" | "openai" | "internal";

export interface Capability {
  id: string;                 // stable key: a GenerationMode for modes, or a tool slug
  label: string;
  kind: "mode" | "tool";      // mode → executes via /api/ai/generate; tool → own endpoint
  role: CapabilityRole;
  stage: CapabilityStage;
  provider: CapabilityProvider;
  gate: FeatureGate | null;   // reuse existing FeatureGate; null = ungated
  visibility: ModeVisibility; // "universal" | "story_only" | "story_and_creator" (reused from registry)
  endpoint?: string;          // for kind:"tool" — the API route path, e.g. "/api/ai/refine"
  experimental?: boolean;     // surfaced as "Advanced (unstable)" later; default false
}
```

### Two sources, one catalog

**Source 1 — Modes (extend `MODE_REGISTRY` in place).** Add two fields to `ModeConfig`:

```ts
role: CapabilityRole;     // brainstorm→"writer", outline→"director", write+craft modes→"writer"
stage: CapabilityStage;   // brainstorm→"discover", outline→"shape", write+craft→"write"
```

All 26 existing entries get these two fields. A mapper `modeToCapability(mode, cfg): Capability` produces `{ id: mode, kind: "mode", provider: "anthropic", label/gate/visibility from cfg, role/stage from the new fields }`.

**Source 2 — Standalone tools (`TOOL_REGISTRY`, a new array in `registry.ts`).** Each non-mode tool, with the same metadata. Initial catalog (provider/role/stage/gate/endpoint per tool):

| id | role | stage | provider | gate | endpoint |
|---|---|---|---|---|---|
| story_health | editor | write | anthropic | null | (client panel → /api/projects/[id]/… ; see note) |
| prose_fix | editor | write | anthropic | null | /api/ai/prose-fix |
| surgical_edit | editor | write | anthropic | null | /api/ai/surgical-edit |
| refine | editor | write | anthropic | null | /api/ai/refine |
| knowledge_audit | editor | produce | anthropic | null | /api/projects/[projectId]/knowledge-audit |
| transportation_check | editor | produce | anthropic | null | /api/projects/[projectId]/transportation-check |
| tension_curve | director | shape | anthropic | null | /api/projects/[projectId]/tension-curve |
| arc_heatmap | director | shape | anthropic | null | /api/projects/[projectId]/arc-heatmap |
| villain_pov | director | shape | anthropic | null | /api/projects/[projectId]/villain-pov |
| series_plan | director | discover | anthropic | null | /api/ai/series-plan |
| research_scaffold | director | discover | anthropic | null | /api/ai/research-scaffold |
| generate_package | director | produce | anthropic | null | /api/projects/[projectId]/production/generate-package |
| scene_to_video_prompt | director | produce | anthropic | null | /api/ai/scene-to-video-prompt |
| comic_generate | director | produce | segmind | comic_studio | /api/projects/[projectId]/comics |
| production_generate_video | writer | produce | segmind | null | /api/projects/[projectId]/production/scenes/[sceneNumber]/generate-video |
| audio_generate | writer | produce | openai | audio_novel | /api/audio/generate |
| trend_youtube | director | discover | anthropic | creator_tools_advanced | /api/ai/trend-youtube |
| trend_instagram | director | discover | anthropic | creator_tools_advanced | /api/ai/trend-instagram |
| trend_niche | director | discover | anthropic | creator_tools_advanced | /api/ai/trend-niche |
| trend_angles | director | discover | anthropic | null | /api/ai/trend-angles |
| creator_research | director | discover | anthropic | creator_tools_advanced | /api/ai/creator-research |
| analyze_reference_video | director | discover | internal (Gemini, server-key; see note) | creator_tools_advanced | /api/ai/analyze-reference-video |
| dissect_video | director | discover | anthropic | creator_tools_advanced | /api/ai/dissect-video |
| hook_ab | editor | shape | anthropic | null | /api/ai/hook-ab |
| score_hook | editor | shape | anthropic | null | /api/ai/score-hook |
| retention_edit | editor | produce | anthropic | creator_tools_advanced | /api/ai/retention-edit |
| virality_predict | editor | produce | anthropic | virality_predict | /api/ai/virality-predict |

Notes resolved during implementation, not left as open questions:
- **story_health** is invoked from a client panel that calls analysis endpoints rather than a single named route; its `endpoint` will be set to the actual route the panel hits (confirm `StoryHealthPanel`'s fetch target at implementation time) — if it composes multiple, omit `endpoint` and mark it `kind:"tool"` with no drift-guard endpoint assertion (the test treats missing `endpoint` as "not route-checked").
- **analyze_reference_video / dissect_video** use Gemini when `GEMINI_API_KEY` is set; provider is `"internal"` (server-side optional dep) so availability does not depend on a user key. Final provider value chosen at implementation by reading the route.
- This table is the *starting* catalog; the implementation may correct a slug/role/stage/gate/endpoint when reading the actual route, but every row must end up pointing at a real route (enforced by the drift-guard test).

### Unified accessor

```ts
export function getCapabilities(): Capability[];        // modes mapped + TOOL_REGISTRY, merged
export function getCapabilitiesByStage(stage): Capability[];
export function getCapabilitiesByRole(role): Capability[];
```

### Availability / preflight

```ts
export interface CapabilityContext {
  tier: SubscriptionTier;
  hasSegmindKey: boolean;
  hasOpenAIKey: boolean;
  format: string;            // project format, for visibility filtering
}
export interface CapabilityAvailability {
  available: boolean;
  reason?: "upgrade_required" | "missing_segmind_key" | "missing_openai_key" | "not_applicable_for_format";
}
export function isCapabilityAvailable(cap: Capability, ctx: CapabilityContext): CapabilityAvailability;
```

Logic, in order:
1. visibility vs format: `story_only` on a creator format (or a `creator`-only cap on a story format) → `{ available:false, reason:"not_applicable_for_format" }`. Reuse the existing `isCreatorFormat`/`isStoryFormat` helpers from `src/lib/formats.ts`.
2. gate: `cap.gate && !canAccessFeature(ctx.tier, cap.gate)` → `{ available:false, reason:"upgrade_required" }`.
3. provider key: `provider==="segmind" && !hasSegmindKey` → `missing_segmind_key`; `provider==="openai" && !hasOpenAIKey` → `missing_openai_key`.
4. otherwise `{ available:true }`. (`anthropic`/`internal` providers need no user key — server-side.)

```ts
export interface SupportEnvelope {
  stages: Record<CapabilityStage, Record<CapabilityRole, Array<Capability & CapabilityAvailability>>>;
}
export function supportEnvelope(ctx: CapabilityContext): SupportEnvelope;
```

### Endpoint

`GET /api/capabilities` — authenticated (`getRequiredSession`). Resolves `ctx` from the session user (tier via `getUserTier`, key presence via decrypt-non-empty checks on `segmindApiKey`/`openaiApiKey`) and a `?format=` query param (defaults to "Novel"), returns `supportEnvelope(ctx)`. Read-only; no mutations.

## Data flow

```
MODE_REGISTRY (+role,+stage) ─┐
                              ├─► getCapabilities() ─► supportEnvelope(ctx) ─► GET /api/capabilities
TOOL_REGISTRY ────────────────┘                            ▲
                                          isCapabilityAvailable(cap, ctx)
                                          (tier gate · provider key · format)
```

Later sub-projects consume `getCapabilities()` / `supportEnvelope()`; nothing consumes them yet in this sub-project beyond the endpoint + tests.

## Error handling

- `getCapabilities()` is pure/deterministic — cannot fail.
- `GET /api/capabilities` returns 401 without a session; never 500s on normal input (unknown `format` simply yields fewer applicable caps).
- The registry is the source of truth; if a route referenced by a `tool` capability is later deleted, the drift-guard test fails in CI rather than the endpoint failing at runtime.

## Testing

1. **Drift guard** (mirrors the existing `live-shell-reachability.test.ts` pattern): every `Capability` of `kind:"mode"` has an `id` that is a real `MODE_REGISTRY` key and appears exactly once; every `kind:"tool"` capability that declares an `endpoint` resolves to an existing `route.ts` file on disk. Fails when registry and reality diverge.
2. **Completeness:** every `MODE_REGISTRY` mode appears in `getCapabilities()` exactly once; no duplicate `id`s across modes+tools.
3. **Availability matrix:** parametrized over tier × key-presence × format — asserts each `reason` branch (upgrade_required, missing_segmind_key, missing_openai_key, not_applicable_for_format) and the available case.
4. **Envelope shape:** `supportEnvelope` groups by stage→role and annotates availability.
5. **Endpoint test:** `GET /api/capabilities` returns 401 unauthenticated; returns a well-formed envelope for a mocked session/tier/keys.

## Files

- Modify: `src/lib/modes/registry.ts` — add `role`/`stage` to `ModeConfig` + all 26 entries.
- Create: `src/lib/capabilities/registry.ts` — `Capability`, `TOOL_REGISTRY`, `getCapabilities`/byStage/byRole, `isCapabilityAvailable`, `supportEnvelope`.
- Create: `src/lib/capabilities/__tests__/registry.test.ts`.
- Create: `src/app/api/capabilities/route.ts` + its `__tests__/route.test.ts`.

## Success criteria

- `getCapabilities()` returns every mode + every catalogued tool, each with a valid stage/role/provider.
- Drift-guard test passes (registry matches real modes + routes).
- Availability logic correct across the tier/key/format matrix.
- `GET /api/capabilities` returns a grouped, availability-annotated envelope.
- `tsc --noEmit` clean; full suite green; zero behavior change to existing features.
