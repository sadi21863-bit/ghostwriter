# Redesign Phase 1: Guide Engine + Guide Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or execute inline task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the "Guide engine" — a pure function `nextAction(project)` that looks at a project's current state and returns ONE specific, actionable suggestion for what to do next — and mount a "Guide bar" in the CURRENT UI (`GhostWriterApp.tsx`) that surfaces this suggestion with a CTA button and a dismiss control. This is the redesign's lowest-risk phase: it adds a thin suggestion bar to the existing app without touching any existing layout, panels, or generation logic.

**Architecture:** `src/lib/guide/next-action.ts` exports a pure, fully-tested decision-ladder function operating on a narrow `GuideProject` shape (controllingIdea, characters, chapters, dismissedGuideIds) — no DB/network access, easy to unit test. `dismissedGuideIds: string[]` is added as a new jsonb column on `projects` (default `[]`) so dismissals persist across reloads. A new `GuideBar` component renders the current `GuideAction` (message + CTA + dismiss ×) and is mounted once near the top of `GhostWriterApp.tsx`. Clicking the CTA either switches `mode`/`prompt` (for brainstorm/outline/write suggestions) or opens an existing modal (`story_health`/`export`). A new minimal `/api/events` route lets the client log `guide_clicked`/`guide_dismissed` via the existing server-side `track()` helper.

**Scope note on the original spec's decision ladder:** The full 7-rung ladder in `ghostwriter-redesign.md` §3 includes a rung for "outline beat without a draft yet" (chapter-level granularity from a *structured* beats list) and a rung for "chapter just ended" (a wordCount-delta / session event, not a fact about persisted state). Neither structured beats nor delta-tracking exist in the current data model (confirmed: `projects.notes` holds outline text as an unstructured blob; no `beats` table/column anywhere). Building those is schema/data-model work that belongs in later phases (Phase 3/4, when Structure/Polish stage views are built). This plan implements an equivalent **7-rung ladder using only data that exists today** (`controllingIdea`, `characters`, `chapters[].wordCount`, `dismissedGuideIds`): premise → characters → outline → draft-next-empty-chapter → review-long-chapter → export-when-all-reviewed → keep-writing (fallback). This is a faithful, shippable approximation of the spec's intent and the chapter-level ladder can be swapped for a beat-level one later without changing `GuideAction`'s shape.

**Tech Stack:** TypeScript, Drizzle ORM (Neon Postgres), Vitest, React (Next.js App Router), existing `track()` analytics helper.

**Background:** This is "Phase 1" from `ghostwriter-redesign.md` §6, building on the completed Mode Registry refactor (Plans 1-2) and Phase 0 (`slash`/`keywords` added to `MODE_REGISTRY`, `src/lib/modes/registry.ts`). Phase 1 does NOT depend on Phase 0's new fields — it's independent and can ship first.

---

### Task 1: Add `dismissedGuideIds` column, Project type fields, and PATCH whitelist entry

**Files:**
- Modify: `src/db/schema.ts:16`
- Modify: `src/types/index.ts:1`
- Modify: `src/app/api/projects/[projectId]/route.ts:10`

- [x] **Step 1: Add the column to the `projects` table**

In `src/db/schema.ts:16`, the `projects` table is defined on one long line. Find this substring:

```typescript
controllingIdea: text("controlling_idea").default(""),
```

Replace it with:

```typescript
controllingIdea: text("controlling_idea").default(""), dismissedGuideIds: jsonb("dismissed_guide_ids").$type<string[]>().default([]),
```

(This follows the exact same `jsonb(...).$type<...>().default([])` pattern already used for `genres` on the same line.)

- [x] **Step 2: Add `controllingIdea` and `dismissedGuideIds` to the `Project` TS interface**

In `src/types/index.ts:1`, the `Project` interface is on one line. Find:

```typescript
export interface Project { id: string; name: string; format: string; skillLevel: "beginner" | "expert"; genres: string[]; notes: string; characters: Character[]; locations: Location[]; plotThreads: PlotThread[]; chapters: Chapter[]; referenceWorks: ReferenceWork[]; characterRelationships?: any[]; storyMemories?: any[]; aiRules?: any[]; }
```

Replace with:

```typescript
export interface Project { id: string; name: string; format: string; skillLevel: "beginner" | "expert"; genres: string[]; notes: string; controllingIdea?: string; characters: Character[]; locations: Location[]; plotThreads: PlotThread[]; chapters: Chapter[]; referenceWorks: ReferenceWork[]; characterRelationships?: any[]; storyMemories?: any[]; aiRules?: any[]; dismissedGuideIds?: string[]; }
```

