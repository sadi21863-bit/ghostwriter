> **STATUS: COMPLETE** (2026-06-14) — `src/lib/modes/classify.ts` (LIBRARY_MODES + classifyBeat, 7 tests passing) and `src/components/BeatDetectionChip.tsx` created; `WritingRoom.tsx` wired up (detectedMode/dismissedDetection state, chip rendered above prompt input in the draft stage). `npx tsc --noEmit` exit 0; `npx vitest run src/lib/modes/__tests__ src/lib/guide/__tests__ src/lib/ai/__tests__` → 80/80 passed. Panel-deletion (original Phase 5's other half) deferred/superseded per the Notes section below — Phase 5 is now considered complete with this plan alone.

# Redesign Phase 5 Plan 1: Beat Classification + Library Accent Chip

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. (Commit steps intentionally omitted per project policy — all redesign work stays uncommitted until the user reviews it as a whole.)

**Goal:** Detect when the free-form prompt text a user types in the Writing Room's Draft stage matches one of the 23 library modes' keywords (`MODE_REGISTRY[mode].keywords`, added in Phase 0), and surface a small dismissible "Looks like {Mode} — apply?" chip above the prompt input. Accepting it opens the existing Actions drawer for that mode via the existing `onSelectMode` handler, preserving the prompt text so it carries into that mode's panel.

**Architecture:** New pure module `src/lib/modes/classify.ts` exports `LIBRARY_MODES` (the 23 non-universal generation modes, in registry order) and `classifyBeat(text, candidates)`, which whole-word/case-insensitive matches each candidate mode's `keywords` against the text and returns the mode with the most matches (or `null` if none match). New presentational component `src/components/BeatDetectionChip.tsx` mirrors `GuideBar.tsx`'s chip styling. `WritingRoom.tsx` computes `detectedMode` via `useMemo` — only in the `draft` stage, only when the user isn't mid slash-command — tracks a per-mode dismissal that resets when the prompt is cleared, and renders the chip above the prompt input.

This is purely additive: it does not touch `ToolbarPanel.tsx`, the 24 active mode panels, or any `generate*` function. Output quality is unaffected — the chip only changes *which mode the user lands in*, not how that mode generates text.

**Tech Stack:** TypeScript, React, Vitest.

---

### Task 1: Beat classifier module + tests

**Files:**
- Create: `src/lib/modes/classify.ts`
- Test: `src/lib/modes/__tests__/classify.test.ts`

- [x] **Step 1: Write `src/lib/modes/classify.ts`**

```ts
// src/lib/modes/classify.ts
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";

/** The 23 library modes (all generation modes except brainstorm/outline/write), in registry order. */
export const LIBRARY_MODES: GenerationMode[] = [
  "dialogue", "combat", "emotional", "atmosphere", "tension", "composition",
  "horror", "comedy", "mystery", "romance", "action", "monologue", "voice",
  "thriller", "sports", "setting", "historical", "scitech", "ethics",
  "endings", "isekai", "interrogation", "chase",
];

/**
 * Classifies free-form beat/prompt text against each candidate mode's keywords,
 * returning the mode with the most whole-word (case-insensitive) keyword matches.
 * Ties go to whichever candidate appears first in `candidates`. Returns null if
 * the text is empty or no candidate's keywords match.
 */
export function classifyBeat(text: string, candidates: GenerationMode[] = LIBRARY_MODES): GenerationMode | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  let best: GenerationMode | null = null;
  let bestScore = 0;
  for (const mode of candidates) {
    let score = 0;
    for (const keyword of MODE_REGISTRY[mode].keywords) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`, "i");
      if (re.test(trimmed)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = mode;
    }
  }
  return best;
}
```

- [x] **Step 2: Write `src/lib/modes/__tests__/classify.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { classifyBeat, LIBRARY_MODES } from "@/lib/modes/classify";

describe("LIBRARY_MODES", () => {
  it("has exactly 23 modes, excluding brainstorm/outline/write", () => {
    expect(LIBRARY_MODES).toHaveLength(23);
    expect(LIBRARY_MODES).not.toContain("brainstorm");
    expect(LIBRARY_MODES).not.toContain("outline");
    expect(LIBRARY_MODES).not.toContain("write");
  });
});

describe("classifyBeat", () => {
  it("detects a combat beat", () => {
    expect(classifyBeat("He drew his sword and lunged across the field")).toBe("combat");
  });

  it("detects an emotional beat", () => {
    expect(classifyBeat("She broke down in tears, utterly devastated")).toBe("emotional");
  });

  it("returns null for empty text", () => {
    expect(classifyBeat("")).toBeNull();
    expect(classifyBeat("   ")).toBeNull();
  });

  it("returns null when no candidate keywords match", () => {
    expect(classifyBeat("Just a normal quiet morning, nothing much happening")).toBeNull();
  });

  it("picks the candidate with more keyword matches, restricted to given candidates", () => {
    const text = "Their conversation turned into a heated argument";
    expect(classifyBeat(text, ["dialogue", "tension"])).toBe("dialogue");
  });

  it("does not match partial words", () => {
    // "cry" is an emotional keyword but should not match "crying" without a word boundary... 
    // however "tears"/"devastated" still match, so emotional wins via those whole-word hits.
    expect(classifyBeat("She was crying", ["emotional"])).toBe(null);
  });
});
```

- [x] **Step 3: Run the tests**

Run: `npx vitest run src/lib/modes/__tests__/classify.test.ts`
Expected: 6 tests pass (2 in `LIBRARY_MODES`, 4... actually 5 in `classifyBeat`, totalling 6).

If `classifyBeat("She was crying", ["emotional"])` does NOT return `null` (e.g. if "cry" somehow matches), inspect which emotional keyword matched and adjust the test text — the intent is just to confirm whole-word matching, not a specific keyword list.

---

### Task 2: Beat detection chip component

**Files:**
- Create: `src/components/BeatDetectionChip.tsx`

- [x] **Step 1: Write `src/components/BeatDetectionChip.tsx`**

```tsx
"use client";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";

