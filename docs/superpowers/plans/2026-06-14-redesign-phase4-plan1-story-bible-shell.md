> **STATUS: COMPLETE** (2026-06-14) — `src/components/StoryBible.tsx` created; wired into `src/components/GhostWriterApp.tsx` (dynamic import, `storyBibleOpen` state, `onOpenBible` → opens overlay, "Advanced settings →" expands legacy WorldBiblePanel rail). `npx tsc --noEmit` exit 0; `npx vitest run src/lib/modes/__tests__ src/lib/guide/__tests__` 4 files / 41 tests passed.

# Phase 4 Plan 1: Story Bible Shell (Cast/World/Threads) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement §2.3 of `ghostwriter-redesign.md` — replace WorldBiblePanel as the primary entity-management surface with a new full-screen "Story Bible" overlay with three tabs (Cast/World/Threads, max 3 per spec), where every character/location/plot-thread is a card showing the 5 fields that matter, with a "More details" expansion for the rest.

**Architecture:** New component `src/components/StoryBible.tsx` renders `project.characters`/`project.locations`/`project.plotThreads` as cards, using the SAME REST CRUD endpoints WorldBiblePanel already calls (`/api/projects/{id}/characters|locations|plot-threads[/:id]`, POST/PATCH/DELETE). It is wired into `GhostWriterApp.tsx` as a full-screen overlay (`position: fixed; inset: 0`) opened via `onOpenBible` on the writing-room-enabled path. An "Advanced settings →" button inside Story Bible closes the overlay and expands the existing `WorldBiblePanel` rail (`setLeftCollapsed(false)`) for relationship maps, voice fingerprint, series/universe linking, AI generate/improve, Soul ID, trend intelligence, etc. — **nothing in WorldBiblePanel is removed or modified**; it remains the "everything" view, reachable but no longer the default.

**Field mapping (per spec: "5 fields that matter ... visible; the other ~7-8 ... live behind 'More details'"):**
- **Cast** (characters, 13 fields total via `CharFields`): visible = name, `desires`→"Want", `arc`→"Need", `fears`→"Contradiction", `speechPattern`→"Voice note" (5). Behind "More details" (8): role, age, appearance, personality, thinkingStyle, behavior, habits, backstory.
- **World** (locations, 5 fields total via `LocFields`): visible = name, description, atmosphere, history, sensoryDetails (5). No "More details" needed.
- **Threads** (plot threads, 5 fields incl. status): visible = name, status (select: Active/Simmering/Resolved), description, stakes, connections (5). No "More details" needed.

**Tech Stack:** Next.js 16 / React / TypeScript. No DB schema changes, no new API routes.

---

### Task 1: Create the `StoryBible` component

**Files:**
- Create: `src/components/StoryBible.tsx`

- [ ] **Step 1: Write the file**