- [x] **Step 3: Add `dismissedGuideIds` to the PATCH whitelist**

In `src/app/api/projects/[projectId]/route.ts:10`, find the destructure:

```typescript
const { name, format, genres, notes, skillLevel, aiRules, controllingIdea, narratorVoice, narrativeStructure, qualityGradingEnabled, aiismsCheck, storyType, universeId, timelineSort, phase, seriesParentId } = b;
```

Replace with:

```typescript
const { name, format, genres, notes, skillLevel, aiRules, controllingIdea, narratorVoice, narrativeStructure, qualityGradingEnabled, aiismsCheck, storyType, universeId, timelineSort, phase, seriesParentId, dismissedGuideIds } = b;
```

And find the `.set({ ... })` call's last conditional field before `updatedAt:new Date()`:

```typescript
...(seriesParentId !== undefined && { seriesParentId }), updatedAt:new Date()
```

Replace with:

```typescript
...(seriesParentId !== undefined && { seriesParentId }), ...(dismissedGuideIds !== undefined && { dismissedGuideIds }), updatedAt:new Date()
```

- [ ] **Step 4: Push the schema change to the database** — **BLOCKED: requires the user.** Claude Code's auto-mode classifier refuses to run `drizzle-kit push` against the production DB. Run manually (PowerShell, from the `ghostwriter` directory):
```powershell
Copy-Item .env.local .env -Force
npx drizzle-kit push
```
Expected: drizzle-kit reports the new `dismissed_guide_ids` jsonb column added to `projects`. Answer any interactive prompts by accepting the proposed additive change (new nullable/defaulted column — no data loss). Until this runs, the Guide bar's dismiss button will fail to persist (PATCH will error on the missing column) — everything else works.

- [x] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0. ✅ Confirmed.

---

### Task 2: Guide engine pure function (TDD)

**Files:**
- Create: `src/lib/guide/next-action.ts`
- Create: `src/lib/guide/__tests__/next-action.test.ts`

- [x] **Step 1: Write the failing tests**

Create `src/lib/guide/__tests__/next-action.test.ts`:

```typescript
// src/lib/guide/__tests__/next-action.test.ts
import { describe, it, expect } from "vitest";
import { nextAction, type GuideProject } from "../next-action";

const base: GuideProject = {
  controllingIdea: "",
  characters: [],
  chapters: [],
  dismissedGuideIds: [],
};

describe("nextAction", () => {
  it("suggests brainstorming a premise when controllingIdea is empty", () => {
    const action = nextAction(base);
    expect(action?.id).toBe("idea-premise");
    expect(action?.stage).toBe("idea");
    expect(action?.run.mode).toBe("brainstorm");
  });

  it("suggests brainstorming characters once a premise exists but no characters", () => {
    const action = nextAction({ ...base, controllingIdea: "A thief discovers her mark is her sister." });
    expect(action?.id).toBe("idea-characters");
    expect(action?.run.mode).toBe("brainstorm");
    expect(action?.run.prompt).toContain("A thief discovers her mark is her sister.");
  });

  it("suggests outlining once characters exist but no chapter has a draft", () => {
    const action = nextAction({
      ...base,
      controllingIdea: "Premise.",
      characters: [{ id: "char-1" }],
      chapters: [{ id: "ch-1", title: "Chapter 1", wordCount: 0, sortOrder: 0 }],
    });
    expect(action?.id).toBe("structure-outline");
    expect(action?.run.mode).toBe("outline");
  });

  it("suggests drafting the earliest empty chapter once at least one chapter has content", () => {
    const action = nextAction({
      ...base,
      controllingIdea: "Premise.",
      characters: [{ id: "char-1" }],
      chapters: [
        { id: "ch-1", title: "Chapter 1", wordCount: 800, sortOrder: 0 },
        { id: "ch-2", title: "Chapter 2", wordCount: 0, sortOrder: 1 },
        { id: "ch-3", title: "Chapter 3", wordCount: 0, sortOrder: 2 },
      ],
    });
    expect(action?.id).toBe("draft-chapter-ch-2");
    expect(action?.run.mode).toBe("write");
    expect(action?.run.chapterId).toBe("ch-2");
  });

  it("suggests a story health review once every chapter has a draft and one crosses the threshold", () => {
    const action = nextAction({
      ...base,
      controllingIdea: "Premise.",
      characters: [{ id: "char-1" }],
      chapters: [
        { id: "ch-1", title: "Chapter 1", wordCount: 600, sortOrder: 0 },
        { id: "ch-2", title: "Chapter 2", wordCount: 100, sortOrder: 1 },
      ],
    });
    expect(action?.id).toBe("polish-review-ch-1");
    expect(action?.run.mode).toBe("story_health");
    expect(action?.run.chapterId).toBe("ch-1");
  });

  it("suggests continuing the last chapter when nothing has crossed the review threshold and none are empty", () => {
    const action = nextAction({
      ...base,
      controllingIdea: "Premise.",
      characters: [{ id: "char-1" }],
      chapters: [
        { id: "ch-1", title: "Chapter 1", wordCount: 200, sortOrder: 0 },
        { id: "ch-2", title: "Chapter 2", wordCount: 150, sortOrder: 1 },
      ],
    });
    expect(action?.id).toBe("keep-writing-ch-2");
    expect(action?.run.chapterId).toBe("ch-2");
  });

  it("suggests exporting once every chapter is past the review threshold and all reviews are dismissed", () => {
    const action = nextAction({
      ...base,
      controllingIdea: "Premise.",
      characters: [{ id: "char-1" }],
      chapters: [
        { id: "ch-1", title: "Chapter 1", wordCount: 600, sortOrder: 0 },
        { id: "ch-2", title: "Chapter 2", wordCount: 700, sortOrder: 1 },
      ],
      dismissedGuideIds: ["polish-review-ch-1", "polish-review-ch-2"],
    });
    expect(action?.id).toBe("export-manuscript");
    expect(action?.run.mode).toBe("export");
  });

  it("returns null once the current suggestion has been dismissed and state hasn't changed", () => {
    const action = nextAction({ ...base, dismissedGuideIds: ["idea-premise"] });
    expect(action).toBeNull();
  });

  it("returns null once export-manuscript has been dismissed and the manuscript is unchanged", () => {
    const action = nextAction({
      ...base,
      controllingIdea: "Premise.",
      characters: [{ id: "char-1" }],
      chapters: [
        { id: "ch-1", title: "Chapter 1", wordCount: 600, sortOrder: 0 },
      ],
      dismissedGuideIds: ["polish-review-ch-1", "export-manuscript"],
    });
    expect(action).toBeNull();
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/guide/__tests__/next-action.test.ts`
Expected: FAIL — cannot find module `../next-action`. ✅ Confirmed (red step).

