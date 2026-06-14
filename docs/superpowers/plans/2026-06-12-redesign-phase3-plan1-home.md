# Redesign Phase 3 Plan 1 of 3: Home Implementation Plan

**Status:** ✅ COMPLETE (2026-06-12) — Tasks 1-6 implemented. `npx tsc --noEmit` exit 0; `npx vitest run src/lib/guide/__tests__ src/lib/modes/__tests__` → 35/35 pass (16 in next-action.test.ts). `npm run build` was not run this session (interrupted) — typecheck + test results stand as verification.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard's "grid of everything" with the redesign spec's §2.1 Home: one Continue card for the most recent project (showing the Guide's current suggestion and deep-linking to the right chapter), one "New story" action (braindump), and a quiet list of other projects — flag-gated behind `homeRedesign` so the existing dashboard is completely unaffected until the flag is enabled.

**Architecture:** A new self-contained `Home.tsx` component (own `useSession`/`/api/projects`/`/api/projects/{id}` data fetching) replaces the dashboard body when `FLAGS.homeRedesign` is on. A new pure helper `getContinueChapterId` in `next-action.ts` picks the deep-link chapter from the Guide's current suggestion (falling back to the first chapter). A new `BraindumpModal.tsx` extracts the existing braindump-to-project flow so Home's "New story" button can launch it without touching the legacy dashboard modal. `useProjectState` learns to honor an optional `?chapter=` query param so the deep link lands on the right chapter.

**Tech Stack:** Next.js App Router (client components), React hooks, GrowthBook (`useFeatureIsOn`), Vitest.

---

## Background

Spec §2.1 (Home):

> - ONE card: the most recent project, with a **Continue writing** button that deep-links to the
>   exact chapter + the Guide's current suggestion. Below it, a quiet list of other projects.
> - One secondary action: **New story** (launches braindump onboarding — already built).
> - NOTHING else. No stats, no panels, no feature tiles.

This is Phase 3 Plan 1 of 3. Phase 3 covers §2.1 (Home), §2.4 (stage views: Idea/Structure/Polish/Export),
and §2.5 (creator variant distribution) — three independent subsystems per the writing-plans Scope Check,
so each gets its own plan. This plan covers Home only.

**Flag-gating pattern (established in Phase 2 Plan 1):** add a new GrowthBook flag (`homeRedesign` /
`home_redesign`, default OFF). `src/app/dashboard/page.tsx` keeps 100% of its current code; the only
change is one early-return: `if (homeRedesign) return <Home />;`, placed AFTER all of the existing
hook declarations (so hook call order never changes between renders — same pattern GhostWriterApp.tsx
uses for `writingRoomEnabled`). When the flag is on, the old dashboard's effects still fire (harmless
extra `/api/projects` etc. calls that produce no UI) — accepted tradeoff, same as Phase 2 Plan 1.

**Guide data for the Continue card:** `/api/projects` (the list endpoint) returns enough for the "quiet
list" (`id, name, format, genres, updatedAt, chapters: {id,title,wordCount,sortOrder}[], characters: {id,name}[]`)
but not `controllingIdea`/`dismissedGuideIds`, which `nextAction()` needs. Rather than widen the list
query (risk: touches every dashboard load), Home does a second fetch — `/api/projects/{mostRecentId}`,
the SAME per-project GET that `GhostWriterApp`/`useProjectState` already rely on — for just the most
recent project, and runs the existing `nextAction()` on it. `nextAction()` already treats a missing
`dismissedGuideIds` as `[]`, so this is safe even if that field comes back `undefined`.

**Deep link:** "Continue writing" navigates to `/project/{id}?chapter={chapterId}`, where `chapterId`
comes from the new `getContinueChapterId()` helper (Guide's suggested chapter, else first chapter by
`sortOrder`). `useProjectState` reads `?chapter=` via `window.location.search` (no `useSearchParams`,
so no Suspense-boundary concerns) and seeds `activeChapter` with it when it matches a real chapter.

