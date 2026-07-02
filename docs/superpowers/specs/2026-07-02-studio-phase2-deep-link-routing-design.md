# Studio Phase 2 — Per-Tool Deep-Link Routing (Sub-project A) — Design Spec

**Status:** Approved design, pre-implementation
**Date:** 2026-07-02
**Sub-project:** A of 3 in the Studio Phase 2 decomposition (B: Villain POV UI, C: Refine UI — separate future spec+plan cycles, not scoped here).

## Context

Studio Phase 1 (shipped, `docs/superpowers/plans/2026-06-30-ghostwriter-studio-phase1-shell-graph.md`) gave the Story Graph a working dataflow engine: selecting nodes and confirming a capability run dispatches back to the writing room via `studioDeepLink()` (`src/lib/graph/studio-deeplink.ts`). Today that function only has 4 outcomes: `selectMode` (opens the Actions drawer with a specific generation mode), `openComicStudio`, `openProductionStudio`, and a catch-all `openActions` (opens the generic Actions drawer with nothing pre-selected).

The Story Graph's `NODE_CAPABILITIES` map (`src/lib/graph/graph-program.ts`) wires exactly 10 capability ids to node kinds — not the full 26-capability registry. Of those 10, `comic_generate` and the 3 production tools (`production_video`, `scene_to_video_prompt`, `generate_package`) already route correctly via `openComicStudio`/`openProductionStudio`. The remaining 6 — `villain_pov`, `tension_curve`, `arc_heatmap`, `refine`, `prose_fix`, `editor_review` — all fall into the generic `openActions` catch-all today, which is the actual scope of "Phase 2."

Investigating those 6 revealed they don't share one shape:
- `tension_curve`, `arc_heatmap`, `editor_review` already have real, reachable UI (dual-mounted `TensionCurve`/`ArcHeatMap` components in both `StoryHealthPanel` and the lighter `StoryInsightsPanel`; `EditorNotesPanel` in the Polish stage) — these three just need the existing container opened with the right tab/stage pre-selected.
- `prose_fix` has real UI too (contextual "Fix This" buttons inside `StoryHealthPanel`'s `"validator"` tab and `EditorNotesPanel`) — the deep-link target is simply opening `StoryHealthPanel` on that tab, same shape as the other three.
- `refine` and `villain_pov` have **zero UI anywhere** — both are API-only routes with no button or panel calling them. Deep-linking to nonexistent UI isn't a routing problem; it requires designing and building that UI first, which is a materially larger, separate scope.

This spec covers **only** the 4 capabilities with existing UI: `tension_curve`, `arc_heatmap`, `prose_fix`, `editor_review`. `villain_pov` (sub-project B) and `refine` (sub-project C) get their own future spec+plan cycles once their UI is designed.

## Goals

1. Clicking `tension_curve` or `arc_heatmap` on a `thread` node in the Story Graph opens the writing room's `StoryInsightsPanel` (the lighter, focused container — not the 9-tab `StoryHealthPanel`) with the correct tab pre-selected.
2. Clicking `prose_fix` on a `chapter` node opens `StoryHealthPanel` on its `"validator"` tab, where the existing "Fix This" buttons live.
3. Clicking `editor_review` on a `chapter` node switches the writing room to the Polish stage, where `EditorNotesPanel` already renders (for story formats).
4. The same 3 outcomes work identically whether a capability is clicked **directly** inside the writing room (via `StageRoleRail`, no Studio round trip) or reached **via Studio's URL deep-link** (`GhostWriterApp`'s one-shot query-param dispatch) — both consumers of `capabilityAction()` must handle the new action types, not just one.
5. Zero change to any of the 6 already-working capability outcomes (`selectMode`, `openComicStudio`, `openProductionStudio`, and the `openActions` fallback for every capability not in scope here).

## Non-goals