- [x] **Step 3: Implement `next-action.ts`**

Create `src/lib/guide/next-action.ts`:

```typescript
// src/lib/guide/next-action.ts
import type { GenerationMode } from "@/lib/modes/registry";

export type GuideStage = "idea" | "structure" | "draft" | "polish" | "export";

export type GuideRunSpec = {
  mode: GenerationMode | "story_health" | "export";
  prompt?: string;
  chapterId?: string;
};

export type GuideAction = {
  id: string;
  stage: GuideStage;
  message: string;
  cta: string;
  run: GuideRunSpec;
};

export interface GuideChapter {
  id: string;
  title: string;
  wordCount: number;
  sortOrder: number;
}

export interface GuideProject {
  controllingIdea?: string;
  characters: { id: string }[];
  chapters: GuideChapter[];
  dismissedGuideIds?: string[];
}

const REVIEW_THRESHOLD = 500;

/**
 * Returns the single next action the Guide bar should suggest, or null if
 * there's nothing to suggest (either the project is in a steady state, or
 * the one matching suggestion for the current state has been dismissed).
 */
export function nextAction(project: GuideProject): GuideAction | null {
  const action = computeAction(project);
  if (!action) return null;
  const dismissed = project.dismissedGuideIds ?? [];
  return dismissed.includes(action.id) ? null : action;
}

function computeAction(project: GuideProject): GuideAction | null {
  if (!project.controllingIdea?.trim()) {
    return {
      id: "idea-premise",
      stage: "idea",
      message: "Let's start with your story idea — tell me the premise and I'll help shape it.",
      cta: "Brainstorm premise",
      run: { mode: "brainstorm", prompt: "Help me develop a story premise and controlling idea for this project." },
    };
  }

  if (project.characters.length === 0) {
    return {
      id: "idea-characters",
      stage: "idea",
      message: "You have a premise — now sketch your main characters.",
      cta: "Brainstorm characters",
      run: { mode: "brainstorm", prompt: `Suggest 3 main characters (name, role, core want and need) for this story: ${project.controllingIdea}` },
    };
  }

  const sortedChapters = [...project.chapters].sort((a, b) => a.sortOrder - b.sortOrder);
  const hasAnyDraft = sortedChapters.some((c) => c.wordCount > 0);

  if (!hasAnyDraft) {
    return {
      id: "structure-outline",
      stage: "structure",
      message: "Time to outline — map out your story's major beats.",
      cta: "Generate outline",
      run: { mode: "outline", prompt: `Create a chapter-by-chapter outline for this story: ${project.controllingIdea}` },
    };
  }

  const undrafted = sortedChapters.find((c) => c.wordCount === 0);
  if (undrafted) {
    return {
      id: `draft-chapter-${undrafted.id}`,
      stage: "draft",
      message: `Ready to draft "${undrafted.title}" — let's write the opening scene.`,
      cta: "Start writing",
      run: { mode: "write", prompt: `Write the opening scene for "${undrafted.title}".`, chapterId: undrafted.id },
    };
  }

  const dismissed = project.dismissedGuideIds ?? [];
  const needsReview = sortedChapters.find(
    (c) => c.wordCount >= REVIEW_THRESHOLD && !dismissed.includes(`polish-review-${c.id}`)
  );
  if (needsReview) {
    return {
      id: `polish-review-${needsReview.id}`,
      stage: "polish",
      message: `"${needsReview.title}" is ${needsReview.wordCount} words — let's check its story health.`,
      cta: "Review story health",
      run: { mode: "story_health", chapterId: needsReview.id },
    };
  }

  const allLongEnough = sortedChapters.every((c) => c.wordCount >= REVIEW_THRESHOLD);
  if (allLongEnough) {
    return {
      id: "export-manuscript",
      stage: "export",
      message: `Your manuscript has ${sortedChapters.length} chapter${sortedChapters.length === 1 ? "" : "s"} — ready to export?`,
      cta: "Export manuscript",
      run: { mode: "export" },
    };
  }

  const last = sortedChapters[sortedChapters.length - 1];
  return {
    id: `keep-writing-${last.id}`,
    stage: "draft",
    message: `Keep going on "${last.title}" — ${last.wordCount} words so far.`,
    cta: "Continue writing",
    run: { mode: "write", prompt: "Continue this scene.", chapterId: last.id },
  };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/guide/__tests__/next-action.test.ts`
Expected: PASS — all 9 tests pass. ✅ Confirmed.

- [x] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0. ✅ Confirmed.

---

### Task 3: Generic client event-logging API route

**Files:**
- Create: `src/app/api/events/route.ts`

- [x] **Step 1: Create the route**

Create `src/app/api/events/route.ts`:

```typescript
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { track } from "@/lib/analytics";