**Visual language:** Home reuses the dashboard's existing branding (GW_DARK/GW_GOLD/GW_CREAM/GW_BORDER
hex constants, Cormorant Garamond + Figtree fonts, `.gw-card`/`.gw-gold-btn`/`.gw-hdr-btn` hover classes)
rather than the `co` palette used inside the Writing Room editor — Home is the marketing-ish landing
surface, the Writing Room is the utilitarian editor; keeping their existing distinct looks avoids a
third visual language and avoids touching the editor's styling.

**New project's `BraindumpModal.tsx` is a fresh, self-contained extraction** of the existing
braindump-only flow in `dashboard/page.tsx` (the `creationMode === 'braindump'` branch of the create
modal, `handleProcessBraindump`/`handleCreateFromBraindump`). The old dashboard keeps its own inline
copy untouched — some duplication is intentional and temporary (the old dashboard's days are numbered
once Home is the default, per the spec's phased rollout).

---

### Task 1: Add the `homeRedesign` flag

**Files:**
- Modify: `src/lib/growthbook.ts`

- [ ] **Step 1: Add the flag to `FLAGS`**

In `src/lib/growthbook.ts`, the `FLAGS` const currently ends with:

```ts
export const FLAGS = {
  craftLibrary:        "craft_library",
  constellationView:   "constellation_view",
  draftBranching:      "draft_branching",
  readerMode:          "reader_mode",
  commandPalette:      "command_palette",
  adaptiveOnboarding:  "adaptive_onboarding",
  newDesignTokens:     "new_design_tokens",
  writingRoomShell:    "writing_room_shell",
} as const;
```

Change it to:

```ts
export const FLAGS = {
  craftLibrary:        "craft_library",
  constellationView:   "constellation_view",
  draftBranching:      "draft_branching",
  readerMode:          "reader_mode",
  commandPalette:      "command_palette",
  adaptiveOnboarding:  "adaptive_onboarding",
  newDesignTokens:     "new_design_tokens",
  writingRoomShell:    "writing_room_shell",
  homeRedesign:        "home_redesign",
} as const;
```

- [ ] **Step 2: Verify the project still typechecks**

Run: `npx tsc --noEmit` (from the `ghostwriter` directory)
Expected: exit 0 (this is a pure additive const change, nothing references `homeRedesign` yet).

---

### Task 2: `getContinueChapterId` helper + tests

**Files:**
- Modify: `src/lib/guide/next-action.ts`
- Test: `src/lib/guide/__tests__/next-action.test.ts`

- [ ] **Step 1: Write the failing tests**

Add a new `describe` block at the end of `src/lib/guide/__tests__/next-action.test.ts`. First, update the
import at the top of the file from:

```ts
import { nextAction, currentStage, STAGE_ORDER, type GuideProject } from "../next-action";
```

to:

```ts
import { nextAction, currentStage, getContinueChapterId, STAGE_ORDER, type GuideProject, type GuideChapter } from "../next-action";
```

Then append this new `describe` block after the existing `describe("currentStage", ...)` block (i.e., at
the end of the file):

```ts
describe("getContinueChapterId", () => {
  const chapters: GuideChapter[] = [
    { id: "ch-2", title: "Chapter 2", wordCount: 0, sortOrder: 1 },
    { id: "ch-1", title: "Chapter 1", wordCount: 600, sortOrder: 0 },
  ];

  it("returns the action's chapterId when the Guide's suggestion targets a chapter", () => {
    const action = nextAction({
      controllingIdea: "Premise.",
      characters: [{ id: "char-1" }],
      chapters,
      dismissedGuideIds: [],
    });
    expect(action?.run.chapterId).toBe("ch-2");
    expect(getContinueChapterId(chapters, action)).toBe("ch-2");
  });

  it("falls back to the first chapter by sortOrder when the action has no chapterId", () => {
    const action = nextAction({
      controllingIdea: "",
      characters: [],
      chapters,
      dismissedGuideIds: [],
    });
    expect(action?.run.chapterId).toBeUndefined();
    expect(getContinueChapterId(chapters, action)).toBe("ch-1");
  });

  it("falls back to the first chapter by sortOrder when there is no action", () => {
    expect(getContinueChapterId(chapters, null)).toBe("ch-1");
  });

  it("returns null when there are no chapters and no action chapterId", () => {
    expect(getContinueChapterId([], null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/guide/__tests__/next-action.test.ts`
Expected: FAIL — `getContinueChapterId` is not exported from `../next-action` (TypeScript/module error).

- [ ] **Step 3: Implement `getContinueChapterId`**

Append this exported function to the end of `src/lib/guide/next-action.ts`:

```ts
/**
 * Picks which chapter Home's "Continue writing" button should deep-link to:
 * the Guide's currently suggested chapter if it targets one, otherwise the
 * first chapter by sort order.
 */
export function getContinueChapterId(chapters: GuideChapter[], action: GuideAction | null): string | null {
  if (action?.run.chapterId) return action.run.chapterId;
  const sorted = [...chapters].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted[0]?.id ?? null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/guide/__tests__/next-action.test.ts`
Expected: PASS — 16/16 (12 existing + 4 new).

---

### Task 3: `useProjectState` honors `?chapter=`

**Files:**
- Modify: `src/hooks/useProjectState.ts:45-50`

- [ ] **Step 1: Update the project-load effect**

In `src/hooks/useProjectState.ts`, the project-loading effect currently reads:

```ts
  useEffect(() => {
    fetch("/api/projects/" + projectId)
      .then(r => { if (!r.ok) throw new Error("Failed to load project"); return r.json(); })
      .then(data => setProject({ ...data, activeChapter: data.chapters?.[0]?.id || null }))
      .catch(() => setLoadError("Failed to load project. Please refresh."));
  }, [projectId]);
```

Change it to:

```ts
  useEffect(() => {
    fetch("/api/projects/" + projectId)
      .then(r => { if (!r.ok) throw new Error("Failed to load project"); return r.json(); })
      .then(data => {
        const requestedChapterId = new URLSearchParams(window.location.search).get("chapter");
        const requestedChapter = data.chapters?.find((c: any) => c.id === requestedChapterId);
        setProject({ ...data, activeChapter: requestedChapter?.id || data.chapters?.[0]?.id || null });
      })
      .catch(() => setLoadError("Failed to load project. Please refresh."));
  }, [projectId]);
```

This reads the query string directly (no `useSearchParams`, so no Suspense-boundary requirement for this
client component). If `?chapter=` is absent or doesn't match a real chapter, behavior is unchanged
(falls back to the first chapter, exactly as before).

- [ ] **Step 2: Verify the project still typechecks**

Run: `npx tsc --noEmit` (from the `ghostwriter` directory)
Expected: exit 0.

---

### Task 4: `BraindumpModal.tsx`

**Files:**
- Create: `src/components/BraindumpModal.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/BraindumpModal.tsx` with this content:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface BraindumpResult {
  projectName: string; premise: string; format: string; genres: string[];
  controllingIdea: string; characters: Array<{ name: string; role: string; description: string }>;
  worldFacts: string[]; openConflicts: string[]; suggestedTitle: string;
}

const GW_GOLD = "#c9a84c";
const GW_BORDER = "#ede9df";

const inputS: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "#f5f4f0", border: "1px solid " + GW_BORDER,
  borderRadius: 10, fontSize: 13, color: "#1a1a1a", outline: "none", boxSizing: "border-box",
  fontFamily: "'Figtree', sans-serif",
};