```tsx
"use client";
import { useState, useEffect } from "react";
import { co, sBtn, sBtnSm, sInput, sTextarea } from "@/lib/styles";
import { DEFAULT_CHAR, DEFAULT_LOC, DEFAULT_PLOT } from "@/lib/formats";
import { EmptyState } from "@/components/EmptyState";

const entityApiPath: Record<string, string> = {
  characters: "characters",
  locations: "locations",
  plotThreads: "plot-threads",
};

const CAST_VISIBLE: [string, string][] = [
  ["desires", "Want"],
  ["arc", "Need"],
  ["fears", "Contradiction"],
  ["speechPattern", "Voice note"],
];
const CAST_MORE: [string, string, string][] = [
  ["role", "Role", "input"],
  ["age", "Age", "input"],
  ["appearance", "Appearance", "textarea"],
  ["personality", "Personality", "textarea"],
  ["thinkingStyle", "Thinking style", "textarea"],
  ["behavior", "Behavior patterns", "textarea"],
  ["habits", "Habits & quirks", "textarea"],
  ["backstory", "Backstory", "textarea"],
];
const WORLD_VISIBLE: [string, string][] = [
  ["description", "Description"],
  ["atmosphere", "Atmosphere"],
  ["history", "History"],
  ["sensoryDetails", "Sensory details"],
];
const THREADS_VISIBLE: [string, string][] = [
  ["description", "Description"],
  ["stakes", "Stakes"],
  ["connections", "Connections"],
];

interface EntityCardProps {
  item: any;
  visibleFields: [string, string][];
  moreFields: [string, string, string][];
  hasStatus?: boolean;
  onSave: (draft: any) => Promise<void>;
  onDelete: () => void;
}

function EntityCard({ item, visibleFields, moreFields, hasStatus, onSave, onDelete }: EntityCardProps) {
  const [draft, setDraft] = useState<any>(item);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(item); }, [item]);

  const set = (field: string, value: string) => setDraft((d: any) => ({ ...d, [field]: value }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(item);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(draft); } finally { setSaving(false); }
  };

  const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 2 };

  return (
    <div style={{ border: `1px solid ${co.border}`, borderRadius: 10, background: co.surface, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={draft.name ?? ""} onChange={e => set("name", e.target.value)} placeholder="Name" style={{ ...sInput, fontWeight: 700, flex: 1 }} />
        {hasStatus && (
          <select value={draft.status ?? "Active"} onChange={e => set("status", e.target.value)} style={{ ...sInput, width: 110, flexShrink: 0 }}>
            <option>Active</option>
            <option>Simmering</option>
            <option>Resolved</option>
          </select>
        )}
        <button style={{ background: "none", border: "none", color: co.danger, cursor: "pointer", fontSize: 16, padding: "0 4px" }} onClick={onDelete} aria-label="Delete">×</button>
      </div>
      {visibleFields.map(([field, label]) => (
        <div key={field}>
          <span style={labelStyle}>{label}</span>
          <textarea value={draft[field] ?? ""} onChange={e => set(field, e.target.value)} style={{ ...sTextarea, minHeight: 50, fontSize: 12 }} />
        </div>
      ))}
      {moreFields.length > 0 && (
        <button style={{ ...sBtnSm, alignSelf: "flex-start" }} onClick={() => setExpanded(e => !e)}>
          {expanded ? "Less ▴" : "More details ▾"}
        </button>
      )}
      {expanded && moreFields.map(([field, label, type]) => (
        <div key={field}>
          <span style={labelStyle}>{label}</span>
          {type === "input"
            ? <input value={draft[field] ?? ""} onChange={e => set(field, e.target.value)} style={{ ...sInput, fontSize: 12 }} />
            : <textarea value={draft[field] ?? ""} onChange={e => set(field, e.target.value)} style={{ ...sTextarea, minHeight: 50, fontSize: 12 }} />}
        </div>
      ))}
      {dirty && (
        <button style={{ ...sBtn, alignSelf: "flex-start", opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save"}
        </button>
      )}
    </div>
  );
}

interface StoryBibleProps {
  project: any;
  updateProject: (fn: (p: any) => any) => void;
  open: boolean;
  onClose: () => void;
  onOpenAdvanced: () => void;
  setConfirmModal: (v: any) => void;
}

export default function StoryBible({ project, updateProject, open, onClose, onOpenAdvanced, setConfirmModal }: StoryBibleProps) {
  const [tab, setTab] = useState<"cast" | "world" | "threads">("cast");

  if (!open) return null;

  const key = tab === "cast" ? "characters" : tab === "world" ? "locations" : "plotThreads";
  const items: any[] = project[key] || [];
  const visibleFields = tab === "cast" ? CAST_VISIBLE : tab === "world" ? WORLD_VISIBLE : THREADS_VISIBLE;
  const moreFields = tab === "cast" ? CAST_MORE : [];
  const tabLabel = tab === "cast" ? "character" : tab === "world" ? "location" : "thread";
  const emptyIcon = tab === "cast" ? "👤" : tab === "world" ? "🗺️" : "🧵";
  const emptyTitle = tab === "cast" ? "No characters yet" : tab === "world" ? "No locations yet" : "No plot threads yet";

  const handleAdd = async () => {
    const defaults = tab === "cast" ? { ...DEFAULT_CHAR, name: "New character" }
      : tab === "world" ? { ...DEFAULT_LOC, name: "New location" }
      : { ...DEFAULT_PLOT, name: "New thread" };
    const res = await fetch(`/api/projects/${project.id}/${entityApiPath[key]}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(defaults) });
    const created = await res.json();
    updateProject((p: any) => ({ ...p, [key]: [...(p[key] || []), created] }));
  };

  const handleSave = async (id: string, draft: any) => {
    const res = await fetch(`/api/projects/${project.id}/${entityApiPath[key]}/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    const updated = await res.json();
    updateProject((p: any) => ({ ...p, [key]: p[key].map((x: any) => x.id === id ? updated : x) }));
  };

  const handleDelete = (item: any) => {
    setConfirmModal({
      msg: `Delete ${item.name}?`,
      action: async () => {
        await fetch(`/api/projects/${project.id}/${entityApiPath[key]}/${item.id}`, { method: "DELETE" });
        updateProject((p: any) => ({ ...p, [key]: p[key].filter((x: any) => x.id !== item.id) }));
        setConfirmModal(null);
      },
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1300, background: co.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ flexShrink: 0, borderBottom: `1px solid ${co.border}`, padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: co.text }}>Story Bible</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={sBtnSm} onClick={onOpenAdvanced}>Advanced settings →</button>
          <button style={sBtnSm} onClick={onClose}>Close ×</button>
        </div>
      </div>
      <div style={{ flexShrink: 0, display: "flex", gap: 4, padding: "10px 24px", borderBottom: `1px solid ${co.border}` }}>
        {([
          ["cast", `Cast (${(project.characters || []).length})`],
          ["world", `World (${(project.locations || []).length})`],
          ["threads", `Threads (${(project.plotThreads || []).length})`],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
            background: tab === t ? co.accentBg : "transparent", color: tab === t ? co.accent : co.muted,
          }}>{label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
          <button style={sBtn} onClick={handleAdd}>+ Add {tabLabel}</button>
        </div>
        {items.length === 0 ? (
          <EmptyState icon={emptyIcon} title={emptyTitle} description={`Add your first ${tabLabel} to start building your Story Bible.`} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {items.map((item: any) => (
              <EntityCard
                key={item.id}
                item={item}
                visibleFields={visibleFields}
                moreFields={moreFields}
                hasStatus={tab === "threads"}
                onSave={draft => handleSave(item.id, draft)}
                onDelete={() => handleDelete(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0, no new errors from `src/components/StoryBible.tsx`.

---

### Task 2: Wire Story Bible into GhostWriterApp

**Files:**
- Modify: `src/components/GhostWriterApp.tsx`

- [ ] **Step 1: Import the component**

Add near the other top-level imports (after line 17, `import WritingRoom from "@/components/WritingRoom";`):

```tsx
import StoryBible from "@/components/StoryBible";
```

- [ ] **Step 2: Add open/close state**

Add next to `leftCollapsed` (line 37):

```tsx
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [storyBibleOpen, setStoryBibleOpen] = useState(false);
```

- [ ] **Step 3: Point `onOpenBible` at the new overlay (writing-room path only)**

In the `writingRoomEnabled` branch's `<WritingRoom .../>` call (around line 504), change:

```tsx
            onOpenBible={() => setLeftCollapsed(false)}
```

to:

```tsx
            onOpenBible={() => setStoryBibleOpen(true)}
```

- [ ] **Step 4: Render the overlay**

Immediately after the `{writingRoomEnabled ? ( ... ) : ( ... )}` block closes (after line 575, before `{showStoryHealth && (...)}`), add:

```tsx
      {writingRoomEnabled && (
        <StoryBible
          project={project}
          updateProject={projectState.updateProject}
          open={storyBibleOpen}
          onClose={() => setStoryBibleOpen(false)}
          onOpenAdvanced={() => { setStoryBibleOpen(false); setLeftCollapsed(false); }}
          setConfirmModal={setConfirmModal}
        />
      )}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

---

### Task 3: Final verification

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 2: Regression test suite**

Run: `npx vitest run src/lib/modes/__tests__ src/lib/guide/__tests__`
Expected: same pass count as before (4 files / 41 tests) — Story Bible adds no new test files, but must not break existing ones.

- [ ] **Step 3: Update plan status + memory**

Mark this plan doc `> **STATUS: COMPLETE**` at the top with the date and verification results. Update `project-ghostwriter.md` and `MEMORY.md` to record Phase 4 Plan 1 done, Phase 4 Plan 2 (auto-extraction) next.

---

## Notes for Plan 2 (not in this plan)

Phase 4 Plan 2 will add **auto-extraction**: after each generation/summarize, call `/api/ai/entity` (`generateEntity` with `type: "character" | "location" | "plotThread"` and `existing` set to the matched bible entry) to propose updates, surfaced as a small "N updates suggested" chip in Story Bible (or the Guide bar) — user accepts/rejects. `generateEntity` and `/api/ai/entity` already exist (`src/lib/ai/engine.ts:391`, `src/app/api/ai/entity/route.ts`) and need no changes for the "improve" call shape; Plan 2 adds the trigger (post-generation/post-summarize), the matching logic (name-based lookup against `project.characters/locations/plotThreads`), and the suggestion-chip UI with accept/reject wired to the same PATCH endpoints used in Task 1.
