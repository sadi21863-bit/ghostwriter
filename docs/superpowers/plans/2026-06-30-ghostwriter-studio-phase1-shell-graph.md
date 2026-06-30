# Ghostwriter Studio Phase 1: Shell + Graph Pane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first real, usable slice of Ghostwriter Studio — a dedicated `/project/[projectId]/studio` surface with a four-pane shell (Graph / Pipelines / Analytics / Exports), a working Graph pane that embeds the existing `ConstellationView` with a live graph-health overlay, and — critically — a fix for the discovered dead-end where `ConstellationView`'s "Run on N selected" panel currently calls an `onRunCapability` callback that no consumer ever supplies, so confirmed capability runs silently do nothing today.

**Architecture:** Studio is a new, separate Next.js route (`/project/[projectId]/studio`), not a panel inside the existing `GhostWriterApp`/`WritingRoom` shell — this avoids resurrecting the project's "ONE render path" dual-shell debt (guarded by `src/components/__tests__/live-shell-reachability.test.ts`) by keeping Studio's own state out of `GhostWriterApp` entirely. Because `capabilityAction()` (`src/lib/capabilities/actions.ts`) returns a *UI-routing* decision (`selectMode` / `openComicStudio` / `openProductionStudio` / `openActions`) that only makes sense inside `GhostWriterApp`'s own state machine, Studio dispatches a confirmed run by **navigating back** to `/project/[projectId]` with a one-shot query param (`?studioMode=...` or `?studioOpen=...`) that `GhostWriterApp` reads once on mount and feeds into its *existing* `setMode`/`setActionsOpen`/`setShowComicStudio`/`setShowProductionStudio` calls — the same calls `handleSelectMode` and the Comic/Production Studio buttons already use. This keeps the project's "one execution path" invariant intact: Studio is a third *entry surface* (alongside the funnel rails and the slash menu), never a second execution mechanism.

**Tech Stack:** Next.js App Router (server component route → client `StudioShell`), React, `@xyflow/react` (already used by `ConstellationView`), Vitest for pure-function unit tests.

## Global Constraints

- Studio must reuse the existing capability execution path (`capabilityAction` → `selectMode`/`openComicStudio`/`openProductionStudio`/`openActions`) — never invent a parallel direct-fetch execution mechanism.
- Do not modify `src/components/__tests__/live-shell-reachability.test.ts`'s existing `MUST_BE_REACHABLE` regex-based assertions — `StudioShell` is reached via a literal `<Link href>`, not an `import`, so it does not belong in that list. A separate, dedicated reachability test covers the Studio entry point instead (Task 7).
- Follow the codebase's established pattern of keeping selection/dispatch logic in pure, DOM-free helper modules (`src/lib/graph/*.ts`) that are unit-tested directly, while the React components that consume them are verified via `tsc --noEmit` + manual browser check rather than component-level unit tests — this matches the existing `graph-canvas.ts` / `ConstellationView.tsx` split.
- Style tokens: use `co`/`sBtnSm`/`sBtn` from `src/lib/styles.ts` for any new light-theme UI (`StudioShell`, `WritingRoom` additions). `ConstellationView`'s own dark-theme inline hex palette is pre-existing and must stay internally consistent with itself — do not introduce `co`/`panel` tokens into `ConstellationView.tsx`.
- Run `npm test` (vitest) after every task that touches a `.ts`/`.tsx` file, and `npx tsc --noEmit` before the final commit of each task.

---

### Task 1: `nodeHealthAccent` pure helper

**Files:**
- Modify: `src/lib/graph/graph-canvas.ts` (append after the existing `blockedReasonText` function, line 50)
- Test: `src/lib/graph/__tests__/graph-canvas.test.ts` (append new `describe` block)

**Interfaces:**
- Consumes: `GraphHealthIssue` type from `src/lib/graph/graph-health.ts` (`{ kind, severity: "warning" | "info", nodeId, nodeName, message }`)
- Produces: `nodeHealthAccent(issues: GraphHealthIssue[]): string | null` — used by Task 2 to color-accent graph nodes that have health issues.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/graph/__tests__/graph-canvas.test.ts`:

```ts
import { nodeHealthAccent } from "../graph-canvas";
import type { GraphHealthIssue } from "../graph-health";

function issue(over: Partial<GraphHealthIssue>): GraphHealthIssue {
  return {
    kind: "isolated_entity", severity: "info", nodeId: "n1", nodeName: "Thing",
    message: "msg", ...over,
  };
}

