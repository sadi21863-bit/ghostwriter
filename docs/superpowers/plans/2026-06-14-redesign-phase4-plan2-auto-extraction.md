> **STATUS: COMPLETE** (2026-06-14) — `src/lib/ai/entity-extraction.ts` (matchEntities/diffEntity) + `src/lib/ai/__tests__/entity-extraction.test.ts` (8 tests); `src/hooks/useAIActions.ts` gained `runEntityExtraction`/`acceptEntitySuggestion`/`rejectEntitySuggestion`/`entitySuggestions`, triggered after write-mode generation when `writingRoomEnabled`; new `src/components/EntitySuggestionsChip.tsx` rendered in `GhostWriterApp.tsx`. `npx tsc --noEmit` exit 0; `npx vitest run src/lib/ai/__tests__ src/lib/modes/__tests__ src/lib/guide/__tests__` → 8 files / 73 tests passed.

# Phase 4 Plan 2: Auto-Extraction (Suggested Updates Chip) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the auto-extraction half of §2.3 of `ghostwriter-redesign.md` — after a "write" generation, detect which Story Bible entities (characters/locations/plot threads) appear in the new text, ask the AI to propose an updated version of each, diff against the current entry, and surface non-trivial diffs as a small "N updates suggested" chip the user can accept or dismiss per-entity.

**Architecture:** New pure module `src/lib/ai/entity-extraction.ts` provides name-matching (`matchEntities`) and field-diffing (`diffEntity`) — both unit-testable with no API calls. `useAIActions.ts` gains `runEntityExtraction()`, called fire-and-forget after a successful `mode === "write"` generation (mirroring the existing `runQualityCheck` precedent), which matches entities, calls the existing `/api/ai/entity` "improve" endpoint per match, diffs the result, and appends non-empty diffs to a new `entitySuggestions` state array. New component `src/components/EntitySuggestionsChip.tsx` renders a small floating chip when suggestions exist; clicking it expands a panel listing each suggestion's changed fields with per-entity Accept/Dismiss, wired to the existing entity PATCH endpoints. The whole feature is gated behind `writingRoomEnabled` (cost containment — no extra LLM calls for users outside the redesign cohort).

**Tech Stack:** Next.js 16 / React / TypeScript / Vitest. No DB schema changes, no new API routes — reuses `/api/ai/entity` (`generateEntity` "improve" path) and the existing `/api/projects/{id}/characters|locations|plot-threads/:id` PATCH endpoints.

---

### Task 1: Entity-extraction pure logic module + tests

**Files:**
- Create: `src/lib/ai/entity-extraction.ts`
- Test: `src/lib/ai/__tests__/entity-extraction.test.ts`

- [ ] **Step 1: Write the module**

```ts
export type EntityKey = "characters" | "locations" | "plotThreads";

export const ENTITY_API_PATH: Record<EntityKey, string> = {
  characters: "characters",
  locations: "locations",
  plotThreads: "plot-threads",
};

export const ENTITY_TYPE: Record<EntityKey, string> = {
  characters: "character",
  locations: "location",
  plotThreads: "plotThread",
};

export interface EntityChange {
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
}

export interface EntitySuggestion {
  type: EntityKey;
  entity: any;
  changes: EntityChange[];
}

export const DIFF_FIELDS: Record<EntityKey, { field: string; label: string }[]> = {
  characters: [
    ["desires", "Want"], ["arc", "Need"], ["fears", "Contradiction"], ["speechPattern", "Voice note"],
    ["role", "Role"], ["age", "Age"], ["appearance", "Appearance"], ["personality", "Personality"],
    ["thinkingStyle", "Thinking style"], ["behavior", "Behavior patterns"], ["habits", "Habits & quirks"],
    ["backstory", "Backstory"],
  ].map(([field, label]) => ({ field, label })),
  locations: [
    ["description", "Description"], ["atmosphere", "Atmosphere"], ["history", "History"], ["sensoryDetails", "Sensory details"],
  ].map(([field, label]) => ({ field, label })),
  plotThreads: [
    ["description", "Description"], ["stakes", "Stakes"], ["connections", "Connections"], ["status", "Status"],
  ].map(([field, label]) => ({ field, label })),
};

const ENTITY_KEYS: EntityKey[] = ["characters", "locations", "plotThreads"];

/**
 * Finds Story Bible entities whose name appears (case-insensitively, whole-word)
 * in the generated text. Prioritizes characters > locations > plot threads,
 * preserving each list's existing order, and caps total matches.
 */
export function matchEntities(text: string, project: any, maxMatches = 3): { type: EntityKey; entity: any }[] {
  const lower = text.toLowerCase();
  const matches: { type: EntityKey; entity: any }[] = [];
  for (const type of ENTITY_KEYS) {
    const items: any[] = project?.[type] || [];
    for (const entity of items) {
      const name = (entity?.name || "").trim();
      if (name.length < 2) continue;
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`, "i");
      if (re.test(lower) || re.test(text)) {
        matches.push({ type, entity });
        if (matches.length >= maxMatches) return matches;
      }
    }
  }
  return matches;
}

