# Phase 3 Plan 2 of 4: Idea & Structure Stage Views Implementation Plan

> **STATUS: COMPLETE** (2026-06-12). All 6 tasks implemented. Verification: `npx tsc --noEmit` exit 0 (clean); `npx vitest run src/lib/modes/__tests__ src/lib/guide/__tests__` → 4 test files, 39/39 passed (35 existing + 4 new `beats.test.ts`). Header/footer of `WritingRoom.tsx` unchanged for all stages — only the body is stage-routed. Uncommitted per standing policy.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Writing Room's body stage-aware: when the project is in the "Idea" or "Structure" stage (per `currentStage()`), show a dedicated stage view instead of the chapter editor — a premise card for Idea, an outline-beats list for Structure — while Draft/Polish/Export continue to show the existing editor body unchanged.

**Architecture:** `WritingRoom.tsx` already computes `stage` via `currentStage()` and renders a stage progress bar. This plan adds a small router around the body: `stage === "idea"` → `<IdeaStageView>`, `stage === "structure"` → `<StructureStageView>`, otherwise the existing editor+bible body. The header (stage bar, chapter nav) and footer (prompt input, Actions/Write) are unchanged for every stage — stage views replace only the body. To make the Structure view show real data across reloads, outline generations (`mode: "outline"`, which already produce `BEAT:`-prefixed lines) are persisted to `project.notes` via a small addition to `useAIActions.generate()`. `parseBeatList` is extracted from `WritePanel.tsx` into a shared module so both WritePanel and the new Structure view use the same parsing logic.

**Tech Stack:** Next.js 16 (App Router), React, TypeScript, Vitest, existing `@/lib/styles` (`co`, `sBtn`, `sBtnSm`, `sTextarea`) design tokens.

---

## Background

**Spec (`ghostwriter-redesign.md` §2.4, Stage views):**
> Idea = braindump flow + premise card (done = premise saved). Structure = outline beats as vertical list (done = ≥1 chapter with beats). Polish = StoryHealthPanel + QualityReviewPanel merged into ONE report view, surfaced only when chapter >500 words. Export = ExportPanel + SeriesPipelinePanel/Higgsfield (Production Studio relocates here).

**Re-scoping decision (Phase 3 now 4 plans, not 3):** §2.4 covers four independent stage views. Idea and Structure are small, additive, and "done" automatically once `currentStage()` (in `src/lib/guide/next-action.ts`) advances past them — they need no new "done" tracking of their own. Polish and Export require *merging* several large existing panels (`StoryHealthPanel` ~9 tabs, `QualityReviewPanel`, `ExportPanel`, `SeriesPipelinePanel`, Production Studio relocation) — a separable, much larger unit of work. Per the writing-plans Scope Check, Phase 3 is re-split:
- **Plan 2 of 4 (this plan):** Idea & Structure stage views + stage router + outline persistence.
- **Plan 3 of 4 (new):** Polish & Export stage views (panel merges, Production Studio relocation).
- **Plan 4 of 4 (was "3 of 3"):** Creator variant distribution (§2.5).

**Idea stage — "premise card (done = premise saved)":** `currentStage()` returns `"idea"` when `controllingIdea` is empty OR when it's set but `characters.length === 0`. The Idea stage view therefore has two states: (1) no premise yet → an editable textarea + "Save premise" button that PATCHes `controllingIdea`; (2) premise saved → a read-only premise card, plus (if no characters yet) a CTA to open the Story Bible (`onOpenBible`, already wired in `WritingRoom`). The "braindump flow" for *creating a new project* already exists at Home (`BraindumpModal`, Phase 3 Plan 1) — this view is for shaping the premise of the *current* project, which the Guide bar (always visible above `WritingRoom`) already offers a "Brainstorm premise"/"Brainstorm characters" CTA for. This view adds the direct data-in path the design laws call for ("data-in/instructions-out").