describe("nodeHealthAccent", () => {
  it("returns null when there are no issues", () => {
    expect(nodeHealthAccent([])).toBeNull();
  });
  it("returns the warning color when any issue is a warning", () => {
    expect(nodeHealthAccent([issue({ severity: "info" }), issue({ severity: "warning" })])).toBe("#f87171");
  });
  it("returns the info color when all issues are info", () => {
    expect(nodeHealthAccent([issue({ severity: "info" })])).toBe("#f59e0b");
  });
});
```

(The import lines go at the top of the file alongside the existing imports; the `issue` helper and `describe` block go at the end.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/graph/__tests__/graph-canvas.test.ts`
Expected: FAIL with `nodeHealthAccent is not a function` (or similar — the export doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

Add to `src/lib/graph/graph-canvas.ts`, after the existing `import type { GraphNodeKind, GraphRunPlan } from "./graph-program";` line:

```ts
import type { GraphHealthIssue } from "./graph-health";
```

Append at the end of the file (after `blockedReasonText`):

```ts

/** Border accent color for a node's health issues; null when it has none.
 * Warning issues (isolated character, unrooted thread) outrank info issues for color. */
export function nodeHealthAccent(issues: GraphHealthIssue[]): string | null {
  if (issues.length === 0) return null;
  return issues.some(i => i.severity === "warning") ? "#f87171" : "#f59e0b";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/graph/__tests__/graph-canvas.test.ts`
Expected: PASS (all tests in the file, old and new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/graph/graph-canvas.ts src/lib/graph/__tests__/graph-canvas.test.ts
git commit -m "feat: add nodeHealthAccent helper for Story Graph health overlay"
```

---

### Task 2: Wire health overlay + flexible height into `ConstellationView`

**Files:**
- Modify: `src/components/ConstellationView.tsx`

**Interfaces:**
- Consumes: `nodeHealthAccent` (Task 1) from `@/lib/graph/graph-canvas`; `GraphHealthReport`/`GraphHealthIssue` types from `@/lib/graph/graph-health`; the `health` field already present on the `GET /api/projects/[projectId]/story-graph` response (`{ ...graph, health: analyzeGraphHealth(graph) }`, confirmed in `src/app/api/projects/[projectId]/story-graph/route.ts:46`).
- Produces: `ConstellationView` now accepts an optional `height?: number | string` prop (default `500`, preserving today's behavior for its existing caller `StoryInsightsPanel.tsx`) and renders a health score chip + per-node accent borders. No prop signature changes to `projectId`/`onSelectPair`/`onRunCapability`.

This task has no new unit test of its own — per the codebase's established split (selection/cost/confirm logic lives in tested pure helpers; `ConstellationView` itself renders what they return and is verified via `tsc` + manual browser check), this task is verified by typecheck and the Task 8 end-to-end smoke check.

- [ ] **Step 1: Add the `height` prop and the health-overlay imports**

In `src/components/ConstellationView.tsx`, replace the imports block (lines 9-10):

```ts
import { selectionKinds, confirmMessageFor, isOptionActionable, blockedReasonText, nodeHealthAccent } from "@/lib/graph/graph-canvas";
import type { GraphRunPlan } from "@/lib/graph/graph-program";
import type { GraphHealthIssue, GraphHealthReport } from "@/lib/graph/graph-health";
```

Replace the `Props` type (lines 12-17):

```ts
type Props = {
  projectId: string;
  onSelectPair?: (aId: string, bId: string) => void;
  /** Host wires actual execution of a confirmed, available capability run. */
  onRunCapability?: (plan: GraphRunPlan) => void;
  /** Container height. Defaults to 500 (the original fixed-height embed used by
   * StoryInsightsPanel); Studio passes a larger value to fill its Graph pane. */
  height?: number | string;
};
```

Replace the function signature (line 39):

```ts
export function ConstellationView({ projectId, onSelectPair, onRunCapability, height = 500 }: Props) {
```

- [ ] **Step 2: Track health state and build the per-node issue map**

Add a new state declaration after the existing `loadingOpts` state (line 44):

```ts
  const [health, setHealth] = useState<GraphHealthReport | null>(null);
```

In the `fetch(...).then(data => { ... })` block (lines 49-115), immediately after `const all = data.nodes || [];` (line 50), add:

```ts
        const issuesByNode = new Map<string, GraphHealthIssue[]>();
        for (const issue of (data.health?.issues ?? []) as GraphHealthIssue[]) {
          const arr = issuesByNode.get(issue.nodeId) ?? [];
          arr.push(issue);
          issuesByNode.set(issue.nodeId, arr);
        }
```

Inside the `rfNodes` mapping (lines 75-87), add the accent lookup and apply it to the node style:

```ts
        const rfNodes: Node[] = all.map((n: any) => {
          const st = NODE_TYPE_STYLE[n.type] ?? NODE_TYPE_STYLE.character;
          const accent = nodeHealthAccent(issuesByNode.get(n.id) ?? []);
          return {
            id: n.id,
            data: { label: labelFor(n), nodeType: n.type },
            position: pos[n.id] ?? { x: 350, y: 300 },
            style: {
              background: st.bg,
              border: accent ? `2px solid ${accent}` : `1px solid ${st.border}`,
              borderRadius: st.shape,
              padding: "8px 12px", fontSize: 12, color: "#F2F2F3",
              minWidth: 70, textAlign: "center" as const,
            },
          };
        });
```

Right before `setNodes(rfNodes);` (line 113), add:

```ts
        setHealth((data.health as GraphHealthReport) ?? null);
```

- [ ] **Step 3: Use the `height` prop and render the health chip**

Replace the wrapper `<div>` opening tag (line 149):

```tsx
    <div style={{ position: "relative", width: "100%", height, borderRadius: 12, overflow: "hidden", border: "1px solid var(--color-border-subtle, rgba(255,255,255,0.05))" }}>
```

Add the health chip immediately after the existing legend `<div>` (after line 172, before the `{/* Run-on-selection panel ... */}` comment):

```tsx
      {health && (
        <div style={{
          position: "absolute", bottom: 8, left: 8, fontSize: 11,
          background: "rgba(17,17,19,0.8)", padding: "4px 8px", borderRadius: 6,
          color: health.score < 70 ? "#f87171" : health.score < 90 ? "#f59e0b" : "#9898A6",
          zIndex: 5,
        }}>
          Health: {health.score}/100{health.counts.warning > 0 ? ` · ${health.counts.warning} warning${health.counts.warning === 1 ? "" : "s"}` : ""}
        </div>
      )}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors from `src/components/ConstellationView.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/components/ConstellationView.tsx
git commit -m "feat: add live graph-health overlay and flexible height to ConstellationView"
```

---

### Task 3: `studioDeepLink` pure helper

**Files:**
- Create: `src/lib/graph/studio-deeplink.ts`
- Test: `src/lib/graph/__tests__/studio-deeplink.test.ts`

**Interfaces:**
- Consumes: `CapabilityActionResult` type from `src/lib/capabilities/actions.ts` (`{type:"upgrade",gate}` | `{type:"hint",reason}` | `{type:"selectMode",mode}` | `{type:"openComicStudio"}` | `{type:"openProductionStudio"}` | `{type:"openActions"}` | `{type:"noop"}`).
- Produces: `studioDeepLink(projectId: string, action: CapabilityActionResult): string | null` — used by Task 4's `StudioShell` to turn a confirmed `GraphRunPlan.action` into a navigation URL.

- [ ] **Step 1: Write the failing test**

Create `src/lib/graph/__tests__/studio-deeplink.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { studioDeepLink } from "../studio-deeplink";
import type { CapabilityActionResult } from "@/lib/capabilities/actions";

describe("studioDeepLink", () => {
  it("builds a studioMode query param for selectMode actions", () => {
    expect(studioDeepLink("proj1", { type: "selectMode", mode: "villain_pov" }))
      .toBe("/project/proj1?studioMode=villain_pov");
  });
  it("builds a studioOpen=comic param for openComicStudio", () => {
    expect(studioDeepLink("proj1", { type: "openComicStudio" })).toBe("/project/proj1?studioOpen=comic");
  });
  it("builds a studioOpen=production param for openProductionStudio", () => {
    expect(studioDeepLink("proj1", { type: "openProductionStudio" })).toBe("/project/proj1?studioOpen=production");
  });
  it("builds a studioOpen=actions param for openActions", () => {
    expect(studioDeepLink("proj1", { type: "openActions" })).toBe("/project/proj1?studioOpen=actions");
  });
  it("returns null for upgrade/hint/noop — Studio shows these inline, no navigation", () => {
    const upgrade: CapabilityActionResult = { type: "upgrade", gate: "story_modes_advanced" } as CapabilityActionResult;
    expect(studioDeepLink("proj1", upgrade)).toBeNull();
    expect(studioDeepLink("proj1", { type: "hint", reason: "missing_segmind_key" })).toBeNull();
    expect(studioDeepLink("proj1", { type: "noop" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/graph/__tests__/studio-deeplink.test.ts`
Expected: FAIL — `Cannot find module '../studio-deeplink'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/graph/studio-deeplink.ts`:

```ts
import type { CapabilityActionResult } from "@/lib/capabilities/actions";

/**
 * Studio is a separate route from the writing room, so it can't call
 * GhostWriterApp's setMode/setActionsOpen/setShowComicStudio/setShowProductionStudio
 * directly. Instead it navigates back to the project editor with a one-shot query
 * param that GhostWriterApp reads on mount and dispatches through its own state —
 * the existing one execution path, never a parallel one.
 */
export function studioDeepLink(projectId: string, action: CapabilityActionResult): string | null {
  const base = `/project/${projectId}`;
  switch (action.type) {
    case "selectMode": return `${base}?studioMode=${encodeURIComponent(action.mode)}`;
    case "openComicStudio": return `${base}?studioOpen=comic`;
    case "openProductionStudio": return `${base}?studioOpen=production`;
    case "openActions": return `${base}?studioOpen=actions`;
    case "upgrade":
    case "hint":
    case "noop":
      return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/graph/__tests__/studio-deeplink.test.ts`
Expected: PASS (5/5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/graph/studio-deeplink.ts src/lib/graph/__tests__/studio-deeplink.test.ts
git commit -m "feat: add studioDeepLink helper for Studio-to-editor capability dispatch"
```

---

### Task 4: `StudioShell` four-pane component

**Files:**
- Create: `src/components/StudioShell.tsx`

**Interfaces:**
- Consumes: `ConstellationView` (dynamically imported, `{ projectId, height, onRunCapability }` props from Task 2) from `@/components/ConstellationView`; `studioDeepLink` (Task 3) from `@/lib/graph/studio-deeplink`; `GraphRunPlan` type from `@/lib/graph/graph-program`; `co`/`sBtnSm` from `@/lib/styles`; `useRouter` from `next/navigation`.
- Produces: `export default function StudioShell({ projectId }: { projectId: string })` — consumed by Task 5's route.

This task has no new unit test — it is a thin layout/dispatch component verified by typecheck and the Task 8 manual smoke check, matching `ConstellationView`'s own verification convention.

- [ ] **Step 1: Create the component**

Create `src/components/StudioShell.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { co, sBtnSm } from "@/lib/styles";
import { studioDeepLink } from "@/lib/graph/studio-deeplink";
import type { GraphRunPlan } from "@/lib/graph/graph-program";

const ConstellationView = dynamic(
  () => import("@/components/ConstellationView").then(m => ({ default: m.ConstellationView })),
  { ssr: false }
);

type Pane = "graph" | "pipelines" | "analytics" | "exports";

const PANES: { id: Pane; label: string }[] = [
  { id: "graph", label: "Graph" },
  { id: "pipelines", label: "Pipelines" },
  { id: "analytics", label: "Analytics" },
  { id: "exports", label: "Exports" },
];

export default function StudioShell({ projectId }: { projectId: string }) {
  const [pane, setPane] = useState<Pane>("graph");
  const router = useRouter();

  const onRunCapability = (plan: GraphRunPlan) => {
    const url = studioDeepLink(projectId, plan.action);
    if (url) router.push(url);
  };

  return (
    <div style={{ minHeight: "100vh", background: co.bg, padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: co.text }}>Studio</div>
          <a href={`/project/${projectId}`} style={{ fontSize: 12, color: co.muted, textDecoration: "none" }}>
            ← Back to writing room
          </a>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16, borderBottom: `1px solid ${co.border}`, paddingBottom: 10 }}>
          {PANES.map(p => (
            <button
              key={p.id}
              onClick={() => setPane(p.id)}
              style={{
                ...sBtnSm,
                background: pane === p.id ? co.accentBg : "transparent",
                color: pane === p.id ? co.accent : co.muted,
                border: pane === p.id ? `1px solid ${co.accent}` : `1px solid ${co.border}`,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {pane === "graph" && (
          <ConstellationView projectId={projectId} height={640} onRunCapability={onRunCapability} />
        )}
        {pane === "pipelines" && (
          <div style={{ padding: 40, textAlign: "center", color: co.muted, fontSize: 13 }}>
            Pipelines — coming soon. Select nodes on the Graph pane to run capabilities today.
          </div>
        )}
        {pane === "analytics" && (
          <div style={{ padding: 40, textAlign: "center", color: co.muted, fontSize: 13 }}>
            Analytics — coming soon.
          </div>
        )}
        {pane === "exports" && (
          <div style={{ padding: 40, textAlign: "center", color: co.muted, fontSize: 13 }}>
            Exports — coming soon. Use the Export stage in the writing room for now.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors from `src/components/StudioShell.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/StudioShell.tsx
git commit -m "feat: add StudioShell four-pane component with working Graph pane"
```

---

### Task 5: Studio route

**Files:**
- Create: `src/app/project/[projectId]/studio/page.tsx`

**Interfaces:**
- Consumes: `StudioShell` (Task 4) from `@/components/StudioShell`; `ErrorBoundary` from `@/components/ErrorBoundary` (existing, named export, already used by the sibling `src/app/project/[projectId]/page.tsx`).
- Produces: the `/project/[projectId]/studio` route.

- [ ] **Step 1: Create the route, mirroring the existing `/project/[projectId]/page.tsx` pattern exactly**

Create `src/app/project/[projectId]/studio/page.tsx`:

```tsx
import StudioShell from "@/components/StudioShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default async function Studio({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <ErrorBoundary>
      <StudioShell projectId={projectId} />
    </ErrorBoundary>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/project/[projectId]/studio/page.tsx"
git commit -m "feat: add /project/[projectId]/studio route"
```

---

### Task 6: `GhostWriterApp` deep-link dispatch

**Files:**
- Modify: `src/components/GhostWriterApp.tsx`

**Interfaces:**
- Consumes: nothing new — reads `window.location.search` directly (no new import) and dispatches into the component's own pre-existing `setMode`, `setActionsOpen`, `setShowComicStudio`, `setShowProductionStudio` state setters (declared at lines 31-38).
- Produces: `GhostWriterApp` now honors `?studioMode=<mode>` and `?studioOpen=comic|production|actions` query params on mount — the landing side of Task 3/4's `studioDeepLink` navigation.

No new unit test — `GhostWriterApp.tsx` has no existing behavioral test harness (only the static `live-shell-reachability.test.ts` guard, which this change doesn't affect). Verified by typecheck + the Task 8 manual smoke check.

- [ ] **Step 1: Add the deep-link effect**

In `src/components/GhostWriterApp.tsx`, immediately after the `handleSelectMode` function (lines 143-146):

```ts
  const handleSelectMode = (selected: GenerationMode) => {
    setMode(selected);
    if (selected !== "write") setActionsOpen(true);
  };
```

add:

```ts

  // Studio (/project/[id]/studio) is a separate route and navigates back here with a
  // one-shot query param to dispatch a confirmed capability run through this
  // component's own state — the project's one execution path, never a parallel one.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const studioMode = params.get("studioMode");
    const studioOpen = params.get("studioOpen");
    if (studioMode) {
      setMode(studioMode);
      setActionsOpen(true);
    } else if (studioOpen === "comic") {
      setShowComicStudio(true);
      setActionsOpen(true);
    } else if (studioOpen === "production") {
      setShowProductionStudio(true);
      setActionsOpen(true);
    } else if (studioOpen === "actions") {
      setActionsOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors. (`useEffect` is already imported at line 2; `setMode`/`setActionsOpen`/`setShowComicStudio`/`setShowProductionStudio` are already declared at lines 31-38.)

- [ ] **Step 3: Commit**

```bash
git add src/components/GhostWriterApp.tsx
git commit -m "feat: dispatch Studio deep-link query params into GhostWriterApp state"
```

---

### Task 7: Studio entry point in `WritingRoom` + reachability test

**Files:**
- Modify: `src/components/WritingRoom.tsx`
- Test: `src/components/__tests__/studio-entrypoint.test.ts` (new)

**Interfaces:**
- Consumes: `next/link`'s `Link` component (new import); `project.id` (already used elsewhere in this file, e.g. line 282, 489).
- Produces: a "Studio →" link visible in the writing room's footer action row (next to the existing "Actions" button), giving real users a way to reach `/project/[projectId]/studio`.

- [ ] **Step 1: Write the failing reachability test**

Create `src/components/__tests__/studio-entrypoint.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Studio entry point", () => {
  it("WritingRoom links to /project/[id]/studio so Studio isn't an orphaned route", () => {
    const source = readFileSync(join(__dirname, "..", "WritingRoom.tsx"), "utf-8");
    expect(source).toMatch(/\/project\/\$\{project\.id\}\/studio/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/studio-entrypoint.test.ts`
Expected: FAIL — the string isn't in `WritingRoom.tsx` yet.

- [ ] **Step 3: Add the `Link` import and the Studio entry point**

In `src/components/WritingRoom.tsx`, add to the imports (after line 3, `import dynamic from "next/dynamic";`):

```ts
import Link from "next/link";
```

Replace the footer action row (lines 524-529):

```tsx
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button style={sBtnSm} onClick={onOpenActions}>Actions</button>
          <button style={{ ...sBtn, opacity: generating ? 0.6 : 1 }} disabled={generating} onClick={runGenerate}>
            {generating ? `${MODE_REGISTRY.write.label}…` : MODE_REGISTRY.write.label}
          </button>
        </div>
```

with:

```tsx
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={sBtnSm} onClick={onOpenActions}>Actions</button>
            <Link
              href={`/project/${project.id}/studio`}
              style={{ ...sBtnSm, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
            >
              Studio →
            </Link>
          </div>
          <button style={{ ...sBtn, opacity: generating ? 0.6 : 1 }} disabled={generating} onClick={runGenerate}>
            {generating ? `${MODE_REGISTRY.write.label}…` : MODE_REGISTRY.write.label}
          </button>
        </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/studio-entrypoint.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npm test`
Expected: All tests pass (no regressions in `live-shell-reachability.test.ts` or elsewhere).

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/WritingRoom.tsx src/components/__tests__/studio-entrypoint.test.ts
git commit -m "feat: add Studio entry point link to the writing room footer"
```

---

### Task 8: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify the Studio entry point and Graph pane**

In a browser, open an existing project at `/project/<id>`, confirm the "Studio →" link appears next to "Actions" in the footer, click it, and confirm `/project/<id>/studio` loads showing the four pane tabs (Graph active by default) and the Story Graph canvas at the larger 640px height with a "Health: NN/100" chip in the bottom-left corner. If the project has an isolated character or unrooted thread, confirm that node renders with a red (`#f87171`) accent border; if it only has info-level issues (unvisited location, unused world entity), confirm an amber (`#f59e0b`) border.

- [ ] **Step 3: Verify the capability-run dead-end is fixed**

Select a thread node (or a node combination that yields a runnable capability per `NODE_CAPABILITIES` in `src/lib/graph/graph-program.ts`, e.g. a thread → "Tension Curve"/"Arc Heatmap"/"Villain POV"). Click a free (non-paid) option in the "Run on N selected" panel and confirm the browser navigates to `/project/<id>?studioOpen=actions` (for most tools) and the writing room's Actions drawer opens. For a `selectMode`-routed option, confirm the URL is `/project/<id>?studioMode=<mode>` and the corresponding mode is active in the Actions drawer.

- [ ] **Step 4: Verify the existing `StoryInsightsPanel` embed is unaffected**

In the writing room's "Relationships" tab (`StoryInsightsPanel`), confirm `ConstellationView` still renders at its original 500px height with the health chip and accent borders also present (since Task 2's changes apply unconditionally), and that node selection / run-option panel still behave as before.

- [ ] **Step 5: Report results**

If any step fails, return to the relevant task and fix before proceeding to `finishing-a-development-branch`.

---

## Deferred to later phases (not in this plan)

- **Pipelines pane** as a dedicated node-link canvas for wiring capability blocks (beyond the existing "Run on N selected" panel already shipped in `ConstellationView`) — the *functional* gap (confirmed runs doing nothing) is fixed by this plan; a richer visual pipeline-building UI is a separate, larger Phase 2 effort per the original design doc (`docs/superpowers/specs/2026-06-30-ghostwriter-studio-design.md`).
- **Analytics pane** (graph-health score history, tension-curve/arc-heatmap/character-presence cards) — Phase 3 in the design doc.
- **Exports pane** (Mermaid/Graphviz subgraph export) — Phase 4 in the design doc.
- **Cytoscape.js swap for scale** — Phase 5, explicitly deferred/lazy in the design doc.