/**
 * Compares an "improved" entity proposal against the existing entity, returning
 * only fields where the proposal is non-empty and differs from the current value.
 */
export function diffEntity(type: EntityKey, existing: any, proposed: any): EntityChange[] {
  if (!proposed || typeof proposed !== "object") return [];
  const changes: EntityChange[] = [];
  for (const { field, label } of DIFF_FIELDS[type]) {
    const oldValue = String(existing?.[field] ?? "").trim();
    const newValue = String(proposed?.[field] ?? "").trim();
    if (!newValue) continue;
    if (newValue === oldValue) continue;
    changes.push({ field, label, oldValue, newValue });
  }
  return changes;
}
```

- [ ] **Step 2: Write the tests**

```ts
import { describe, it, expect } from "vitest";
import { matchEntities, diffEntity } from "../entity-extraction";

describe("matchEntities", () => {
  const project = {
    characters: [{ id: "c1", name: "Ava" }, { id: "c2", name: "Lin Mercer" }],
    locations: [{ id: "l1", name: "The Hollow" }],
    plotThreads: [{ id: "p1", name: "Stolen Ledger" }],
  };

  it("matches a character name appearing in the text", () => {
    const result = matchEntities("Ava walked into the room.", project);
    expect(result).toEqual([{ type: "characters", entity: project.characters[0] }]);
  });

  it("is case-insensitive and matches whole words only", () => {
    const result = matchEntities("ava nodded, but Avalanche was unrelated.", project);
    expect(result).toHaveLength(1);
    expect(result[0].entity.name).toBe("Ava");
  });

  it("prioritizes characters over locations over plot threads, in array order, up to maxMatches", () => {
    const text = "Ava and Lin Mercer stood at The Hollow, thinking about the Stolen Ledger.";
    const result = matchEntities(text, project, 3);
    expect(result.map(r => r.entity.name)).toEqual(["Ava", "Lin Mercer", "The Hollow"]);
  });

  it("skips entities with names shorter than 2 characters", () => {
    const p = { characters: [{ id: "c1", name: "A" }], locations: [], plotThreads: [] };
    expect(matchEntities("A is here.", p)).toEqual([]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(matchEntities("Nothing relevant happens here.", project)).toEqual([]);
  });
});

describe("diffEntity", () => {
  it("returns changed fields where the proposal differs and is non-empty", () => {
    const existing = { name: "Ava", desires: "Find her sister", arc: "", fears: "Heights" };
    const proposed = { name: "Ava", desires: "Find her sister and clear her name", arc: "Learns to trust again", fears: "Heights" };
    const changes = diffEntity("characters", existing, proposed);
    expect(changes).toEqual([
      { field: "desires", label: "Want", oldValue: "Find her sister", newValue: "Find her sister and clear her name" },
      { field: "arc", label: "Need", oldValue: "", newValue: "Learns to trust again" },
    ]);
  });

  it("ignores empty proposal values and unchanged values", () => {
    const existing = { description: "A quiet harbor town.", stakes: "" };
    const proposed = { description: "A quiet harbor town.", stakes: "" };
    expect(diffEntity("locations", existing, proposed)).toEqual([]);
  });

  it("returns an empty array for a non-object proposal", () => {
    expect(diffEntity("plotThreads", { description: "x" }, {})).toEqual([]);
    expect(diffEntity("plotThreads", { description: "x" }, null)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the new tests**

Run: `npx vitest run src/lib/ai/__tests__/entity-extraction.test.ts`
Expected: PASS, 8 tests (3 describe-level groups, 5+3 cases).

---

### Task 2: Wire extraction trigger + suggestion state into `useAIActions`

**Files:**
- Modify: `src/hooks/useAIActions.ts`

- [ ] **Step 1: Import the new module**

Add near the top imports (after line 10, `import { parseBeatList } from "@/lib/modes/beats";`):

```ts
import { matchEntities, diffEntity, ENTITY_API_PATH, ENTITY_TYPE, type EntitySuggestion } from "@/lib/ai/entity-extraction";
```

- [ ] **Step 2: Accept a `writingRoomEnabled` flag**

In the destructured params (around line 23-39), add `writingRoomEnabled` to both the destructure and the type:

```ts
export function useAIActions({
  project, mode, prompt, activeChap,
  updateChapter, updateProject, setErrorMsg, setSavedMsg,
  creatorBible, cohostVoice, setUpgradeRequired,
  activeInfluence, activePatterns, writingRoomEnabled,
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
  writingRoomEnabled?: boolean;
}) {
```

- [ ] **Step 3: Add `entitySuggestions` state**

Add next to the other state declarations (after line 59, `const [violationBanner, ...] = useState(...)`):

```ts
  const [entitySuggestions, setEntitySuggestions] = useState<EntitySuggestion[]>([]);
```

- [ ] **Step 4: Add `runEntityExtraction`**

Add this new function immediately after `runQualityCheck` (after the closing `};` on line 261):

```ts
  const runEntityExtraction = async (text: string) => {
    const matches = matchEntities(text, project, 3);
    if (!matches.length) return;
    const context = text.slice(0, 4000);
    for (const { type, entity } of matches) {
      try {
        const res = await fetch("/api/ai/entity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: ENTITY_TYPE[type], existing: entity, projectContext: context }),
        });
        const proposed = await res.json();
        const changes = diffEntity(type, entity, proposed);
        if (changes.length) {
          setEntitySuggestions(s => [...s, { type, entity, changes }]);
        }
      } catch { /* extraction must never break the writing flow */ }
    }
  };
```

- [ ] **Step 5: Add accept/reject handlers**

Add immediately after `runEntityExtraction`:

```ts
  const acceptEntitySuggestion = async (suggestion: EntitySuggestion) => {
    const patch: Record<string, string> = {};
    suggestion.changes.forEach(c => { patch[c.field] = c.newValue; });
    const res = await fetch(`/api/projects/${project.id}/${ENTITY_API_PATH[suggestion.type]}/${suggestion.entity.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    const updated = await res.json();
    updateProject?.((p: any) => ({ ...p, [suggestion.type]: p[suggestion.type].map((x: any) => x.id === updated.id ? updated : x) }));
    setEntitySuggestions(s => s.filter(x => x !== suggestion));
  };

  const rejectEntitySuggestion = (suggestion: EntitySuggestion) => {
    setEntitySuggestions(s => s.filter(x => x !== suggestion));
  };
```

- [ ] **Step 6: Call `runEntityExtraction` after a successful write generation**

In `generate()`, the block at lines 184-186 currently reads:

```ts
        if (MODE_REGISTRY[mode as GenerationMode]?.qualityCheck && (project as any).qualityGradingEnabled) {
          runQualityCheck(r.text, project.id);
        }
```

Change it to:

```ts
        if (MODE_REGISTRY[mode as GenerationMode]?.qualityCheck && (project as any).qualityGradingEnabled) {
          runQualityCheck(r.text, project.id);
        }
        if (mode === "write" && writingRoomEnabled) {
          runEntityExtraction(r.text);
        }
```

- [ ] **Step 7: Export the new state and handlers**

Find the hook's return statement (it returns an object containing `qualityReview, setQualityReview, generate, ...`). Add `entitySuggestions, acceptEntitySuggestion, rejectEntitySuggestion,` to that returned object (alongside `qualityReview, setQualityReview`).

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

---

### Task 3: Suggested-updates chip component

**Files:**
- Create: `src/components/EntitySuggestionsChip.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";
import { useState } from "react";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import type { EntitySuggestion } from "@/lib/ai/entity-extraction";

interface EntitySuggestionsChipProps {
  suggestions: EntitySuggestion[];
  onAccept: (s: EntitySuggestion) => void;
  onReject: (s: EntitySuggestion) => void;
}

export default function EntitySuggestionsChip({ suggestions, onAccept, onReject }: EntitySuggestionsChipProps) {
  const [open, setOpen] = useState(false);

  if (!suggestions.length) return null;

  const typeLabel = (type: EntitySuggestion["type"]) => type === "characters" ? "Character" : type === "locations" ? "Location" : "Plot thread";

  return (
    <div style={{ position: "fixed", bottom: 90, right: 24, zIndex: 1250, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
      {open && (
        <div style={{ width: 340, maxHeight: 420, overflow: "auto", background: co.surface, border: `1px solid ${co.border}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {suggestions.map((s, i) => (
            <div key={i} style={{ border: `1px solid ${co.border}`, borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {typeLabel(s.type)} · {s.entity.name}
              </div>
              {s.changes.map(c => (
                <div key={c.field} style={{ fontSize: 12, color: co.text }}>
                  <span style={{ fontWeight: 700 }}>{c.label}: </span>
                  {c.oldValue && <span style={{ color: co.muted, textDecoration: "line-through" }}>{c.oldValue} </span>}
                  <span>{c.newValue}</span>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                <button style={sBtn} onClick={() => onAccept(s)}>Accept</button>
                <button style={sBtnSm} onClick={() => onReject(s)}>Dismiss</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        style={{ ...sBtn, borderRadius: 20, padding: "8px 16px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
        onClick={() => setOpen(o => !o)}
      >
        {suggestions.length} update{suggestions.length === 1 ? "" : "s"} suggested
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

---

### Task 4: Wire chip into `GhostWriterApp`

**Files:**
- Modify: `src/components/GhostWriterApp.tsx`

- [ ] **Step 1: Import the component**

Add near the other top-level imports (after `import StoryBible from "@/components/StoryBible";`):

```tsx
import EntitySuggestionsChip from "@/components/EntitySuggestionsChip";
```

- [ ] **Step 2: Pass `writingRoomEnabled` into `useAIActions`**

In the `useAIActions({...})` call (around line 148-162), add `writingRoomEnabled,` to the object (e.g. after `activePatterns,`).

- [ ] **Step 3: Render the chip**

Immediately after the `<StoryBible ... />` block added in Plan 1 (the `{writingRoomEnabled && (<StoryBible ... />)}` block), add:

```tsx
      {writingRoomEnabled && (
        <EntitySuggestionsChip
          suggestions={aiActions.entitySuggestions}
          onAccept={aiActions.acceptEntitySuggestion}
          onReject={aiActions.rejectEntitySuggestion}
        />
      )}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

---

### Task 5: Final verification

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 2: Full test suite for touched areas**

Run: `npx vitest run src/lib/ai/__tests__ src/lib/modes/__tests__ src/lib/guide/__tests__`
Expected: all pass (new `entity-extraction.test.ts` file + the existing 4 files / 41 tests, no regressions).

- [ ] **Step 3: Update plan status + memory**

Mark this plan doc `> **STATUS: COMPLETE**` at the top with the date and verification results. Update `project-ghostwriter.md` and `MEMORY.md` to record Phase 4 (both plans) done; Phase 5 next.

---

## Notes / Deferred (not in this plan)

- **Trigger scope:** Only `mode === "write"` generations trigger extraction (not `autoSummarize()`). Spec says "after each generation/summarize" — summarize-triggered extraction is a reasonable follow-on if the write-trigger proves too sparse, but is out of scope here to keep LLM cost bounded (extraction is capped at 3 extra Sonnet calls per write-generation, and only when entity names actually appear in the new text).
- **Gating:** The whole feature (trigger + chip) is gated behind `writingRoomEnabled` — consistent with Story Bible (Plan 1) being part of the flagged redesign cohort, and avoids extra AI spend for users outside it.
- **Ephemeral suggestions:** `entitySuggestions` is in-memory hook state, not persisted — if the user navigates away before reviewing, suggestions are lost (same tradeoff as the existing `qualityReview` state).