const ALLOWED_EVENTS = new Set(["guide_clicked", "guide_dismissed"]);

export async function POST(req: Request) {
  const s = await getRequiredSession();
  const b = await req.json();
  const { event, properties } = b;
  if (typeof event !== "string" || !ALLOWED_EVENTS.has(event)) {
    return NextResponse.json({ error: "Unknown event" }, { status: 400 });
  }
  await track(s.user.id, event, properties ?? {});
  return NextResponse.json({ ok: true });
}
```

This mirrors the existing `track(userId, event, properties)` calls in `src/app/api/projects/route.ts:31`, but exposes a small whitelisted set of client-fireable event names (analytics events only — no business-logic side effects).

- [x] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0. ✅ Confirmed.

---

### Task 4: GuideBar component

**Files:**
- Create: `src/components/GuideBar.tsx`

- [x] **Step 1: Create the component**

Create `src/components/GuideBar.tsx`:

```tsx
"use client";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import type { GuideAction } from "@/lib/guide/next-action";

export function GuideBar({ action, onRun, onDismiss }: {
  action: GuideAction | null;
  onRun: (action: GuideAction) => void;
  onDismiss: (id: string) => void;
}) {
  if (!action) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      background: co.accentBg, borderBottom: `1px solid ${co.border}`,
      padding: "10px 16px", flexShrink: 0,
    }}>
      <span style={{ fontSize: 13, color: co.text }}>{action.message}</span>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        <button style={sBtn} onClick={() => onRun(action)}>{action.cta}</button>
        <button
          style={{ ...sBtnSm, background: "transparent", border: "none", fontSize: 16, padding: "0 4px" }}
          onClick={() => onDismiss(action.id)}
          aria-label="Dismiss suggestion"
        >
          ×
        </button>
      </div>
    </div>
  );
}
```

This uses the same `co`/`sBtn`/`sBtnSm` style tokens (`src/lib/styles.ts`) already used throughout `GhostWriterApp.tsx`, so it visually matches the rest of the app without new CSS.

- [x] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0. ✅ Confirmed.

---

### Task 5: Mount the Guide bar in GhostWriterApp.tsx

**Files:**
- Modify: `src/components/GhostWriterApp.tsx`

- [x] **Step 1: Add imports**

In `src/components/GhostWriterApp.tsx:2`, change:

```typescript
import { useState, useEffect } from "react";
```

to:

```typescript
import { useState, useEffect, useMemo } from "react";
```

Then, near the other top-level imports (after the `import { co, sBtn, sBtnSm } from "@/lib/styles";` line, currently line 12), add:

```typescript
import { GuideBar } from "@/components/GuideBar";
import { nextAction, type GuideAction } from "@/lib/guide/next-action";
```

- [x] **Step 2: Compute the current Guide action**

In `src/components/GhostWriterApp.tsx`, find:

```typescript
  const activeChap = project?.chapters?.find((c: any) => c.id === project.activeChapter)
    || project?.chapters?.[0]
    || { id: "", title: "Chapter 1", content: "", summary: "" };