- `villain_pov`/`refine` deep-linking (sub-projects B/C — need net-new UI first).
- Fixing the pre-existing `editor_review` visibility inconsistency: the capability registry marks `editor_review` as `visibility: "story_and_creator"`, but `EditorNotesPanel` inside `PolishStageView` is gated by `isStoryFormat(project.format)` — so deep-linking `editor_review` for a creator-format project switches to the Polish stage but shows nothing new there. This is documented as a known, accepted limitation. Fixing it is a separate scope decision (whether to build a creator-format editor-review UI, or narrow the registry's visibility to `story_only`) — out of scope for pure routing.
- Any change to `StoryHealthPanel`'s or `StoryInsightsPanel`'s own internal tab-switching UI/UX.
- Any change to the Story Graph's node-kind-to-capability mapping (`NODE_CAPABILITIES`) itself.

## Architecture

### A. `CapabilityActionResult` — `src/lib/capabilities/actions.ts` (extend)

Three new discriminated-union variants, replacing what would otherwise be the `openActions` fallback for these 4 specific capability ids:

```ts
export type CapabilityActionResult =
  | { type: "upgrade"; gate: FeatureGate }
  | { type: "hint"; reason: "missing_segmind_key" | "missing_openai_key" }
  | { type: "selectMode"; mode: string }
  | { type: "openComicStudio" }
  | { type: "openProductionStudio" }
  | { type: "openInsights"; tab: "arc" | "tension" }
  | { type: "openStoryHealth"; tab: "validator" }
  | { type: "openPolishStage" }
  | { type: "openActions" }
  | { type: "noop" };
```

`capabilityAction()` gains explicit branches for the 4 capability ids, inserted before the existing `PRODUCTION_TOOL_IDS`/fallback checks:

```ts
const INSIGHTS_TAB_MAP: Record<string, "arc" | "tension"> = {
  arc_heatmap: "arc",
  tension_curve: "tension",
};

export function capabilityAction(cap: Capability, availability: CapabilityAvailability): CapabilityActionResult {
  if (!availability.available) {
    if (availability.reason === "upgrade_required" && cap.gate) return { type: "upgrade", gate: cap.gate };
    if (availability.reason === "missing_segmind_key") return { type: "hint", reason: "missing_segmind_key" };
    if (availability.reason === "missing_openai_key") return { type: "hint", reason: "missing_openai_key" };
    return { type: "noop" };
  }
  if (cap.kind === "mode") return { type: "selectMode", mode: cap.id };
  if (cap.id === "comic_generate") return { type: "openComicStudio" };
  if (PRODUCTION_TOOL_IDS.has(cap.id)) return { type: "openProductionStudio" };
  if (cap.id in INSIGHTS_TAB_MAP) return { type: "openInsights", tab: INSIGHTS_TAB_MAP[cap.id] };
  if (cap.id === "prose_fix") return { type: "openStoryHealth", tab: "validator" };
  if (cap.id === "editor_review") return { type: "openPolishStage" };
  return { type: "openActions" };
}
```

Every other capability id (all 16 not covered by any branch above) is unaffected — `openActions` remains their outcome, exactly as today.

### B. Two consumers of the new action types

`capabilityAction()` has two call sites, and **both** must handle the 3 new variants — missing either one means that specific entry point (direct click vs. Studio deep-link) silently does nothing for these 4 capabilities.

**B1. `studio-deeplink.ts` (Studio → writing room, via URL)**

```ts
export function studioDeepLink(projectId: string, action: CapabilityActionResult): string | null {
  const base = `/project/${projectId}`;
  switch (action.type) {
    case "selectMode": return `${base}?studioMode=${encodeURIComponent(action.mode)}`;
    case "openComicStudio": return `${base}?studioOpen=comic`;
    case "openProductionStudio": return `${base}?studioOpen=production`;
    case "openInsights": return `${base}?studioOpen=insights&tab=${action.tab}`;
    case "openStoryHealth": return `${base}?studioOpen=story-health&tab=${action.tab}`;
    case "openPolishStage": return `${base}?studioOpen=polish`;
    case "openActions": return `${base}?studioOpen=actions`;
    case "upgrade":
    case "hint":
    case "noop":
      return null;
  }
}
```

**B2. `StageRoleRail.tsx` (direct click inside the writing room, no Studio round trip)**

`StageRoleRail` gains 2 new callback props (`onOpenInsights`, `onOpenPolishStage`) and reuses a widened `onOpenStoryHealth` for the third — 3 new `case` branches in the existing `switch (action.type)`:

```ts
case "openInsights": onOpenInsights(action.tab); break;
case "openStoryHealth": onOpenStoryHealth(action.tab); break;
case "openPolishStage": onOpenPolishStage(); break;
```

Its prop interface gains:
```ts
onOpenInsights: (tab: "arc" | "tension") => void;
onOpenStoryHealth: (tab: "validator") => void;
onOpenPolishStage: () => void;
```

### C. Two different state owners — two different plumbing paths

`insightsOpen` (and the insights tab) and `manualStage` are `WritingRoom`-local state. `showStoryHealth` is `GhostWriterApp`-level state, one component up. This means the 4 capabilities split into two plumbing shapes:

**C1. `tension_curve` / `arc_heatmap` / `editor_review` — state owned by `WritingRoom` itself**

- Direct click (`StageRoleRail` → `onOpenInsights`/`onOpenPolishStage`): `WritingRoom` passes down bound closures that call its own `setInsightsOpen(true)` (+ set a new local `insightsTab` state) or `setManualStage("polish")`. No prop threading beyond `WritingRoom`'s own render tree — self-contained.
- Studio deep-link: `GhostWriterApp` needs a way to tell `WritingRoom` "open insights on this tab" / "switch to this stage" from outside. Two new optional props on `WritingRoom`:
  ```ts
  deepLinkInsightsTab?: "arc" | "tension" | null;
  deepLinkStage?: GuideStage | null;
  ```
  A `useEffect` inside `WritingRoom`, keyed on these props, calls the same local setters (`setInsightsOpen(true)` + seed `insightsTab`; `setManualStage(deepLinkStage)`) exactly once when the prop transitions from `null`/`undefined` to a real value.

**C2. `prose_fix` — state owned by `GhostWriterApp`, one level up**

- Direct click: `StageRoleRail` → `onOpenStoryHealth("validator")` → bubbles up through a new `WritingRoom` prop `onOpenStoryHealth: (tab: "validator") => void` (threaded straight through to all 3 `StageRoleRail` mounts, unchanged otherwise) → up to `GhostWriterApp`, which already owns `showStoryHealth`.
- Studio deep-link: native to `GhostWriterApp` already (its own dispatch `useEffect` reads the URL directly) — no prop threading needed, just a new local state `storyHealthInitialTab` passed into the existing `<StoryHealthPanel key={storyHealthInitialTab} initialTab={storyHealthInitialTab} .../>` mount (see the `key` correctness note in Section D).

### D. Component prop additions

**`StoryInsightsPanel.tsx`** — add `initialTab?: Tab` prop:
```ts
interface Props {
  projectId: string;
  initialTab?: Tab;
}
export function StoryInsightsPanel({ projectId, initialTab }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "arc");
  // ...unchanged
}
```

**`StoryHealthPanel.tsx`** — add `initialTab?: typeof tab` prop (same union type as its existing `tab` state) to the existing `useState`:
```ts
const [tab, setTab] = useState<"validator" | "dead-scenes" | "theme" | "tension" | "transport" | "promises" | "heatmap" | "checkpoints" | "audit">(initialTab ?? "validator");
```

**`WritingRoom.tsx`** — add `deepLinkInsightsTab`, `deepLinkStage`, and `onOpenStoryHealth` to its props interface; a local `insightsTab` state (defaulting `"arc"`, seeded by either a direct click or the new deep-link `useEffect`); pass `initialTab={insightsTab}` into the `StoryInsightsPanel` mount; pass the 3 new callback props into all 3 `StageRoleRail` mounts.

Correctness detail: `StoryInsightsPanel` is conditionally rendered (`insightsOpen && (<StoryInsightsPanel .../>)`), so it freshly mounts (and re-seeds `initialTab`) every time `insightsOpen` transitions `false → true`. But if the panel is **already open** and a second capability click targets a different tab (`insightsOpen` stays `true`, no re-mount), `initialTab` — read only once by `useState` — would not update the already-mounted instance. Fix: give the `StoryInsightsPanel` mount `key={insightsTab}`, forcing React to remount (and re-seed) it whenever the target tab changes, even while the panel stays open. Cheap and correct here since `StoryInsightsPanel` holds no state worth preserving across a tab switch.

Same correctness detail applies to the `StoryHealthPanel` mount in `GhostWriterApp.tsx` for the **direct-click** path specifically: if the user already has `StoryHealthPanel` open (e.g. opened earlier via the slash command) and then clicks `prose_fix` in `StageRoleRail`, `showStoryHealth` stays `true` (no re-mount) while `storyHealthInitialTab` changes — so `<StoryHealthPanel key={storyHealthInitialTab} initialTab={storyHealthInitialTab} .../>` needs the same `key` treatment. (The Studio deep-link path doesn't need this — a full page navigation always mounts `GhostWriterApp` fresh, so `StoryHealthPanel` is always newly mounted there regardless.)

**`GhostWriterApp.tsx`** — 3 new branches in the existing `studioMode`/`studioOpen` dispatch `useEffect` (reading an additional `?tab=` param where relevant, via a small runtime type-guard so an unrecognized value falls through to each panel's own default rather than being passed through as an invalid string):

```ts
} else if (studioOpen === "insights") {
  const tab = params.get("tab");
  setDeepLinkInsightsTab(tab === "arc" || tab === "tension" ? tab : "arc");
} else if (studioOpen === "story-health") {
  setStoryHealthInitialTab("validator");
  setShowStoryHealth(true);
} else if (studioOpen === "polish") {
  setDeepLinkStage("polish");
}
```

Three new `useState` declarations (`deepLinkInsightsTab`, `deepLinkStage`, `storyHealthInitialTab`) alongside the existing `showComicStudio`/`showProductionStudio` state; `deepLinkInsightsTab`/`deepLinkStage` passed into `<WritingRoom .../>`; `storyHealthInitialTab` passed into the existing `<StoryHealthPanel key={storyHealthInitialTab} initialTab={storyHealthInitialTab} .../>` mount.

The existing `window.history.replaceState(null, "", window.location.pathname)` call at the end of this `useEffect` already strips **all** query params (it drops to `pathname` only) — the new `?tab=` param is scrubbed for free, no additional code needed.

## Data flow

```
Story Graph node selected → capability confirmed → studioDeepLink(projectId, action)
  action.type === "openInsights"     → /project/{id}?studioOpen=insights&tab=tension
  action.type === "openStoryHealth"  → /project/{id}?studioOpen=story-health&tab=validator
  action.type === "openPolishStage"  → /project/{id}?studioOpen=polish

Writing room loads → GhostWriterApp's dispatch useEffect reads studioOpen/tab
  → sets deepLinkInsightsTab / deepLinkStage / (storyHealthInitialTab + showStoryHealth)
  → passes into WritingRoom / StoryHealthPanel
  → WritingRoom's own useEffect seeds insightsOpen+insightsTab / manualStage
  → URL scrubbed to pathname-only (existing behavior, unchanged)

Direct click in writing room (no Studio round trip):
  StageRoleRail → capabilityAction(cap, availability) → action.type
    "openInsights"    → onOpenInsights(tab)    → WritingRoom's own setInsightsOpen+setInsightsTab
    "openStoryHealth" → onOpenStoryHealth(tab) → bubbles to GhostWriterApp's setShowStoryHealth+setStoryHealthInitialTab
    "openPolishStage" → onOpenPolishStage()    → WritingRoom's own setManualStage("polish")
```

## Error handling

- Missing or unrecognized `?tab=` value → the dispatch `useEffect`'s type-guard (`tab === "arc" || tab === "tension" ? tab : "arc"`) only ever passes a valid value or the panel's own default; an invalid string never reaches `StoryInsightsPanel`/`StoryHealthPanel`.
- `?studioOpen=polish` when the writing room has no chapters yet, or nothing drafted → reuses the writing room's existing tolerant stage-switching (the Idea/Structure/Draft/Polish/Export pills are already clickable at any time regardless of content state) — no new edge case.
- If `studioMode` and one of the new `studioOpen` values are both present in the URL simultaneously → the existing `if`/`else if` chain in `GhostWriterApp`'s dispatch means `studioMode` wins, matching today's precedence between `studioMode` and `studioOpen=comic/production/actions`.
- `editor_review` deep-linked for a creator-format project → Polish stage opens, `EditorNotesPanel` doesn't render there (pre-existing `isStoryFormat` gate) — documented known limitation (see Non-goals), not a crash or error state.

## Testing

1. **`capabilityAction()`** (extend `src/lib/capabilities/__tests__/actions.test.ts`): `tension_curve` → `{ type: "openInsights", tab: "tension" }`; `arc_heatmap` → `{ type: "openInsights", tab: "arc" }`; `prose_fix` → `{ type: "openStoryHealth", tab: "validator" }`; `editor_review` → `{ type: "openPolishStage" }`; every other existing test in the file remains unmodified (regression check that the fallback `openActions` still applies to unrelated capability ids).
2. **`studioDeepLink()`** (extend `src/lib/graph/__tests__/studio-deeplink.test.ts`): each of the 3 new action types produces the correct query string; existing tests for `selectMode`/`openComicStudio`/`openProductionStudio`/`openActions`/`upgrade`/`hint`/`noop` remain unmodified.
3. **E2E** (extend `e2e/studio-phase1.spec.ts`, reusing the same authenticated session/project already established in that test, same pattern as the earlier `?studioOpen=comic`/`?studioOpen=production` additions): `?studioOpen=insights&tab=tension` → `StoryInsightsPanel`'s "Tension Curve" tab button shows as active/selected; `?studioOpen=story-health&tab=validator` → `StoryHealthPanel` opens with its validator content visible; `?studioOpen=polish` → the writing room's stage indicator shows "Polish" and `EditorNotesPanel` is visible (test project uses `format: "Novel"`, a story format, so the `isStoryFormat` gate passes).
4. `tsc --noEmit` clean — the primary guard for the new prop plumbing across `WritingRoom`/`StageRoleRail`/`GhostWriterApp`, none of which get isolated unit tests (matches this codebase's established convention for these specific files).
5. Full suite green; zero change to any of the 6 already-working `CapabilityActionResult` outcomes.

## Success criteria

- All 4 in-scope capabilities (`tension_curve`, `arc_heatmap`, `prose_fix`, `editor_review`), when run from the Story Graph on an applicable node, land the user directly on the right tab/panel/stage instead of the generic Actions drawer.
- The same 4 capabilities, when clicked directly inside the writing room's `StageRoleRail` (no Studio involved), produce the identical outcome — one `capabilityAction()` mapping, two consumers, no divergence.
- Zero regression to `selectMode`/`openComicStudio`/`openProductionStudio`/`openActions` or any capability not in this spec's scope.
- `tsc` clean, full suite green.