export default function BeatDetectionChip({ mode, onApply, onDismiss }: {
  mode: GenerationMode;
  onApply: () => void;
  onDismiss: () => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      background: co.accentBg, border: `1px solid ${co.border}`, borderRadius: 8,
      padding: "6px 12px", fontSize: 12,
    }}>
      <span style={{ color: co.text }}>
        Looks like a <strong>{MODE_REGISTRY[mode].label}</strong> beat — apply that library?
      </span>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
        <button style={sBtn} onClick={onApply}>Apply</button>
        <button
          style={{ ...sBtnSm, background: "transparent", border: "none", fontSize: 14, padding: "0 4px" }}
          onClick={onDismiss}
          aria-label="Dismiss suggestion"
        >
          ×
        </button>
      </div>
    </div>
  );
}
```

- [x] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: exit 0 (no errors). This file isn't wired up yet, but TS should still typecheck it cleanly.

---

### Task 3: Wire detection into WritingRoom

**Files:**
- Modify: `src/components/WritingRoom.tsx`

- [x] **Step 1: Add imports**

After the existing line:
```ts
import { getVisibleModes, filterModesByQuery } from "@/lib/modes/slash-menu";
```
add:
```ts
import { LIBRARY_MODES, classifyBeat } from "@/lib/modes/classify";
import BeatDetectionChip from "@/components/BeatDetectionChip";
```

- [x] **Step 2: Compute `detectedMode` and dismissal state**

Find:
```ts
  const visibleModes = useMemo(() => getVisibleModes(project.format), [project.format]);
  const slashQuery = prompt.startsWith("/") ? prompt.slice(1) : null;
  const filteredModes = slashQuery !== null ? filterModesByQuery(slashQuery, visibleModes) : [];

  const handleSelect = (m: GenerationMode) => {
    setPrompt("");
    onSelectMode(m);
  };
```

Replace with:
```ts
  const visibleModes = useMemo(() => getVisibleModes(project.format), [project.format]);
  const slashQuery = prompt.startsWith("/") ? prompt.slice(1) : null;
  const filteredModes = slashQuery !== null ? filterModesByQuery(slashQuery, visibleModes) : [];

  const libraryCandidates = useMemo(() => LIBRARY_MODES.filter(m => visibleModes.includes(m)), [visibleModes]);
  const [dismissedDetection, setDismissedDetection] = useState<GenerationMode | null>(null);
  const detectedMode = useMemo(
    () => (stage === "draft" && slashQuery === null ? classifyBeat(prompt, libraryCandidates) : null),
    [stage, slashQuery, prompt, libraryCandidates]
  );

  useEffect(() => {
    if (!prompt.trim()) setDismissedDetection(null);
  }, [prompt]);

  const handleSelect = (m: GenerationMode) => {
    setPrompt("");
    onSelectMode(m);
  };
```

Note: `stage` is computed above this point in the file (via `currentStage(...)`) — confirm it's in scope (it is; `stage` is defined before `visibleModes`).

- [x] **Step 3: Render the chip above the prompt input**

Find:
```tsx
      {/* Footer */}
      <div style={{ flexShrink: 0, borderTop: `1px solid ${co.border}`, padding: "10px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ position: "relative" }}>
          {slashQuery !== null && <SlashMenu modes={filteredModes} onSelect={handleSelect} />}
```

Replace with:
```tsx
      {/* Footer */}
      <div style={{ flexShrink: 0, borderTop: `1px solid ${co.border}`, padding: "10px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {detectedMode && detectedMode !== dismissedDetection && (
          <BeatDetectionChip
            mode={detectedMode}
            onApply={() => onSelectMode(detectedMode)}
            onDismiss={() => setDismissedDetection(detectedMode)}
          />
        )}
        <div style={{ position: "relative" }}>
          {slashQuery !== null && <SlashMenu modes={filteredModes} onSelect={handleSelect} />}
```

- [x] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

---

### Task 4: Final verification

- [x] **Step 1: Run the full relevant test suite**

Run: `npx vitest run src/lib/modes/__tests__ src/lib/guide/__tests__ src/lib/ai/__tests__`
Expected: all files pass, including the new `classify.test.ts` (6 new tests on top of the existing 73).

- [x] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

---

## Notes / Deferred

- **"Delete the 26 mode panel files"** (from the original Phase 5 framing) is **not** part of this plan. Research during Phase 5 scoping found that `src/components/panels/toolbar/modes/` contains 26 files, but 24 of them (WritePanel + the 23 library-mode panels) are the live content of the Writing Room's "Actions" drawer (opened via the Slash menu's `onSelectMode`) — they provide the archetype-picker UI (Combat Style A/B, Horror Archetype, Emotion, etc.) that the `generate*` functions depend on for output quality. Deleting them would require first rebuilding 23 archetype-picker UIs inline, which is a separate, much larger project. Only `ComicStudioPanel.tsx` and `ProductionStudioPanel.tsx` (in that same directory) are confirmed dead code — left alone here since removing them has no UI impact and is unrelated to beat detection.
- This plan implements the auto-detection half of Phase 5 ("Beat classification → automatic library accent + chip") using the `keywords` field added in Phase 0, fulfilling the most concretely-specified and lowest-risk part of the original Phase 5 description.
- Detection only runs in the `draft` stage, since that's where the prompt text represents "what happens next" narrative beats. Other stages' prompt fields serve different purposes (premise brainstorming, outline beats, etc.) where library-mode suggestions would be noise.