interface BraindumpModalProps {
  onClose: () => void;
}

export default function BraindumpModal({ onClose }: BraindumpModalProps) {
  const router = useRouter();
  const [braindumpText, setBraindumpText] = useState("");
  const [braindumpProcessing, setBraindumpProcessing] = useState(false);
  const [braindumpResult, setBraindumpResult] = useState<BraindumpResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleProcessBraindump = async () => {
    if (braindumpText.trim().length < 50) return;
    setBraindumpProcessing(true);
    setError("");
    try {
      const res = await fetch('/api/ai/braindump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: braindumpText }),
      });
      const data = await res.json();
      if (data.result) setBraindumpResult(data.result);
      else setError(data.error || 'Could not process braindump');
    } catch {
      setError('Processing failed. Please try again.');
    } finally {
      setBraindumpProcessing(false);
    }
  };

  const handleCreateFromBraindump = async () => {
    if (!braindumpResult) return;
    setCreating(true);
    try {
      const projRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: braindumpResult.projectName,
          format: braindumpResult.format,
          genres: braindumpResult.genres,
          storyType: 'linear',
        }),
      });
      if (!projRes.ok) throw new Error('Failed to create project');
      const proj = await projRes.json();

      await fetch(`/api/projects/${proj.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genres: braindumpResult.genres,
          controllingIdea: braindumpResult.controllingIdea,
          notes: braindumpResult.worldFacts.join('\n'),
        }),
      });

      await Promise.all(braindumpResult.characters.map(char =>
        fetch(`/api/projects/${proj.id}/characters`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: char.name,
            role: char.role,
            personality: char.description,
          }),
        })
      ));

      router.push(`/project/${proj.id}`);
    } catch {
      setError('Failed to create project. Please try again.');
      setCreating(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "0 16px" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 18, padding: "28px 28px 24px", width: "100%", maxWidth: 400, boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 600, marginBottom: 8, color: "#1a1a1a" }}>New story</div>

        {!braindumpResult && (
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8, lineHeight: 1.5 }}>
              Write anything you know about your story. Don&apos;t organize it — fragments, character
              names, scenes you imagine, themes, contradictions. The messier the better.
            </div>
            <textarea
              value={braindumpText}
              onChange={e => setBraindumpText(e.target.value)}
              placeholder="e.g. A detective in 1920s Bombay who solves murders but is secretly haunted by his own past crime. Something about monsoon season. The villain might be a woman — no, definitely a woman, charming and ruthless. There's a train. The detective has a bad leg. He drinks too much. A young journalist keeps interfering..."
              rows={8}
              style={{ ...inputS, resize: 'vertical', fontFamily: "'Figtree', sans-serif" }}
            />
            {error && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>{error}</div>}
            <button
              type="button"
              onClick={handleProcessBraindump}
              disabled={braindumpText.trim().length < 50 || braindumpProcessing}
              className="gw-gold-btn"
              style={{ marginTop: 10, width: '100%', padding: '10px', borderRadius: 10,
                       background: GW_GOLD, color: '#0d0d10', border: 'none',
                       cursor: braindumpText.trim().length < 50 ? 'default' : 'pointer',
                       opacity: braindumpText.trim().length < 50 ? 0.5 : 1,
                       fontSize: 13, fontWeight: 700, fontFamily: "'Figtree', sans-serif" }}
            >
              {braindumpProcessing ? 'Organizing your ideas...' : 'Organize into a project →'}
            </button>
            <button type="button" onClick={onClose}
              style={{ marginTop: 8, width: '100%', border: '1px solid ' + GW_BORDER, background: '#fff', color: '#888', fontWeight: 600, padding: '10px 0', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>
              Cancel
            </button>
          </div>
        )}

        {braindumpResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1d9e75' }}>
              ✓ Found your story — review before creating:
            </div>

            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Project name</label>
              <input
                value={braindumpResult.projectName}
                onChange={e => setBraindumpResult({ ...braindumpResult, projectName: e.target.value })}
                style={inputS}
              />
            </div>

            <div style={{ padding: '8px 12px', background: '#f5f4f0', borderRadius: 8,
                          fontSize: 12, color: '#888', lineHeight: 1.5 }}>
              {braindumpResult.premise}
            </div>

            {braindumpResult.characters.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                  Characters found ({braindumpResult.characters.length})
                </div>
                {braindumpResult.characters.map((c, i) => (
                  <div key={i} style={{ fontSize: 12, padding: '6px 10px', color: '#555',
                                        background: '#f5f4f0', borderRadius: 6, marginBottom: 4 }}>
                    <strong>{c.name}</strong> ({c.role}) — {c.description}
                  </div>
                ))}
              </div>
            )}

            {error && <div style={{ fontSize: 12, color: "#ef4444" }}>{error}</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setBraindumpResult(null)}
                style={{ flex: 1, border: '1px solid ' + GW_BORDER, background: '#fff', color: '#888', fontWeight: 600, padding: '10px 0', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}
              >
                ← Edit
              </button>
              <button
                type="button"
                onClick={handleCreateFromBraindump}
                disabled={creating}
                className="gw-gold-btn"
                style={{ flex: 2, background: GW_GOLD, color: '#0d0d10', border: 'none', fontWeight: 700, padding: '10px 0', borderRadius: 10, fontSize: 13, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.6 : 1, fontFamily: "'Figtree', sans-serif" }}
              >
                {creating ? 'Creating…' : 'Create project →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit` (from the `ghostwriter` directory)
Expected: exit 0. (No other file references this component yet — Task 5 wires it up.)

---

### Task 5: `Home.tsx`

**Files:**
- Create: `src/components/Home.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/Home.tsx` with this content:

```tsx
"use client";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import BraindumpModal from "@/components/BraindumpModal";
import { EmptyState } from "@/components/EmptyState";
import { nextAction, getContinueChapterId, type GuideAction, type GuideProject } from "@/lib/guide/next-action";

type ProjectSummary = {
  id: string;
  name: string;
  format: string;
  genres: string[];
  updatedAt: string;
  chapters: { id: string; title: string; wordCount: number; sortOrder: number }[];
  characters: { id: string; name: string }[];
};

const GW_DARK = "#0d0d10";
const GW_GOLD = "#c9a84c";
const GW_CREAM = "#faf9f5";
const GW_BORDER = "#ede9df";

const FORMAT_COLORS: Record<string, string> = {
  "Novel": "#5b4ccc", "Screenplay": "#0ea5e9", "Web Series": "#8b5cf6",
  "YouTube Long-form": "#ef4444", "YouTube Short": "#f97316", "TikTok Script": "#ec4899",
  "TikTok Native": "#fe2c55", "Instagram Reel": "#a855f7", "Podcast Episode": "#10b981",
};

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [guideAction, setGuideAction] = useState<GuideAction | null>(null);
  const [showBraindump, setShowBraindump] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/projects")
      .then(r => r.json())
      .then((data: ProjectSummary[]) => {
        setProjects(data);
        setLoading(false);
        const mostRecent = data[0];
        if (!mostRecent) return;
        fetch(`/api/projects/${mostRecent.id}`)
          .then(r => r.json())
          .then((detail: GuideProject) => setGuideAction(nextAction(detail)))
          .catch(() => {});
      })
      .catch(() => setLoading(false));
  }, [status]);

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: GW_DARK }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Figtree:wght@400;500;600;700&display=swap');`}</style>
        <span style={{ color: GW_GOLD, fontSize: 14, fontFamily: "'Figtree', sans-serif", letterSpacing: 2, textTransform: "uppercase" }}>Loading…</span>
      </div>
    );
  }

  const mostRecent = projects[0];
  const others = projects.slice(1);
  const continueChapterId = mostRecent ? getContinueChapterId(mostRecent.chapters, guideAction) : null;
  const continueHref = mostRecent
    ? `/project/${mostRecent.id}${continueChapterId ? `?chapter=${continueChapterId}` : ""}`
    : "";

  return (
    <div style={{ minHeight: "100vh", background: GW_CREAM, fontFamily: "'Figtree', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Figtree:wght@400;500;600;700&display=swap');
        @keyframes gw-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .gw-card { animation: gw-in 0.3s ease both; transition: box-shadow 0.2s, transform 0.18s; }
        .gw-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.10) !important; transform: translateY(-2px); }
        .gw-gold-btn { transition: background 0.2s, transform 0.15s; }
        .gw-gold-btn:hover:not(:disabled) { background: #b8963e !important; transform: translateY(-1px); }
        .gw-hdr-btn { transition: color 0.15s, background 0.15s; }
        .gw-hdr-btn:hover { background: rgba(255,255,255,0.07) !important; color: #fff !important; }
      `}</style>

      {/* Header */}
      <header style={{ background: GW_DARK, borderBottom: "1px solid #1a1a22", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: GW_GOLD, fontWeight: 600, letterSpacing: 1 }}>
          GhostWriter
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#444", marginRight: 4 }}>
            {session?.user?.name || session?.user?.email}
          </span>
          <a href="/settings" className="gw-hdr-btn"
            style={{ fontSize: 12, color: "#666", background: "transparent", border: "1px solid #1e1e2a", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "'Figtree', sans-serif", textDecoration: "none" }}>
            ⚙ Settings
          </a>
          <button className="gw-hdr-btn" onClick={() => signOut({ callbackUrl: "/login" })}
            style={{ fontSize: 12, color: "#666", background: "transparent", border: "1px solid #1e1e2a", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "'Figtree', sans-serif" }}>
            Sign Out
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "64px 24px" }}>
        {!mostRecent ? (
          <div style={{ padding: "80px 0" }}>
            <EmptyState
              icon="✨"
              title="Your stories live here"
              description="Start a novel, screenplay, YouTube channel, or podcast project."
              action={{ label: "New story", onClick: () => setShowBraindump(true) }}
            />
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, letterSpacing: 3, color: "#aaa", textTransform: "uppercase", marginBottom: 12 }}>Continue</div>
            <div className="gw-card" onClick={() => router.push(continueHref)}
              style={{ background: "#fff", borderRadius: 16, border: "1px solid " + GW_BORDER, padding: "28px 28px", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", marginBottom: 36 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: FORMAT_COLORS[mostRecent.format] ?? "#5b4ccc", background: (FORMAT_COLORS[mostRecent.format] ?? "#5b4ccc") + "18", padding: "2px 8px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 0.8 }}>
                  {mostRecent.format}
                </span>
              </div>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, color: "#1a1a1a", fontWeight: 600, margin: "0 0 12px" }}>
                {mostRecent.name}
              </h1>
              {guideAction && (
                <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, margin: "0 0 20px" }}>
                  {guideAction.message}
                </p>
              )}
              <button className="gw-gold-btn" style={{ background: GW_GOLD, color: "#0d0d10", border: "none", borderRadius: 10, padding: "12px 26px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Figtree', sans-serif", letterSpacing: 0.3 }}>
                {guideAction?.cta ? `${guideAction.cta} →` : "Continue writing →"}
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}>
              <button className="gw-gold-btn" onClick={() => setShowBraindump(true)}
                style={{ background: "transparent", color: "#888", border: "1px solid " + GW_BORDER, borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Figtree', sans-serif" }}>
                + New story
              </button>
            </div>

            {others.length > 0 && (
              <>
                <div style={{ fontSize: 11, letterSpacing: 3, color: "#aaa", textTransform: "uppercase", marginBottom: 12 }}>Other projects</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {others.map(p => (
                    <div key={p.id} className="gw-card" onClick={() => router.push(`/project/${p.id}`)}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "#fff", borderRadius: 10, border: "1px solid " + GW_BORDER, cursor: "pointer" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{p.name}</span>
                      <span style={{ fontSize: 11, color: "#aaa" }}>{p.format}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {showBraindump && <BraindumpModal onClose={() => setShowBraindump(false)} />}
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit` (from the `ghostwriter` directory)
Expected: exit 0. (Not yet referenced anywhere — Task 6 wires it up.)

---

### Task 6: Gate `dashboard/page.tsx` behind the flag

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Add imports**

In `src/app/dashboard/page.tsx`, the import block currently starts:

```tsx
"use client";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Onboarding from "@/components/Onboarding";
import { EmptyState } from "@/components/EmptyState";
import { FORMATS } from "@/lib/formats";
```

Add three imports so it becomes:

```tsx
"use client";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useFeatureIsOn } from "@growthbook/growthbook-react";
import Onboarding from "@/components/Onboarding";
import { EmptyState } from "@/components/EmptyState";
import { FORMATS } from "@/lib/formats";
import { FLAGS } from "@/lib/growthbook";
import Home from "@/components/Home";
```

- [ ] **Step 2: Read the flag and branch before the loading-state return**

Inside `export default function Dashboard() {`, add the flag read as the first line of the function body:

```tsx
export default function Dashboard() {
  const homeRedesign = useFeatureIsOn(FLAGS.homeRedesign);
  const { data: session, status } = useSession();
```

Then, immediately before the existing loading-state early return:

```tsx
  if (status === "loading" || (status === "authenticated" && loading)) {
```

insert a new early return:

```tsx
  if (homeRedesign) return <Home />;

  if (status === "loading" || (status === "authenticated" && loading)) {
```

This places the new branch AFTER every hook declaration in the component (all the `useState`/`useEffect`
calls and `filteredProjects` are above this point), so the hook call order is identical on every render
regardless of `homeRedesign`'s value — the same safe pattern `GhostWriterApp.tsx` uses for
`writingRoomEnabled`. Nothing else in the file changes: when the flag is off (the default), the rest of
the component renders exactly as it did before.

- [ ] **Step 3: Verify it typechecks**

Run: `npx tsc --noEmit` (from the `ghostwriter` directory)
Expected: exit 0.

---

## Final Verification

- [ ] **Run the full typecheck**

Run: `npx tsc --noEmit` (from the `ghostwriter` directory)
Expected: exit 0.

- [ ] **Run the relevant vitest suites**

Run: `npx vitest run src/lib/guide/__tests__ src/lib/modes/__tests__`
Expected: PASS — 16 (next-action) + 9 (slash-menu) + 10 (registry) = 35/35.

- [ ] **Run the production build**

Run: `npm run build` (from the `ghostwriter` directory)
Expected: exit 0, all routes (including `/dashboard` and `/project/[projectId]`) build successfully.

---

## Self-Review Notes

- **No commit steps** in this plan, per the standing no-auto-commit policy — all changes remain
  uncommitted in the working tree for user review.
- **Spec coverage:** "ONE card: the most recent project, with a Continue writing button that
  deep-links to the exact chapter + the Guide's current suggestion" → Continue card + `getContinueChapterId`
  + `?chapter=` deep link (Tasks 2, 3, 5). "Below it, a quiet list of other projects" → "Other projects"
  list (Task 5). "One secondary action: New story (launches braindump onboarding)" → `BraindumpModal`
  (Task 4) + "+ New story" button (Task 5). "NOTHING else" → Home renders only the continue card, the
  New story button, and the quiet list — no stats/panels/feature tiles.
- **Flag-off path is byte-for-byte unchanged**: Task 6 adds 3 imports + 2 lines (flag read + early
  return) to `dashboard/page.tsx`; every existing line is untouched. When `homeRedesign` is off (the
  default), `Dashboard` renders exactly as it did before this plan.
- **Accepted tradeoff:** when `homeRedesign` is on, the old `Dashboard` component's hooks/effects
  (its own `/api/projects`, `/api/series-bibles`, `/api/universes`, `/api/subscription` fetches, the
  onboarding-seen check, etc.) still run because they're declared before the new early return — same
  precedent as Phase 2 Plan 1 keeping the old `GhostWriterApp` layout's hooks live behind its flag.
  These extra calls produce no UI and don't affect correctness; they're a minor, temporary
  inefficiency that goes away once Home becomes the default and the old dashboard body is deleted.
- **Type consistency:** `getContinueChapterId(chapters: GuideChapter[], action: GuideAction | null)`
  is defined in Task 2 and called identically in Task 5 (`getContinueChapterId(mostRecent.chapters, guideAction)`).
  `mostRecent.chapters` (`{id,title,wordCount,sortOrder}[]`) and `/api/projects/{id}`'s response (used as
  `GuideProject` in Task 5) are structural supersets of `GuideChapter`/`GuideProject` — both existing
  shapes already satisfy these types without casts (same pattern `WritingRoom.tsx` and `GhostWriterApp.tsx`
  already use for `nextAction`/`currentStage`).
- **No regression to `/project/[projectId]`:** Task 3's change to `useProjectState` only adds an
  optional override when `?chapter=` is present and matches a real chapter id; with no query param
  (the current behavior for every existing link into a project), `activeChapter` still defaults to
  `data.chapters?.[0]?.id`, identical to before.
- **Not independently unit-tested:** `Home.tsx`, `BraindumpModal.tsx`, and the `useProjectState`
  query-param change are UI/integration code with no existing component-test harness in this repo
  (consistent with `WritingRoom.tsx`/`SlashMenu.tsx` in Phase 2, which also relied on `tsc`/`vitest`
  for the underlying pure functions + `npm run build` for integration, not dedicated component tests).
  No browser-automation tooling is available in this environment for a manual smoke check.