```

Immediately after it, add:

```typescript

  const guideAction = useMemo(() => nextAction({
    controllingIdea: project?.controllingIdea,
    characters: project?.characters || [],
    chapters: project?.chapters || [],
    dismissedGuideIds: project?.dismissedGuideIds,
  }), [project?.controllingIdea, project?.characters, project?.chapters, project?.dismissedGuideIds]);
```

(Placed before the `loadError`/`!project` early returns at lines ~168/~196, satisfying the React rule that hooks must run unconditionally on every render. `project?.x` optional chaining handles the `project === null` case while loading.)

- [x] **Step 3: Add the click/dismiss handlers**

Find the line:

```typescript
  if (!project) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui" }}>Loading...</div>
  );
```

Immediately after this block (i.e., after the closing `);` of the `!project` early return, before the main `return (`), add:

```typescript

  const handleGuideRun = (action: GuideAction) => {
    fetch("/api/events", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "guide_clicked", properties: { actionId: action.id, stage: action.stage } }),
    }).catch(() => {});

    const { mode: runMode, prompt: runPrompt, chapterId: runChapterId } = action.run;
    if (runMode === "story_health") { setShowStoryHealth(true); return; }
    if (runMode === "export") { setShowExport(true); return; }
    setMode(runMode);
    setPrompt(runPrompt ?? "");
    if (runChapterId && runChapterId !== project.activeChapter) {
      projectState.updateProject((p: any) => ({ ...p, activeChapter: runChapterId }));
    }
  };

  const handleGuideDismiss = (id: string) => {
    fetch("/api/events", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "guide_dismissed", properties: { actionId: id } }),
    }).catch(() => {});

    const next = [...(project.dismissedGuideIds ?? []), id];
    projectState.updateProject((p: any) => ({ ...p, dismissedGuideIds: next }));
    fetch(`/api/projects/${project.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissedGuideIds: next }),
    }).catch(() => {});
  };
```

- [x] **Step 4: Render the Guide bar**

Find the closing `</div>` of the email-verification banner block — i.e., this whole conditional block:

```typescript
      {subscription?.emailVerified === false && !verifyBannerDismissed && (
        <div style={{ background: 'rgba(79,70,229,0.1)', ... }}>
          ...
        </div>
      )}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
```

Insert `<GuideBar ... />` between the email-verification block and the main flex container:

```typescript
      {subscription?.emailVerified === false && !verifyBannerDismissed && (
        <div style={{ background: 'rgba(79,70,229,0.1)', ... }}>
          ...
        </div>
      )}
      <GuideBar action={guideAction} onRun={handleGuideRun} onDismiss={handleGuideDismiss} />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
```

(Don't retype the banner's full body — just add the `<GuideBar .../>` line immediately before `<div style={{ display: "flex", flex: 1, overflow: "hidden" }}>`.)

- [x] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0. ✅ Confirmed.

---

### Task 6: Final verification

- [x] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all test files pass (existing suites + the new `next-action.test.ts`). ✅ 102/103 passed; the 1 failure (`ratelimit.test.ts` timeout) is pre-existing flakiness — re-run in isolation passes 3/3.

- [x] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds (exit 0). This confirms `GhostWriterApp.tsx`'s new imports/hooks/JSX compile cleanly in the full Next.js build, not just `tsc --noEmit`. ✅ Confirmed (exit 0), `/api/events` listed in route map.

- [x] **Step 3: Do NOT commit**

Per standing project policy, leave changes uncommitted for user review. ✅ Nothing committed.

---

## Status: COMPLETE except Task 1 Step 4 (drizzle-kit push), which requires the user to run manually — see Task 1 Step 4 above.