**Structure stage — "outline beats as vertical list (done = ≥1 chapter with beats)":** `currentStage()` returns `"structure"` once a premise + characters exist but no chapter has `wordCount > 0`; it automatically advances to `"draft"` the moment any chapter gets content — so "done" needs no new logic. The gap: `mode: "outline"` generations produce `BEAT:`-prefixed lines (parsed by `WritePanel`'s local `parseBeatList`) but the result is never persisted — it only lives in `streamText` during that one session. This plan extracts `parseBeatList` into `src/lib/modes/beats.ts` and adds a small persistence step in `useAIActions.generate()`: when `mode === "outline"` and the result parses as a beat list, save it to `project.notes` (PATCH `/api/projects/:id`). The Structure stage view then reads `project.notes`:
- No beats found → empty state with "Generate outline →" (sets the Guide's outline prompt + opens the Actions overlay via `onSelectMode("outline")`, reusing the existing WritePanel outline UI).
- Beats found → numbered vertical list; each beat has "Expand to draft →", which calls `setPrompt(\`Write this scene: ${beat}\`)` — the same prompt format `expandBeat` uses (`src/hooks/useAIActions.ts:203`) — populating the **existing, unchanged** footer prompt box. The user presses the existing "Write" button to generate. Once that chapter's `wordCount > 0`, `currentStage()` advances to `"draft"` on the next render and the router swaps back to the normal editor automatically.

**Why the footer stays visible for every stage:** `generate()` closes over the `prompt` value from the render in which it was created. If a stage view called `setPrompt(...)` and then immediately called `generate()` in the same handler, `generate` would still use the *previous* render's (stale, empty) `prompt`. Keeping the footer mounted and letting `setPrompt(...)` populate it — with the user's explicit click on the existing "Write"/"Generate" button performing the generation on the *next* render — avoids this stale-closure problem entirely and keeps "one primary button" per design law.

---

### Task 1: Extract `parseBeatList` into a shared module

**Files:**
- Create: `src/lib/modes/beats.ts`
- Test: `src/lib/modes/__tests__/beats.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/modes/__tests__/beats.test.ts
import { describe, it, expect } from "vitest";
import { parseBeatList } from "../beats";

describe("parseBeatList", () => {
  it("returns null when there are fewer than 3 BEAT: lines", () => {
    expect(parseBeatList("BEAT: One\nBEAT: Two")).toBeNull();
  });

  it("returns null for text with no BEAT: lines", () => {
    expect(parseBeatList("Just some prose.\nNo beats here.")).toBeNull();
  });

  it("parses three or more BEAT: lines, stripping the prefix and surrounding text", () => {
    const text = [
      "Here is your outline:",
      "BEAT: The hero leaves home.",
      "BEAT: A storm hits the ship.",
      "BEAT: Landfall on a strange island.",
      "Let me know if you'd like changes.",
    ].join("\n");
    expect(parseBeatList(text)).toEqual([
      "The hero leaves home.",
      "A storm hits the ship.",
      "Landfall on a strange island.",
    ]);
  });

  it("trims whitespace around beat text regardless of spacing after the colon", () => {
    const text = "BEAT:   Beat one  \nBEAT:Beat two\nBEAT: Beat three";
    expect(parseBeatList(text)).toEqual(["Beat one", "Beat two", "Beat three"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/modes/__tests__/beats.test.ts`
Expected: FAIL — `Failed to resolve import "../beats"` (module does not exist yet).

- [ ] **Step 3: Create the shared module**

```ts
// src/lib/modes/beats.ts
export function parseBeatList(text: string): string[] | null {
  const lines = text.split('\n').filter(l => l.trim().startsWith('BEAT:'));
  if (lines.length < 3) return null;
  return lines.map(l => l.replace(/^BEAT:\s*/, '').trim());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/modes/__tests__/beats.test.ts`
Expected: PASS (4/4)

---

### Task 2: Point `WritePanel.tsx` at the shared `parseBeatList`

**Files:**
- Modify: `src/components/panels/toolbar/modes/WritePanel.tsx:1-40`

- [ ] **Step 1: Remove the local `parseBeatList` and import the shared one**

In `src/components/panels/toolbar/modes/WritePanel.tsx`, the file currently starts:

```tsx
"use client";
import { useRef, useState, useEffect } from "react";
import { getLoadingMessage } from "@/lib/loadingMessages";
import { co, sInput, sTextarea, sBtn, sBtnSm } from "@/lib/styles";
import { toast } from '@/lib/toast';
import { ProsePanel } from "../tools/ProsePanel";
import { ScoreHookPanel } from "../tools/ScoreHookPanel";
import { TitleHookPanel } from "../tools/TitleHookPanel";
import type { HookScore, ProseResult } from "../types";
import { SlashCommandPalette } from "@/components/editor/SlashCommandPalette";
import type { SlashCommandId } from "@/lib/slash-commands";
import { suggestSkill } from "@/lib/ai/skill-router";
import type { SkillSuggestion } from "@/lib/ai/skill-router";
import { EMOTIONAL_TONES, ARC_POSITIONS } from "@/lib/arc";
import { ChapterEditor } from "@/components/editor/ChapterEditor";
import { SceneView } from "@/components/editor/SceneView";
import type { Scene } from "@/types";
import { isStoryFormat, isCreatorFormat } from "@/lib/formats";
import { CAMERA_PRESETS, VIRAL_PRESETS } from "@/lib/higgsfield/presets";

function parseBrainstormOptions(text: string): { label: string; name: string; content: string }[] | null {
  const headerRe = /OPTION\s+([A-C])\s+[-—–]\s+([^\n:]+)/gi;
  const headers: { label: string; name: string; pos: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(text)) !== null) {
    headers.push({ label: m[1], name: m[2].trim(), pos: m.index });
  }
  if (headers.length < 3) return null;
  return headers.slice(0, 3).map((h, i) => {
    const start = text.indexOf('\n', h.pos) + 1;
    const end = i + 1 < 3 ? headers[i + 1].pos : text.length;
    return { label: h.label, name: h.name, content: text.slice(start, end).trim() };
  });
}

function parseBeatList(text: string): string[] | null {
  const lines = text.split('\n').filter(l => l.trim().startsWith('BEAT:'));
  if (lines.length < 3) return null;
  return lines.map(l => l.replace(/^BEAT:\s*/, '').trim());
}
```

Change it to:

```tsx
"use client";
import { useRef, useState, useEffect } from "react";
import { getLoadingMessage } from "@/lib/loadingMessages";
import { co, sInput, sTextarea, sBtn, sBtnSm } from "@/lib/styles";
import { toast } from '@/lib/toast';
import { ProsePanel } from "../tools/ProsePanel";
import { ScoreHookPanel } from "../tools/ScoreHookPanel";
import { TitleHookPanel } from "../tools/TitleHookPanel";
import type { HookScore, ProseResult } from "../types";
import { SlashCommandPalette } from "@/components/editor/SlashCommandPalette";
import type { SlashCommandId } from "@/lib/slash-commands";
import { suggestSkill } from "@/lib/ai/skill-router";
import type { SkillSuggestion } from "@/lib/ai/skill-router";
import { EMOTIONAL_TONES, ARC_POSITIONS } from "@/lib/arc";
import { ChapterEditor } from "@/components/editor/ChapterEditor";
import { SceneView } from "@/components/editor/SceneView";
import type { Scene } from "@/types";
import { isStoryFormat, isCreatorFormat } from "@/lib/formats";
import { CAMERA_PRESETS, VIRAL_PRESETS } from "@/lib/higgsfield/presets";
import { parseBeatList } from "@/lib/modes/beats";

function parseBrainstormOptions(text: string): { label: string; name: string; content: string }[] | null {
  const headerRe = /OPTION\s+([A-C])\s+[-—–]\s+([^\n:]+)/gi;
  const headers: { label: string; name: string; pos: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(text)) !== null) {
    headers.push({ label: m[1], name: m[2].trim(), pos: m.index });
  }
  if (headers.length < 3) return null;
  return headers.slice(0, 3).map((h, i) => {
    const start = text.indexOf('\n', h.pos) + 1;
    const end = i + 1 < 3 ? headers[i + 1].pos : text.length;
    return { label: h.label, name: h.name, content: text.slice(start, end).trim() };
  });
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0 (no unused-symbol or unresolved-import errors).

---

### Task 3: Persist outline generations to `project.notes`

**Files:**
- Modify: `src/hooks/useAIActions.ts:1-37` (imports + params type)
- Modify: `src/hooks/useAIActions.ts:166-178` (`generate()` result handling)
- Modify: `src/components/GhostWriterApp.tsx:145-158` (`useAIActions(...)` call)

- [ ] **Step 1: Add `parseBeatList` import and `updateProject` param to `useAIActions`**

In `src/hooks/useAIActions.ts`, the top of the file currently reads:

```ts
"use client";
import { useState, useRef } from "react";
import { toast } from "@/lib/toast";
import { buildStaticContext, buildDynamicContext, buildBeginnerContext, buildCreatorContext } from "@/lib/ai/context-builder";
import { getPipelines, type Pipeline } from "@/lib/ai/pipelines";
import { isCreatorFormat } from "@/lib/formats";
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";
import type { CompositionLayer } from "@/lib/ai/composer";
import { plainTextToTipTap, isValidTipTapJson, getWordCount } from "@/lib/editor/content-migration";
```

Change to:

```ts
"use client";
import { useState, useRef } from "react";
import { toast } from "@/lib/toast";
import { buildStaticContext, buildDynamicContext, buildBeginnerContext, buildCreatorContext } from "@/lib/ai/context-builder";
import { getPipelines, type Pipeline } from "@/lib/ai/pipelines";
import { isCreatorFormat } from "@/lib/formats";
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";
import type { CompositionLayer } from "@/lib/ai/composer";
import { plainTextToTipTap, isValidTipTapJson, getWordCount } from "@/lib/editor/content-migration";
import { parseBeatList } from "@/lib/modes/beats";
```

Then the params destructure + type currently read:

```ts
export function useAIActions({
  project, mode, prompt, activeChap,
  updateChapter, setErrorMsg, setSavedMsg,
  creatorBible, cohostVoice, setUpgradeRequired,
  activeInfluence, activePatterns,
}: {
  project: any; mode: string; prompt: string; activeChap: any;
  updateChapter: (f: string, v: any) => void;
  setErrorMsg: (msg: string | null) => void;
  setSavedMsg: (msg: string) => void;
  creatorBible: any;
  cohostVoice?: string;
  setUpgradeRequired?: (feature: string) => void;
  activeInfluence?: any;
  activePatterns?: any[];
}) {
```

Change to:

```ts
export function useAIActions({
  project, mode, prompt, activeChap,
  updateChapter, updateProject, setErrorMsg, setSavedMsg,
  creatorBible, cohostVoice, setUpgradeRequired,
  activeInfluence, activePatterns,
}: {
  project: any; mode: string; prompt: string; activeChap: any;
  updateChapter: (f: string, v: any) => void;
  updateProject?: (fn: (p: any) => any) => void;
  setErrorMsg: (msg: string | null) => void;
  setSavedMsg: (msg: string) => void;
  creatorBible: any;
  cohostVoice?: string;
  setUpgradeRequired?: (feature: string) => void;
  activeInfluence?: any;
  activePatterns?: any[];
}) {
```

- [ ] **Step 2: Persist `project.notes` when an outline generation produces a beat list**

In `src/hooks/useAIActions.ts`, the `generate()` result-handling block currently reads:

```ts
      else {
        if (mode === "write") {
          setUndoStack(s => [...s.slice(-9), activeChap.content]);
          const merged = appendToTipTap(activeChap.content, r.text);
          updateChapter("content", merged);
          updateChapter("wordCount", getWordCount(merged));
        } else {
          setStreamText(r.text);
        }
        if (MODE_REGISTRY[mode as GenerationMode]?.qualityCheck && (project as any).qualityGradingEnabled) {
          runQualityCheck(r.text, project.id);
        }
      }
```

Change to:

```ts
      else {
        if (mode === "write") {
          setUndoStack(s => [...s.slice(-9), activeChap.content]);
          const merged = appendToTipTap(activeChap.content, r.text);
          updateChapter("content", merged);
          updateChapter("wordCount", getWordCount(merged));
        } else {
          setStreamText(r.text);
          if (mode === "outline" && parseBeatList(r.text)) {
            updateProject?.((p: any) => ({ ...p, notes: r.text }));
            fetch(`/api/projects/${project.id}`, {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ notes: r.text }),
            }).catch(() => {});
          }
        }
        if (MODE_REGISTRY[mode as GenerationMode]?.qualityCheck && (project as any).qualityGradingEnabled) {
          runQualityCheck(r.text, project.id);
        }
      }
```

- [ ] **Step 3: Pass `updateProject` from `GhostWriterApp`**

In `src/components/GhostWriterApp.tsx`, the `useAIActions(...)` call currently reads:

```tsx
  const aiActions = useAIActions({
    project: project || {},
    mode: effectiveMode,
    prompt: effectivePrompt,
    activeChap,
    updateChapter: projectState.updateChapter,
    setErrorMsg,
    setSavedMsg,
    creatorBible: projectState.creatorBible,
    cohostVoice,
    setUpgradeRequired: (f) => setUpgradeRequired(f as FeatureGate),
    activeInfluence,
    activePatterns,
  });
```

Change to:

```tsx
  const aiActions = useAIActions({
    project: project || {},
    mode: effectiveMode,
    prompt: effectivePrompt,
    activeChap,
    updateChapter: projectState.updateChapter,
    updateProject: projectState.updateProject,
    setErrorMsg,
    setSavedMsg,
    creatorBible: projectState.creatorBible,
    cohostVoice,
    setUpgradeRequired: (f) => setUpgradeRequired(f as FeatureGate),
    activeInfluence,
    activePatterns,
  });
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0

---

### Task 4: Create `IdeaStageView`

**Files:**
- Create: `src/components/stages/IdeaStageView.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/stages/IdeaStageView.tsx
"use client";
import { useState } from "react";
import { co, sBtn, sBtnSm, sTextarea } from "@/lib/styles";

interface IdeaStageViewProps {
  project: any;
  updateProject: (fn: (p: any) => any) => void;
  onOpenBible: () => void;
}

export default function IdeaStageView({ project, updateProject, onOpenBible }: IdeaStageViewProps) {
  const hasPremise = !!project.controllingIdea?.trim();
  const [draft, setDraft] = useState(project.controllingIdea ?? "");
  const [editing, setEditing] = useState(!hasPremise);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controllingIdea: draft }),
      });
      updateProject((p: any) => ({ ...p, controllingIdea: draft }));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "32px 24px", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 560, width: "100%" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
          Premise
        </div>

        {editing ? (
          <>
            <p style={{ fontSize: 13, color: co.muted, lineHeight: 1.6, marginTop: 0, marginBottom: 12 }}>
              What&apos;s this story really about? A sentence or two — the premise and the idea underneath it.
            </p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. A retired assassin is forced back into the trade when the one person she protected is taken — and discovers the people who took them trained her."
              rows={5}
              style={{ ...sTextarea, width: "100%", boxSizing: "border-box" }}
              autoFocus
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button style={{ ...sBtn, opacity: draft.trim() && !saving ? 1 : 0.5 }} disabled={!draft.trim() || saving} onClick={handleSave}>
                {saving ? "Saving…" : "Save premise"}
              </button>
              {hasPremise && (
                <button style={sBtnSm} onClick={() => { setDraft(project.controllingIdea ?? ""); setEditing(false); }}>
                  Cancel
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: "16px 18px", borderRadius: 10, border: `1px solid ${co.border}`, background: co.surface, fontSize: 14, color: co.text, lineHeight: 1.6, marginBottom: 12 }}>
              {project.controllingIdea}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button style={sBtnSm} onClick={() => setEditing(true)}>Edit premise</button>
              {(project.characters || []).length === 0 && (
                <button style={sBtn} onClick={onOpenBible}>Add characters →</button>
              )}
            </div>
            {(project.characters || []).length === 0 && (
              <p style={{ fontSize: 12, color: co.muted, marginTop: 10, lineHeight: 1.6 }}>
                Next: sketch your main characters in the Story Bible — who wants what, and why.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0

---

### Task 5: Create `StructureStageView`

**Files:**
- Create: `src/components/stages/StructureStageView.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/stages/StructureStageView.tsx
"use client";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import { parseBeatList } from "@/lib/modes/beats";
import type { GenerationMode } from "@/lib/modes/registry";

interface StructureStageViewProps {
  project: any;
  setPrompt: (value: string) => void;
  onSelectMode: (mode: GenerationMode) => void;
}

export default function StructureStageView({ project, setPrompt, onSelectMode }: StructureStageViewProps) {
  const beats = parseBeatList(project.notes || "");

  const handleGenerateOutline = () => {
    setPrompt(`Create a chapter-by-chapter outline for this story: ${project.controllingIdea ?? ""}`);
    onSelectMode("outline");
  };

  const handleExpandBeat = (beat: string) => {
    setPrompt(`Write this scene: ${beat}`);
  };

  if (!beats) {
    return (
      <div style={{ flex: 1, overflow: "auto", padding: "32px 24px", display: "flex", justifyContent: "center" }}>
        <div style={{ maxWidth: 560, width: "100%", textAlign: "center", paddingTop: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
            Structure
          </div>
          <p style={{ fontSize: 14, color: co.muted, lineHeight: 1.6, marginBottom: 16 }}>
            No outline yet. Generate a chapter-by-chapter beat list to map out the story before you start drafting.
          </p>
          <button style={sBtn} onClick={handleGenerateOutline}>Generate outline →</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "32px 24px", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 560, width: "100%" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
          Structure
        </div>
        <p style={{ fontSize: 12, color: co.muted, lineHeight: 1.6, marginBottom: 16 }}>
          {beats.length} beats. Expand a beat to draft it as the opening of this chapter.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {beats.map((beat, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", borderRadius: 10, border: `1px solid ${co.border}`, background: co.surface }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: co.accent, flexShrink: 0, minWidth: 20 }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 13, color: co.text, lineHeight: 1.6 }}>{beat}</span>
              <button style={{ ...sBtnSm, flexShrink: 0 }} onClick={() => handleExpandBeat(beat)}>Expand to draft →</button>
            </div>
          ))}
        </div>
        <button style={{ ...sBtnSm, marginTop: 16 }} onClick={handleGenerateOutline}>Regenerate outline</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0

---

### Task 6: Wire the stage router into `WritingRoom`

**Files:**
- Modify: `src/components/WritingRoom.tsx`

- [ ] **Step 1: Import the new stage views**

The import block at the top of `src/components/WritingRoom.tsx` currently reads:

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

Change to:

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
import IdeaStageView from "@/components/stages/IdeaStageView";
import StructureStageView from "@/components/stages/StructureStageView";
```

- [ ] **Step 2: Route the body by stage**

The body block in `src/components/WritingRoom.tsx` currently reads:

```tsx
      {/* Body: editor + bible glance rail */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <ChapterEditor
          content={activeChap.content ?? ""}
          onChange={handleEditorChange}
          placeholder="Begin writing..."
          autoFocus
        />

        <div style={{ width: bibleOpen ? 190 : 36, minWidth: bibleOpen ? 190 : 36, borderLeft: `1px solid ${co.border}`, background: co.surface, transition: "width 0.2s", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: bibleOpen ? "space-between" : "center", alignItems: "center", padding: "8px" }}>
            {bibleOpen && <span style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1 }}>Bible</span>}
            <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 14 }} onClick={() => setBibleOpen(o => !o)}>{bibleOpen ? "▶" : "◀"}</button>
          </div>
          {bibleOpen && (
            <div style={{ flex: 1, overflow: "auto", padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 14 }}>
              <BibleSection title="Characters" items={(project.characters || []).map((c: any) => c.name)} />
              <BibleSection title="Locations" items={(project.locations || []).map((l: any) => l.name)} />
              <BibleSection title="Threads" items={(project.plotThreads || []).map((t: any) => t.name)} />
              <button style={{ ...sBtnSm, marginTop: "auto" }} onClick={onOpenBible}>Open bible →</button>
            </div>
          )}
        </div>
      </div>
```

Change to:

```tsx
      {/* Body: stage view, or editor + bible glance rail for draft/polish/export */}
      {stage === "idea" ? (
        <IdeaStageView project={project} updateProject={updateProject} onOpenBible={onOpenBible} />
      ) : stage === "structure" ? (
        <StructureStageView project={project} setPrompt={setPrompt} onSelectMode={onSelectMode} />
      ) : (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <ChapterEditor
            content={activeChap.content ?? ""}
            onChange={handleEditorChange}
            placeholder="Begin writing..."
            autoFocus
          />

          <div style={{ width: bibleOpen ? 190 : 36, minWidth: bibleOpen ? 190 : 36, borderLeft: `1px solid ${co.border}`, background: co.surface, transition: "width 0.2s", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: bibleOpen ? "space-between" : "center", alignItems: "center", padding: "8px" }}>
              {bibleOpen && <span style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1 }}>Bible</span>}
              <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 14 }} onClick={() => setBibleOpen(o => !o)}>{bibleOpen ? "▶" : "◀"}</button>
            </div>
            {bibleOpen && (
              <div style={{ flex: 1, overflow: "auto", padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 14 }}>
                <BibleSection title="Characters" items={(project.characters || []).map((c: any) => c.name)} />
                <BibleSection title="Locations" items={(project.locations || []).map((l: any) => l.name)} />
                <BibleSection title="Threads" items={(project.plotThreads || []).map((t: any) => t.name)} />
                <button style={{ ...sBtnSm, marginTop: "auto" }} onClick={onOpenBible}>Open bible →</button>
              </div>
            )}
          </div>
        </div>
      )}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0

