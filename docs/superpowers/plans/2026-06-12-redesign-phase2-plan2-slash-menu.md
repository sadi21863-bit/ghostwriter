# Redesign Phase 2 Plan 2 of 2: Slash Menu Implementation Plan

**Status: COMPLETE**

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a `/`-triggered command menu to the Writing Room's prompt input, generated from `MODE_REGISTRY`'s `slash`/`label`/`keywords` fields (added in Phase 0), so a user can type `/fight` to jump straight into Combat mode without leaving the writing surface.

**Architecture:** Two new pure functions (`getVisibleModes`, `filterModesByQuery`) in a new `src/lib/modes/slash-menu.ts` module, unit-tested per the existing `registry.test.ts` conventions. A new presentational `SlashMenu` component renders the filtered list above the Writing Room's prompt input. `WritingRoom` gains `prompt`/`setPrompt`/`onSelectMode` props (no new state duplication — reuses `GhostWriterApp`'s existing `prompt`/`mode` state). Selecting one of the 3 "universal" modes (brainstorm/outline/write) or any of the 23 library modes both flow through the existing Actions overlay (from Plan 1) for anything other than the default "write" — so none of the 22 dedicated `generate<Mode>` flows in `useAIActions.ts` need to be touched or re-implemented.

**Tech Stack:** Next.js 16, React, TypeScript, Vitest.

---

## Background

`MODE_REGISTRY` (`src/lib/modes/registry.ts`) is the single source of truth for all 26 `GenerationMode`s, each with a `slash` command (e.g. `/fight`, `/brainstorm`) and `keywords` array (added in Phase 0 specifically for this slash menu).

`ToolbarPanel.tsx` already computes a `visibleModes` array via a ternary on `project.format` (Podcast Episode → `PODCAST_MODES`, story formats → `MODES`, else → `MODES` minus `story_only`). This logic is extracted into a shared `getVisibleModes(format)` so the slash menu and the toolbar mode-tabs stay in sync (DRY).

Of the 26 registry modes, only `brainstorm`, `outline`, and `write` have `visibility: "universal"` and no required archetype/style parameter — they're driven by the generic `aiActions.generate()`. The other 23 ("library") modes each have a dedicated `generate<Mode>(archetype, prompt)` function in `useAIActions.ts` with their own context builders and `streamText`-only output, surfaced through `ToolbarPanel`'s per-mode panels.