---

## Final Verification

- [ ] Run `npx tsc --noEmit` — expect exit 0.
- [ ] Run `npx vitest run src/lib/modes/__tests__ src/lib/guide/__tests__` — expect all pass (existing 35 + 4 new `beats.test.ts` = 39).
- [ ] Manual reasoning check (no `npm run build` this session per established pattern): confirm `WritingRoom.tsx` only changed the body block — header (stage bar) and footer (prompt input, Actions/Write) are byte-identical to before, so the `writingRoomShell`-off path and draft/polish/export stages are unaffected.

## Self-Review Notes

- **Spec coverage:** Idea = premise card with save (done = premise saved) ✅. Structure = outline beats as vertical list, "done" handled by existing `currentStage()` ladder (no new tracking needed) ✅. Polish/Export explicitly deferred to new Plan 3 of 4, documented in Background ✅.
- **Type consistency:** `IdeaStageView` and `StructureStageView` prop names (`project`, `updateProject`, `onOpenBible`, `setPrompt`, `onSelectMode`) all match types already present in `WritingRoomProps` (`src/components/WritingRoom.tsx:19-31`) — no new types introduced at the `WritingRoom` boundary. `useAIActions`'s new `updateProject` param is optional (`?:`) so existing callers (if any beyond `GhostWriterApp`) remain valid.
- **No placeholders:** every task has complete, ready-to-paste code.