Re-implementing all 23 dedicated flows inside the new minimal `WritingRoom` shell would be a large, regression-risky undertaking. Instead, this plan treats the slash menu as a **fast router**: selecting "Write" stays inline (the Writing Room's existing primary button), and selecting anything else opens the Plan 1 Actions overlay already wired to `ToolbarPanel` — pre-selecting that mode's tab/panel so the user lands directly in it.

---

## Task 1: `getVisibleModes` + `filterModesByQuery` pure functions

**Files:**
- Create: `src/lib/modes/slash-menu.ts`
- Test: `src/lib/modes/__tests__/slash-menu.test.ts`

- [x] **Step 1: Write the failing tests**

```typescript
// src/lib/modes/__tests__/slash-menu.test.ts
import { describe, it, expect } from "vitest";
import { getVisibleModes, filterModesByQuery } from "../slash-menu";
import { MODE_REGISTRY } from "../registry";
import { MODES } from "@/lib/formats";

describe("getVisibleModes", () => {
  it("returns all 26 modes for story formats", () => {
    expect(getVisibleModes("Novel")).toEqual(MODES);
    expect(getVisibleModes("Screenplay")).toEqual(MODES);
    expect(getVisibleModes("Web Series")).toEqual(MODES);
  });

  it("returns brainstorm/outline/write for Podcast Episode", () => {
    expect(getVisibleModes("Podcast Episode")).toEqual(["brainstorm", "outline", "write"]);
  });

  it("excludes story_only modes for non-podcast creator formats", () => {
    const visible = getVisibleModes("YouTube Long-form");
    for (const m of visible) {
      expect(MODE_REGISTRY[m].visibility).not.toBe("story_only");
    }
    expect(visible).toContain("emotional");
    expect(visible).not.toContain("combat");
    expect(visible).not.toContain("isekai");
  });
});

describe("filterModesByQuery", () => {
  const all = MODES;

  it("returns all given modes unchanged for an empty query", () => {
    expect(filterModesByQuery("", all)).toEqual(all);
    expect(filterModesByQuery("   ", all)).toEqual(all);
  });

  it("matches by slash command", () => {
    expect(filterModesByQuery("fight", all)).toContain("combat");
  });

  it("matches by label", () => {
    expect(filterModesByQuery("horror", all)).toContain("horror");
  });

  it("matches by keyword", () => {
    expect(filterModesByQuery("kiss", all)).toContain("romance");
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterModesByQuery("zzzznotamode", all)).toEqual([]);
  });

  it("only searches within the given modes subset", () => {
    const subset: ("brainstorm" | "outline" | "write")[] = ["brainstorm", "outline", "write"];
    expect(filterModesByQuery("fight", subset)).toEqual([]);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run (from the `ghostwriter` directory):
```
npx vitest run src/lib/modes/__tests__/slash-menu.test.ts
```
Expected: FAIL — `Cannot find module '../slash-menu'`.

- [x] **Step 3: Implement the pure functions**

```typescript
// src/lib/modes/slash-menu.ts
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";
import { MODES, isStoryFormat } from "@/lib/formats";

/** Modes selectable via the writing room's slash menu for a given project format. */
export function getVisibleModes(format: string): GenerationMode[] {
  if (format === "Podcast Episode") return ["brainstorm", "outline", "write"];
  if (isStoryFormat(format)) return MODES;
  return MODES.filter(m => MODE_REGISTRY[m].visibility !== "story_only");
}

/**
 * Filters modes by a slash-menu query, matching each mode's slash command, label,
 * and keywords. An empty (or whitespace-only) query returns the given modes unchanged.
 */
export function filterModesByQuery(query: string, modes: GenerationMode[]): GenerationMode[] {
  const q = query.trim().toLowerCase();
  if (!q) return modes;
  return modes.filter(m => {
    const config = MODE_REGISTRY[m];
    if (config.slash.slice(1).toLowerCase().startsWith(q)) return true;
    if (config.label.toLowerCase().includes(q)) return true;
    return config.keywords.some(k => k.toLowerCase().includes(q));
  });
}
```

- [x] **Step 4: Run tests to verify they pass**

Run:
```
npx vitest run src/lib/modes/__tests__/slash-menu.test.ts
```
Expected: PASS — 9/9 tests.

---

## Task 2: `SlashMenu` presentational component

**Files:**
- Create: `src/components/SlashMenu.tsx`

- [x] **Step 1: Implement the component**

No unit test (no React component test infra exists in this repo — verified via `tsc --noEmit` + `npm run build` in the Final Verification section).

```tsx
// src/components/SlashMenu.tsx
"use client";
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";
import { co } from "@/lib/styles";

interface SlashMenuProps {
  modes: GenerationMode[];
  onSelect: (mode: GenerationMode) => void;
}

export default function SlashMenu({ modes, onSelect }: SlashMenuProps) {
  return (
    <div style={{
      position: "absolute", bottom: "100%", left: 0, right: 0, marginBottom: 4,
      background: co.surface, border: `1px solid ${co.border}`, borderRadius: 8,
      maxHeight: 240, overflow: "auto", boxShadow: "0 -4px 20px rgba(0,0,0,0.15)", zIndex: 50,
    }}>
      {modes.length === 0 ? (
        <div style={{ padding: "10px 12px", fontSize: 12, color: co.muted }}>No matching commands</div>
      ) : (
        modes.map(m => {
          const config = MODE_REGISTRY[m];
          return (
            <button
              key={m}
              onMouseDown={(e) => { e.preventDefault(); onSelect(m); }}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                width: "100%", padding: "8px 12px", background: "none", border: "none",
                borderBottom: `1px solid ${co.border}`, cursor: "pointer", textAlign: "left",
                color: co.text, fontSize: 13,
              }}
            >
              <span>{config.label}</span>
              <span style={{ color: co.muted, fontSize: 12 }}>{config.slash}</span>
            </button>
          );
        })
      )}
    </div>
  );
}
```

`onMouseDown` (with `preventDefault`) rather than `onClick` is used so selecting a row fires before the input's `onBlur`/focus changes.

- [x] **Step 2: Verify it compiles**

Run:
```
npx tsc --noEmit
```
Expected: no new errors from `SlashMenu.tsx` (it isn't imported anywhere yet, so this mainly checks syntax).

---

## Task 3: Wire prompt input + slash menu into `WritingRoom`

**Files:**
- Modify: `src/components/WritingRoom.tsx`

- [x] **Step 1: Update imports and props**

In `src/components/WritingRoom.tsx`, change the imports at the top (lines 1-6) from:

```tsx
"use client";
import { useEffect, useState } from "react";
import { ChapterEditor } from "@/components/editor/ChapterEditor";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import { getChapterLabel } from "@/lib/formats";
import { currentStage, STAGE_ORDER, type GuideStage } from "@/lib/guide/next-action";
```

to:

```tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { ChapterEditor } from "@/components/editor/ChapterEditor";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import { getChapterLabel } from "@/lib/formats";
import { currentStage, STAGE_ORDER, type GuideStage } from "@/lib/guide/next-action";
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";
import { getVisibleModes, filterModesByQuery } from "@/lib/modes/slash-menu";
import SlashMenu from "@/components/SlashMenu";
```

Then update the `WritingRoomProps` interface (lines 16-25) from:

```tsx
interface WritingRoomProps {
  project: any;
  activeChap: any;
  updateProject: (fn: (p: any) => any) => void;
  updateChapter: (field: string, value: any) => void;
  generating: boolean;
  generate: () => Promise<void>;
  onOpenBible: () => void;
  onOpenActions: () => void;
}
```

to:

```tsx
interface WritingRoomProps {
  project: any;
  activeChap: any;
  updateProject: (fn: (p: any) => any) => void;
  updateChapter: (field: string, value: any) => void;
  generating: boolean;
  generate: () => Promise<void>;
  onOpenBible: () => void;
  onOpenActions: () => void;
  prompt: string;
  setPrompt: (value: string) => void;
  onSelectMode: (mode: GenerationMode) => void;
}
```

- [x] **Step 2: Destructure new props and compute slash-menu state**

Update the function signature (lines 27-30) from:

```tsx
export default function WritingRoom({
  project, activeChap, updateProject, updateChapter,
  generating, generate, onOpenBible, onOpenActions,
}: WritingRoomProps) {
  const [bibleOpen, setBibleOpen] = useState(true);
```

to:

```tsx
export default function WritingRoom({
  project, activeChap, updateProject, updateChapter,
  generating, generate, onOpenBible, onOpenActions,
  prompt, setPrompt, onSelectMode,
}: WritingRoomProps) {
  const [bibleOpen, setBibleOpen] = useState(true);
```

Then, right after the existing `const stageIdx = STAGE_ORDER.indexOf(stage);` line (around line 45), add:

```tsx
  const visibleModes = useMemo(() => getVisibleModes(project.format), [project.format]);
  const slashQuery = prompt.startsWith("/") ? prompt.slice(1) : null;
  const filteredModes = slashQuery !== null ? filterModesByQuery(slashQuery, visibleModes) : [];

  const handleSelect = (m: GenerationMode) => {
    setPrompt("");
    onSelectMode(m);
  };
```

- [x] **Step 3: Replace the footer with a prompt input + slash menu**

Replace the entire Footer block (lines 113-119):

```tsx
      {/* Footer */}
      <div style={{ flexShrink: 0, borderTop: `1px solid ${co.border}`, padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button style={sBtnSm} onClick={onOpenActions}>Actions</button>
        <button style={{ ...sBtn, opacity: generating ? 0.6 : 1 }} disabled={generating} onClick={() => generate()}>
          {generating ? "Writing…" : "Write"}
        </button>
      </div>
```

with:

```tsx
      {/* Footer */}
      <div style={{ flexShrink: 0, borderTop: `1px solid ${co.border}`, padding: "10px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ position: "relative" }}>
          {slashQuery !== null && <SlashMenu modes={filteredModes} onSelect={handleSelect} />}
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (slashQuery !== null) {
                  if (filteredModes.length > 0) handleSelect(filteredModes[0]);
                } else {
                  generate();
                }
              } else if (e.key === "Escape" && slashQuery !== null) {
                setPrompt("");
              }
            }}
            placeholder="What happens next? Type / for commands…"
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${co.border}`, background: co.surfaceAlt, color: co.text, fontSize: 13 }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button style={sBtnSm} onClick={onOpenActions}>Actions</button>
          <button style={{ ...sBtn, opacity: generating ? 0.6 : 1 }} disabled={generating} onClick={() => generate()}>
            {generating ? `${MODE_REGISTRY.write.label}…` : MODE_REGISTRY.write.label}
          </button>
        </div>
      </div>
```

- [x] **Step 4: Verify it compiles**

Run:
```
npx tsc --noEmit
```
Expected: errors only about `WritingRoom` being called without the 3 new required props (from `GhostWriterApp.tsx`, line ~487) — fixed in Task 4.

---

## Task 4: Wire `GhostWriterApp` — mode selection routes through the slash menu

**Files:**
- Modify: `src/components/GhostWriterApp.tsx`

- [x] **Step 1: Import `GenerationMode`**

In the import block (around line 14), add a new import line after `import { nextAction, type GuideAction } from "@/lib/guide/next-action";`:

```typescript
import type { GenerationMode } from "@/lib/modes/registry";
```

- [x] **Step 2: Replace `effectiveMode`/`effectivePrompt` derivation**

Find (around line 132-135):

```typescript
  const effectiveMode = writingRoomEnabled ? "write" : mode;
  const effectivePrompt = writingRoomEnabled
    ? (prompt.trim() || guideAction?.run.prompt || "Continue this scene.")
    : prompt;
```

Replace with:

```typescript
  // In the writing room, default to "write" unless the Actions overlay is open for
  // a mode the user picked via the slash menu (see handleSelectMode below).
  const effectiveMode = writingRoomEnabled ? (actionsOpen ? mode : "write") : mode;
  const effectivePrompt = writingRoomEnabled && effectiveMode === "write"
    ? (prompt.trim() || guideAction?.run.prompt || "Continue this scene.")
    : prompt;
```

- [x] **Step 3: Add `handleSelectMode`**

Immediately after the `effectivePrompt` declaration (and before `const aiActions = useAIActions({...})`), add:

```typescript
  const handleSelectMode = (selected: GenerationMode) => {
    setMode(selected);
    if (selected !== "write") setActionsOpen(true);
  };
```

- [x] **Step 4: Pass new props to `WritingRoom`**

Find the `<WritingRoom ... />` element (around line 487-496):

```tsx
          <WritingRoom
            project={project}
            activeChap={activeChap}
            updateProject={projectState.updateProject}
            updateChapter={projectState.updateChapter}
            generating={aiActions.generating}
            generate={aiActions.generate}
            onOpenBible={() => setLeftCollapsed(false)}
            onOpenActions={() => setActionsOpen(true)}
          />
```

Replace with:

```tsx
          <WritingRoom
            project={project}
            activeChap={activeChap}
            updateProject={projectState.updateProject}
            updateChapter={projectState.updateChapter}
            generating={aiActions.generating}
            generate={aiActions.generate}
            onOpenBible={() => setLeftCollapsed(false)}
            onOpenActions={() => setActionsOpen(true)}
            prompt={prompt}
            setPrompt={setPrompt}
            onSelectMode={handleSelectMode}
          />
```

- [x] **Step 5: Verify it compiles**

Run:
```
npx tsc --noEmit
```
Expected: exit 0, no errors.

---

## Final Verification

- [x] **Run the full relevant test suites**

```
npx vitest run src/lib/modes/__tests__/slash-menu.test.ts src/lib/modes/__tests__/registry.test.ts src/lib/guide/__tests__/next-action.test.ts
```
Expected: all pass (9 + 10 + 12 = 31 tests).

- [x] **Type-check the whole project**

```
npx tsc --noEmit
```
Expected: exit 0.

- [x] **Full production build**

```
npm run build
```
Expected: build succeeds (no new errors/warnings beyond pre-existing ones).

---

## Self-Review Notes

- **Spec coverage:** Implements the registry-driven `/`-command menu (Phase 0's `slash`/`label`/`keywords` fields now have a consumer). Selecting `/write` (or any text not starting with `/`) stays fully inline in the Writing Room. Selecting any of the other 25 modes opens the Plan 1 Actions overlay pre-selected to that mode's existing `ToolbarPanel` tab/panel — giving "one path" access to all 26 modes without re-implementing the 22 dedicated `generate<Mode>` flows (out of scope, high regression risk, tracked as a future phase if needed).
- **No commit steps:** Per standing project policy, this plan deliberately omits the `writing-plans` skill's default "Commit" steps. All work remains uncommitted in the working tree until the user explicitly asks for a commit.
- **Type consistency:** `onSelectMode(mode: GenerationMode)` in both `WritingRoomProps` and `GhostWriterApp`'s `handleSelectMode` match. `getVisibleModes`/`filterModesByQuery` signatures match their usage in `WritingRoom.tsx` and their test file.
- **No regression to the non-flag layout:** `effectiveMode`/`effectivePrompt` reduce to exactly `mode`/`prompt` when `writingRoomEnabled` is false, identical to pre-Plan-1 behavior.
