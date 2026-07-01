# Per-Chapter "Plan Next Chapter" Guide Rung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new Guide rung that offers to plan an undrafted chapter (via the existing, currently invisible, `buildSceneBlueprint` Haiku helper) before jumping straight to drafting — persisting the plan as a new `chapter_plan` kind on the existing `story_plans` table, and reusing the Beat Sheet's exact "Draft this →" wiring to feed it into the Writer flow.

**Architecture:** A new inline-checked rung in `computeAction()` (matching the `polish-review-manuscript` dismissal-fallthrough pattern, not the `draft-chapter` pattern) fires when an undrafted chapter has no saved plan and isn't dismissed. A new `kind: "chapter_plan"` branch in the existing `story-plans` POST route wraps one `buildSceneBlueprint` call as a single `StoryBeat`. A new `ChapterPlanPanel` (mirroring `BeatSheetPanel`'s structure) surfaces it as an overlay in `GhostWriterApp`, with an on-demand "Research" pane backed by a new tiny `chapter-research` route that composes the already fail-open `buildPromiseLedger`.

**Tech Stack:** TypeScript, Next.js App Router, Drizzle ORM, Anthropic SDK (via `buildSceneBlueprint`), Vitest, React (no new dependencies).

## Global Constraints

- No new database table and no new zod schema — reuses `story_plans` + the existing `StoryBeatSchema`/`encodeStoryBeats`/`decodeStoryBeats` (`src/lib/types/story.ts`) exactly, via a new `kind: "chapter_plan"` value (an untyped `varchar`, so no enum/migration needed for the kind itself).
- Zero change to the `kind: "beat_sheet"` generation path, `BeatSheetPanel.tsx`, or `/api/ai/generate` — purely additive branches.
- `buildSceneBlueprint` (`src/lib/ai/scene-blueprint.ts`) and `buildPromiseLedger` (`src/lib/ai/promise-ledger.ts`) are already fail-open (return `""` on error) — do not add redundant try/catch around their calls; propagate their empty-string result as a user-facing "couldn't plan" state instead.
- The plan-chapter rung must use the **inline dismissal-check pattern** (`!dismissed.includes(...)` as part of the `if` condition inside `computeAction()`), matching `polish-review-manuscript` — NOT the outer-`nextAction()`-only pattern used by `draft-chapter-*`/`keep-writing-*`. This is what makes "Skip" fall through to reveal "Start writing" underneath, rather than blanking the Guide bar.
- The plan-chapter rung is **not** gated by `isStoryFormat`/`isCreatorFormat` — it fires for every undrafted chapter regardless of format, matching the existing (also ungated) `draft-chapter`/`undrafted` rung it sits beside.
- `ChapterPlanPanel` must be added to `MUST_BE_REACHABLE` in `src/components/__tests__/live-shell-reachability.test.ts` once mounted.
- TDD: write the failing test first for every unit that has one. Run tests after each implementation step to confirm PASS.

---

### Task 1: Guide ladder — `plan-chapter` rung

**Files:**
- Modify: `src/lib/guide/next-action.ts`
- Test: `src/lib/guide/__tests__/next-action.test.ts`

**Interfaces:**
- Consumes: nothing new — pure function, no new imports.
- Produces: `GuideProject.plannedChapterIds?: string[]` (new optional field) and `GuideRunSpec.mode` gains the literal `"plan_chapter"` (alongside the existing `"story_health"`/`"export"` pseudo-modes) — Task 5 (GhostWriterApp) reads this new mode value and this new field name.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/guide/__tests__/next-action.test.ts`, inside the existing `describe("nextAction", ...)` block (after the last `it(...)` and before the closing `});` of that describe block — i.e. right after the "falls back to a keep-writing suggestion once export-manuscript has been dismissed" test):

```ts
  it("suggests planning an undrafted chapter before offering to draft it", () => {
    const action = nextAction({
      ...base,
      controllingIdea: "Premise.",
      characters: [{ id: "char-1" }],
      chapters: [{ id: "ch-1", title: "Chapter 1", wordCount: 0, sortOrder: 0 }],
    });
    expect(action?.id).toBe("plan-chapter-ch-1");
    expect(action?.stage).toBe("draft");
    expect(action?.run.mode).toBe("plan_chapter");
    expect(action?.run.chapterId).toBe("ch-1");
  });

  it("suggests planning for chapter 1 specifically, same as any other chapter", () => {
    const action = nextAction({
      ...base,
      controllingIdea: "Premise.",
      characters: [{ id: "char-1" }],
      chapters: [
        { id: "ch-1", title: "Chapter 1", wordCount: 0, sortOrder: 0 },
        { id: "ch-2", title: "Chapter 2", wordCount: 0, sortOrder: 1 },
      ],
    });
    expect(action?.id).toBe("plan-chapter-ch-1");
  });

  it("skips the plan rung and suggests drafting directly once the chapter has a saved plan", () => {
    const action = nextAction({
      ...base,
      controllingIdea: "Premise.",
      characters: [{ id: "char-1" }],
      chapters: [{ id: "ch-1", title: "Chapter 1", wordCount: 0, sortOrder: 0 }],
      plannedChapterIds: ["ch-1"],
    });
    expect(action?.id).toBe("draft-chapter-ch-1");
    expect(action?.run.mode).toBe("write");
  });

  it("falls through to the draft rung when the plan rung has been dismissed, instead of hiding the Guide bar", () => {
    const action = nextAction({
      ...base,
      controllingIdea: "Premise.",
      characters: [{ id: "char-1" }],
      chapters: [{ id: "ch-1", title: "Chapter 1", wordCount: 0, sortOrder: 0 }],
      dismissedGuideIds: ["plan-chapter-ch-1"],
    });
    expect(action?.id).toBe("draft-chapter-ch-1");
    expect(action?.run.mode).toBe("write");
  });
```

Also add one test inside the existing `describe("currentStage", ...)` block (after the last `it(...)`, before its closing `});`), confirming the stage indicator doesn't regress for either the new plan rung or the draft rung underneath it:

```ts
  it("reports 'draft' for both the plan-chapter rung and the draft-chapter rung underneath it", () => {
    const unplanned: GuideProject = {
      ...base,
      controllingIdea: "Premise.",
      characters: [{ id: "char-1" }],
      chapters: [{ id: "ch-1", title: "Chapter 1", wordCount: 0, sortOrder: 0 }],
    };
    expect(nextAction(unplanned)?.id).toBe("plan-chapter-ch-1");
    expect(currentStage(unplanned)).toBe("draft");

    const planned: GuideProject = { ...unplanned, plannedChapterIds: ["ch-1"] };
    expect(nextAction(planned)?.id).toBe("draft-chapter-ch-1");
    expect(currentStage(planned)).toBe("draft");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```
npx vitest run src/lib/guide/__tests__/next-action.test.ts
```
Expected: the 5 new tests FAIL (plan-chapter rung doesn't exist yet — `action?.id` will be `"draft-chapter-ch-1"` for the ladder tests, since `computeAction()` currently jumps straight to the draft rung; the `currentStage` test fails on its first assertion for the same reason).

- [ ] **Step 3: Add `plannedChapterIds` and the `plan_chapter` mode**

In `src/lib/guide/next-action.ts`, update `GuideRunSpec` (around line 8-12):

```ts
export type GuideRunSpec = {
  mode: GenerationMode | "story_health" | "export" | "plan_chapter";
  prompt?: string;
  chapterId?: string;
};
```

Update `GuideProject` (around line 32-39) — add one field after `dismissedGuideIds`:

```ts
export interface GuideProject {
  format: string;
  controllingIdea?: string;
  biggestChallenge?: string;
  characters: { id: string }[];
  chapters: GuideChapter[];
  dismissedGuideIds?: string[];
  plannedChapterIds?: string[];
}
```

- [ ] **Step 4: Insert the plan-chapter rung above the draft rung**

Replace the existing `undrafted` block in `computeAction()` (currently):

```ts
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
```

with:

```ts
  const undrafted = sortedChapters.find((c) => c.wordCount === 0);
  if (undrafted) {
    const dismissed = project.dismissedGuideIds ?? [];
    const planned = project.plannedChapterIds ?? [];
    if (!planned.includes(undrafted.id) && !dismissed.includes(`plan-chapter-${undrafted.id}`)) {
      return {
        id: `plan-chapter-${undrafted.id}`,
        stage: "draft",
        message: `Before you draft "${undrafted.title}" — want a quick scene plan?`,
        cta: "Plan this chapter",
        run: { mode: "plan_chapter", chapterId: undrafted.id },
      };
    }
    return {
      id: `draft-chapter-${undrafted.id}`,
      stage: "draft",
      message: `Ready to draft "${undrafted.title}" — let's write the opening scene.`,
      cta: "Start writing",
      run: { mode: "write", prompt: `Write the opening scene for "${undrafted.title}".`, chapterId: undrafted.id },
    };
  }
```

Note this block already has its own `const dismissed = ...` local — this shadows nothing since no `dismissed` variable exists earlier in `computeAction()` at this point (the later `polish-review-manuscript`/`export-manuscript` block declares its own separate `const dismissed = project.dismissedGuideIds ?? [];` further down, which is fine — each block is independent).

- [ ] **Step 5: Run the tests to verify they pass**

```
npx vitest run src/lib/guide/__tests__/next-action.test.ts
```
Expected: all tests PASS (5 new + all pre-existing tests in the file, unmodified).

- [ ] **Step 6: Run typecheck**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/guide/next-action.ts src/lib/guide/__tests__/next-action.test.ts
git commit -m "feat: add plan-chapter Guide rung above the draft rung"
```

---

### Task 2: `story-plans` route — `chapter_plan` kind

**Files:**
- Modify: `src/app/api/projects/[projectId]/story-plans/route.ts`
- Test: `src/app/api/projects/[projectId]/story-plans/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `buildSceneBlueprint(params: { prompt: string; staticContext?: string; dynamicContext?: string; format: string }): Promise<string>` from `@/lib/ai/scene-blueprint` (existing export, unchanged signature); `encodeStoryBeats`/`StoryBeat` from `@/lib/types/story` (existing, unchanged); `chapters` table from `@/db/schema` (existing, needs adding to this route's import line).
- Produces: `POST /api/projects/[projectId]/story-plans` now accepts `{ kind: "chapter_plan", chapterId: string, prompt?: string }` in its body and returns `{ plan: StoryPlan }` with exactly one beat whose `chapterId` matches the input — Task 4 (`ChapterPlanPanel`) and Task 1's Guide rung consumer (Task 5) rely on this shape.

- [ ] **Step 1: Write the failing tests**

First, extend the file's existing static `vi.mock("@/db", ...)` block so `db.query.chapters` is a first-class mock declared alongside `projects`/`storyPlans`, matching how every other query mock in this file is declared (rather than mutating the mocked module at runtime inside a test body). Replace the existing block:

```ts
const findFirstProjects = vi.fn();
const insertValues = vi.fn();
const insertReturning = vi.fn();
const findManyPlans = vi.fn();
const updateSet = vi.fn();
const updateReturning = vi.fn();
const deleteWhere = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...a: any[]) => findFirstProjects(...a) },
      storyPlans: { findMany: (...a: any[]) => findManyPlans(...a) },
    },
    insert: () => ({ values: (v: any) => { insertValues(v); return { returning: (...a: any[]) => insertReturning(...a) }; } }),
    update: () => ({ set: (v: any) => { updateSet(v); return { where: () => ({ returning: (...a: any[]) => updateReturning(...a) }) }; } }),
    delete: () => ({ where: (...a: any[]) => { deleteWhere(...a); return Promise.resolve(); } }),
  },
}));
```

with (only the addition of `findFirstChapter` and the `chapters` query mock — everything else identical):

```ts
const findFirstProjects = vi.fn();
const findFirstChapter = vi.fn();
const insertValues = vi.fn();
const insertReturning = vi.fn();
const findManyPlans = vi.fn();
const updateSet = vi.fn();
const updateReturning = vi.fn();
const deleteWhere = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...a: any[]) => findFirstProjects(...a) },
      storyPlans: { findMany: (...a: any[]) => findManyPlans(...a) },
      chapters: { findFirst: (...a: any[]) => findFirstChapter(...a) },
    },
    insert: () => ({ values: (v: any) => { insertValues(v); return { returning: (...a: any[]) => insertReturning(...a) }; } }),
    update: () => ({ set: (v: any) => { updateSet(v); return { where: () => ({ returning: (...a: any[]) => updateReturning(...a) }) }; } }),
    delete: () => ({ where: (...a: any[]) => { deleteWhere(...a); return Promise.resolve(); } }),
  },
}));
```

Then add to the existing `beforeEach(() => { ... })` block, right after the existing `insertReturning.mockResolvedValue([{ id: "plan-1", beats: [] }]);` line, two more default setup lines:

```ts
    findFirstChapter.mockResolvedValue({ id: "chap-1", projectId: "proj-1", title: "The Descent" });
    messagesCreate.mockResolvedValue({ content: [{ type: "text", text: "GOAL: escape\nOBSTACLE: locked door\nTURN: finds a key\nCHANGE: reaches the surface\nSENSORY: damp stone, distant drip, cold air\nEXIT: a decision" }] });
```

`messagesCreate` is safe to default here: every existing test in this file that generates via Claude already calls `claudeReturning(...)` to overwrite this mock with its own JSON payload before asserting, so this default only takes effect for the new `chapter_plan` tests below, which don't call `claudeReturning`. This test file already mocks `@anthropic-ai/sdk` directly (see the top of the file) — `buildSceneBlueprint` constructs its own internal `Anthropic` client from that same module, so the module-level mock covers it too, and `messagesCreate` controls its response exactly as it does for the route's own direct `client.messages.create` calls.

Now add the three new tests inside the existing `describe("story-plans route", ...)` block (after the last `it(...)`, before the closing `});`):

```ts
  it("POST with kind:'chapter_plan' calls buildSceneBlueprint and persists one beat with the chapter's id", async () => {
    const res = await POST(makeReq({ kind: "chapter_plan", chapterId: "chap-1", prompt: "next scene" }), params);
    expect(res.status).toBe(200);

    const inserted = insertValues.mock.calls[0][0];
    expect(inserted.projectId).toBe("proj-1");
    expect(inserted.kind).toBe("chapter_plan");
    expect(inserted.beats).toHaveLength(1);
    expect(inserted.beats[0]).toMatchObject({ order: 1, label: "The Descent", chapterId: "chap-1" });
    expect(inserted.beats[0].summary.length).toBeGreaterThan(0);
  });

  it("POST with kind:'chapter_plan' and no chapterId returns 400", async () => {
    const res = await POST(makeReq({ kind: "chapter_plan" }), params);
    expect(res.status).toBe(400);
  });

  it("POST with kind:'chapter_plan' and an unknown chapterId returns 404", async () => {
    findFirstChapter.mockResolvedValue(undefined);
    const res = await POST(makeReq({ kind: "chapter_plan", chapterId: "missing-chap" }), params);
    expect(res.status).toBe(404);
  });

  it("POST with kind:'chapter_plan' returns 500 when buildSceneBlueprint fails open (empty string)", async () => {
    messagesCreate.mockRejectedValue(new Error("model unavailable"));
    const res = await POST(makeReq({ kind: "chapter_plan", chapterId: "chap-1" }), params);
    expect(res.status).toBe(500);
    expect(insertValues).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```
npx vitest run "src/app/api/projects/*/story-plans/__tests__/route.test.ts"
```
Expected: the 4 new tests FAIL (`kind` is not handled — POST falls through to the existing beat-sheet path and either 500s parsing the blueprint text as JSON, or the `db.query.chapters` mock doesn't exist yet causing a TypeError).

- [ ] **Step 3: Add the `chapter_plan` branch to `POST`**

In `src/app/api/projects/[projectId]/story-plans/route.ts`, update the schema import line (currently `import { projects, storyPlans } from "@/db/schema";`):

```ts
import { projects, storyPlans, chapters } from "@/db/schema";
```

Add one new import after the existing `beatSheetSystemPrompt` import:

```ts
import { buildSceneBlueprint } from "@/lib/ai/scene-blueprint";
```

In `POST`, update the destructuring line (currently `const { prompt = "", title, presetId } = await req.json().catch(() => ({}));`) to:

```ts
  const { prompt = "", title, presetId, kind, chapterId } = await req.json().catch(() => ({}));
```

Insert a new branch immediately after that line, before the existing `if (presetId) { ... }` block:

```ts
  if (kind === "chapter_plan") {
    if (!chapterId) return NextResponse.json({ error: "chapterId is required for a chapter plan." }, { status: 400 });
    // The project query above only loads `with: { characters, plotThreads }` — chapters
    // are not included, so look the chapter up directly rather than assuming it's on `project`.
    const chapter = await db.query.chapters.findFirst({
      where: and(eq(chapters.id, chapterId), eq(chapters.projectId, projectId)),
    });
    if (!chapter) return NextResponse.json({ error: "Chapter not found." }, { status: 404 });

    const staticContext = cast.map((c: any) => `${c.name}: ${c.personality ?? ""}`).join("\n");
    const blueprint = await buildSceneBlueprint({
      prompt: prompt || `Plan the next scene for "${chapter.title}".`,
      staticContext,
      format: project.format,
    });
    if (!blueprint) return NextResponse.json({ error: "Couldn't draft a scene plan. Try again." }, { status: 500 });

    const beats = encodeStoryBeats([{
      id: crypto.randomUUID(),
      order: 1,
      label: chapter.title,
      summary: blueprint,
      purpose: "rising",
      characterIds: [],
      threadIds: [],
      chapterId,
    }]);
    const [plan] = await db.insert(storyPlans).values({
      projectId, kind: "chapter_plan", title: `Plan: ${chapter.title}`, beats,
    }).returning();
    return NextResponse.json({ plan });
  }

```

This is inserted after `const threads = (project as any).plotThreads ?? [];` and before the existing `if (presetId) { ... }` block — `cast` and `threads` are already in scope at that point in the file.

- [ ] **Step 4: Run the tests to verify they pass**

```
npx vitest run "src/app/api/projects/*/story-plans/__tests__/route.test.ts"
```
Expected: all tests PASS (4 new + all pre-existing tests unmodified — the `beat_sheet`/`presetId` paths are untouched).

- [ ] **Step 5: Run typecheck**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/projects/[projectId]/story-plans/route.ts \
        "src/app/api/projects/[projectId]/story-plans/__tests__/route.test.ts"
git commit -m "feat: add chapter_plan kind to the story-plans route"
```

---

### Task 3: `chapter-research` route

**Files:**
- Create: `src/app/api/projects/[projectId]/chapter-research/route.ts`
- Test: `src/app/api/projects/[projectId]/chapter-research/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `buildPromiseLedger(projectId: string, mode?: "generate" | "preserve"): Promise<string>` from `@/lib/ai/promise-ledger` (existing export); `chapters`/`projects` tables from `@/db/schema`.
- Produces: `GET /api/projects/[projectId]/chapter-research?chapterId=<id>` returns `{ openPromises: string; priorChapterSummary: string }` — Task 4 (`ChapterPlanPanel`) fetches this for the "Research" pane.

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/projects/[projectId]/chapter-research/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const findFirstProject = vi.fn();
const findManyChapters = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...a: any[]) => findFirstProject(...a) },
      chapters: { findMany: (...a: any[]) => findManyChapters(...a) },
    },
  },
}));

const buildPromiseLedger = vi.fn();
vi.mock("@/lib/ai/promise-ledger", () => ({
  buildPromiseLedger: (...a: any[]) => buildPromiseLedger(...a),
}));

import { GET } from "../route";

function makeReq(chapterId?: string) {
  const url = new URL("http://localhost/api/projects/proj-1/chapter-research");
  if (chapterId) url.searchParams.set("chapterId", chapterId);
  return new Request(url);
}
const params = { params: Promise.resolve({ projectId: "proj-1" }) };

describe("GET /api/projects/[projectId]/chapter-research", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProject.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    buildPromiseLedger.mockResolvedValue("");
  });

  it("returns openPromises from buildPromiseLedger in preserve mode", async () => {
    buildPromiseLedger.mockResolvedValue("OPEN STORY PROMISES\n- the missing letter");
    findManyChapters.mockResolvedValue([
      { id: "ch-1", sortOrder: 0, summary: "Mara finds the letter." },
      { id: "ch-2", sortOrder: 1, summary: "" },
    ]);
    const res = await GET(makeReq("ch-2"), params);
    const body = await res.json();
    expect(buildPromiseLedger).toHaveBeenCalledWith("proj-1", "preserve");
    expect(body.openPromises).toContain("the missing letter");
  });

  it("returns the prior chapter's summary based on sortOrder", async () => {
    findManyChapters.mockResolvedValue([
      { id: "ch-1", sortOrder: 0, summary: "Mara finds the letter." },
      { id: "ch-2", sortOrder: 1, summary: "" },
    ]);
    const res = await GET(makeReq("ch-2"), params);
    const body = await res.json();
    expect(body.priorChapterSummary).toBe("Mara finds the letter.");
  });

  it("returns an empty priorChapterSummary for the first chapter", async () => {
    findManyChapters.mockResolvedValue([
      { id: "ch-1", sortOrder: 0, summary: "" },
    ]);
    const res = await GET(makeReq("ch-1"), params);
    const body = await res.json();
    expect(body.priorChapterSummary).toBe("");
  });

  it("404s when the project isn't owned", async () => {
    findFirstProject.mockResolvedValue(undefined);
    const res = await GET(makeReq("ch-1"), params);
    expect(res.status).toBe(404);
  });

  it("400s when chapterId is missing", async () => {
    const res = await GET(makeReq(), params);
    expect(res.status).toBe(400);
  });

  it("is fail-open: an empty ledger still returns 200 with an empty string", async () => {
    findManyChapters.mockResolvedValue([{ id: "ch-1", sortOrder: 0, summary: "" }]);
    const res = await GET(makeReq("ch-1"), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.openPromises).toBe("");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```
npx vitest run "src/app/api/projects/*/chapter-research/__tests__/route.test.ts"
```
Expected: FAIL — the route file doesn't exist yet (`Cannot find module '../route'`).

- [ ] **Step 3: Create the route**

Create `src/app/api/projects/[projectId]/chapter-research/route.ts`:

```ts
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { buildPromiseLedger } from "@/lib/ai/promise-ledger";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  if (!await verifyOwnership(projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const chapterId = new URL(req.url).searchParams.get("chapterId");
  if (!chapterId) return NextResponse.json({ error: "chapterId is required." }, { status: 400 });

  const allChapters = await db.query.chapters.findMany({
    where: (c, { eq }) => eq(c.projectId, projectId),
    orderBy: (c, { asc }) => [asc(c.sortOrder)],
  });
  const target = allChapters.find((c: any) => c.id === chapterId);
  const priorChapterSummary = target
    ? (allChapters.find((c: any) => c.sortOrder === target.sortOrder - 1)?.summary ?? "")
    : "";

  const openPromises = await buildPromiseLedger(projectId, "preserve");

  return NextResponse.json({ openPromises, priorChapterSummary });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```
npx vitest run "src/app/api/projects/*/chapter-research/__tests__/route.test.ts"
```
Expected: all 6 tests PASS.

- [ ] **Step 5: Run typecheck**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/projects/[projectId]/chapter-research/route.ts" \
        "src/app/api/projects/[projectId]/chapter-research/__tests__/route.test.ts"
git commit -m "feat: add chapter-research route for the plan-chapter Research pane"
```

---

### Task 4: `ChapterPlanPanel` component

**Files:**
- Create: `src/components/ChapterPlanPanel.tsx`
- Modify: `src/components/__tests__/live-shell-reachability.test.ts`

**Interfaces:**
- Consumes: `StoryBeat` type from `@/lib/types/story` (existing); `co`/`sBtn`/`sBtnSm`/`sInput` styles from `@/lib/styles` (existing, same as `BeatSheetPanel`); `toast` from `@/lib/toast` (existing); `POST /api/projects/[id]/story-plans` with `{ kind: "chapter_plan", chapterId }` (Task 2); `GET /api/projects/[id]/chapter-research?chapterId=` (Task 3); `PATCH /api/projects/[id]/story-plans` with `{ planId, beats }` (existing, unchanged).
- Produces: `export default function ChapterPlanPanel(props: { projectId: string; chapterId: string; chapterTitle: string; onClose(): void; onSelectMode(mode: "write"): void; setPrompt(value: string): void; onDismissGuide(): void }): JSX.Element | null` — Task 5 (`GhostWriterApp`) mounts this with these exact prop names.

This task has no isolated unit test of its own — like `BeatSheetPanel`, it is a thin fetch/render component verified by typecheck and the reachability guard (matching the codebase's established split between tested pure logic and untested UI shells).

- [ ] **Step 1: Create the component**

Create `src/components/ChapterPlanPanel.tsx`:

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { co, sBtn, sBtnSm, sInput } from "@/lib/styles";
import { toast } from "@/lib/toast";
import type { StoryBeat } from "@/lib/types/story";

interface ChapterPlanPanelProps {
  projectId: string;
  chapterId: string;
  chapterTitle: string;
  onClose: () => void;
  onSelectMode: (mode: "write") => void;
  setPrompt: (value: string) => void;
  onDismissGuide: () => void;
}

type Research = { openPromises: string; priorChapterSummary: string };

export default function ChapterPlanPanel({ projectId, chapterId, chapterTitle, onClose, onSelectMode, setPrompt, onDismissGuide }: ChapterPlanPanelProps) {
  const [planId, setPlanId] = useState<string | null>(null);
  const [beat, setBeat] = useState<StoryBeat | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [research, setResearch] = useState<Research | null>(null);
  const [researching, setResearching] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/story-plans`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        const plans = Array.isArray(data?.plans) ? data.plans : [];
        const chapterPlan = plans.find((p: any) => p.kind === "chapter_plan" && (p.beats?.[0]?.chapterId === chapterId));
        if (chapterPlan) {
          setPlanId(chapterPlan.id);
          setBeat(chapterPlan.beats[0] ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [projectId, chapterId]);

  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/story-plans`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "chapter_plan", chapterId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Couldn't draft a scene plan."); return; }
      setPlanId(data.plan.id);
      setBeat(data.plan.beats?.[0] ?? null);
    } catch {
      toast.error("Scene plan generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const fetchResearch = async () => {
    if (researching) return;
    setResearching(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/chapter-research?chapterId=${chapterId}`);
      if (res.ok) setResearch(await res.json());
    } catch {
      // Research is a display-only aid — a failed fetch just leaves the pane empty.
    } finally {
      setResearching(false);
    }
  };

  const persist = (nextBeat: StoryBeat) => {
    if (!planId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/projects/${projectId}/story-plans`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, beats: [nextBeat] }),
      }).catch(() => {});
    }, 1200);
  };

  const updateSummary = (value: string) => {
    setBeat(prev => {
      if (!prev) return prev;
      const next = { ...prev, summary: value };
      persist(next);
      return next;
    });
  };

  const draftChapter = () => {
    if (beat) setPrompt(`Write "${chapterTitle}" following this scene plan:\n${beat.summary}`);
    onSelectMode("write");
    onClose();
  };

  const skip = () => {
    onDismissGuide();
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 1500, display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <div style={{ width: 460, maxWidth: "100%", height: "100%", background: co.surface, overflow: "auto", padding: 20, position: "relative" }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", fontSize: 22, lineHeight: 1, cursor: "pointer", color: co.muted }} aria-label="Close">×</button>

        <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>📝 Plan · {chapterTitle}</div>

        {!loaded && <p style={{ fontSize: 13, color: co.muted }}>Loading…</p>}

        {loaded && !beat && (
          <>
            <p style={{ fontSize: 13, color: co.muted, lineHeight: 1.6, marginBottom: 16 }}>
              Generate a tight scene plan — goal, obstacle, turn, and how the story changes by the end — before you draft.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={{ ...sBtn, opacity: generating ? 0.6 : 1 }} disabled={generating} onClick={generate}>
                {generating ? "Planning…" : "Idea — generate a scene plan"}
              </button>
              <button style={sBtnSm} onClick={fetchResearch} disabled={researching}>
                {researching ? "Loading…" : "Research — what must this chapter honor?"}
              </button>
              <button style={{ ...sBtnSm, background: "transparent" }} onClick={skip}>Skip — start writing</button>
            </div>
          </>
        )}

        {research && (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 8, border: `1px solid ${co.border}`, background: co.bg }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Research</div>
            {research.priorChapterSummary && (
              <p style={{ fontSize: 12, color: co.text, lineHeight: 1.6, marginBottom: 8 }}><strong>Previously:</strong> {research.priorChapterSummary}</p>
            )}
            {research.openPromises && (
              <p style={{ fontSize: 12, color: co.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{research.openPromises}</p>
            )}
            {!research.priorChapterSummary && !research.openPromises && (
              <p style={{ fontSize: 12, color: co.muted }}>Nothing specific to honor yet — this is a clean slate.</p>
            )}
          </div>
        )}

        {beat && (
          <div style={{ marginTop: 12 }}>
            <textarea
              value={beat.summary}
              onChange={(e) => updateSummary(e.target.value)}
              rows={8}
              style={{ ...sInput, resize: "vertical", fontSize: 13, lineHeight: 1.6, width: "100%" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button style={sBtn} onClick={draftChapter}>✍️ Draft this chapter →</button>
              <button style={sBtnSm} onClick={fetchResearch} disabled={researching}>
                {researching ? "Loading…" : "Research"}
              </button>
              <button style={{ ...sBtnSm, opacity: generating ? 0.6 : 1 }} disabled={generating} onClick={generate}>
                {generating ? "Planning…" : "Regenerate"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `ChapterPlanPanel` to the reachability guard**

In `src/components/__tests__/live-shell-reachability.test.ts`, add `"ChapterPlanPanel"` to the `MUST_BE_REACHABLE` array (after `"GuideBar"`):

```ts
const MUST_BE_REACHABLE = [
  "StageRoleRail",
  "BeatSheetPanel",
  "EditorNotesPanel",
  "ProductionPipelineBar",
  "InspirationLibrary",
  "AudioNovelPanel",
  "SprintMode",
  "StoryInsightsPanel",
  "ArcHeatMap",
  "TensionCurve",
  "ConstellationView",
  "StoryBible",
  "ComicStudio",
  "ProductionStudio",
  "GuideBar",
  "EntitySuggestionsChip",
  "ChapterPlanPanel",
];
```

This test will FAIL until Task 5 actually imports `ChapterPlanPanel` in `GhostWriterApp.tsx` — that's expected and resolved by Task 5, not this task. Do not run this specific test in isolation as a pass/fail gate for this task; typecheck is this task's verification.

- [ ] **Step 3: Run typecheck**

```
npx tsc --noEmit
```
Expected: no errors from `src/components/ChapterPlanPanel.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/ChapterPlanPanel.tsx src/components/__tests__/live-shell-reachability.test.ts
git commit -m "feat: add ChapterPlanPanel component"
```

---

### Task 5: Wire `ChapterPlanPanel` into `GhostWriterApp`

**Files:**
- Modify: `src/components/GhostWriterApp.tsx`

**Interfaces:**
- Consumes: `ChapterPlanPanel` (Task 4) default export with the exact prop shape defined there; `GuideRunSpec.mode === "plan_chapter"` and `GuideProject.plannedChapterIds` (Task 1).
- Produces: nothing new for later tasks — this is the final integration point.

This task has no isolated unit test — `GhostWriterApp.tsx` is verified by the existing `live-shell-reachability.test.ts` (now passing once this task's import lands) plus typecheck, matching the codebase's established pattern for this file's own overlay-panel wiring (`showStoryHealth`/`StoryHealthPanel`, `showExport`/`ExportPanel`, etc. have no isolated tests either).

- [ ] **Step 1: Add the dynamic import**

In `src/components/GhostWriterApp.tsx`, add one line after the existing `const StoryBible = dynamic(...)` line (around line 28):

```ts
const ChapterPlanPanel  = dynamic(() => import("@/components/ChapterPlanPanel"), { ssr: false });
```

- [ ] **Step 2: Add state for the panel and the fetched chapter-plan ids**

Add two new `useState` declarations after the existing `const [showExport, setShowExport] = useState(false);` line (around line 64):

```ts
  const [showChapterPlan, setShowChapterPlan] = useState(false);
  const [chapterPlanChapterId, setChapterPlanChapterId] = useState<string | null>(null);
  const [plannedChapterIds, setPlannedChapterIds] = useState<string[]>([]);
```

- [ ] **Step 3: Fetch story-plans to derive `plannedChapterIds`**

Add a new `useEffect` after the existing subscription-fetch `useEffect` (around line 78-80):

```ts
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/story-plans`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        const plans = Array.isArray(data?.plans) ? data.plans : [];
        const ids = plans
          .filter((p: any) => p.kind === "chapter_plan")
          .map((p: any) => p.beats?.[0]?.chapterId)
          .filter((id: unknown): id is string => typeof id === "string");
        setPlannedChapterIds(ids);
      })
      .catch(() => {});
  }, [projectId]);
```

- [ ] **Step 4: Pass `plannedChapterIds` into the `nextAction()` call**

Update the existing `guideAction` `useMemo` (around line 128-134) to include the new field:

```ts
  const guideAction = useMemo(() => nextAction({
    format: project?.format ?? "",
    controllingIdea: project?.controllingIdea,
    characters: project?.characters || [],
    chapters: project?.chapters || [],
    dismissedGuideIds: project?.dismissedGuideIds,
    plannedChapterIds,
  }), [project?.format, project?.controllingIdea, project?.characters, project?.chapters, project?.dismissedGuideIds, plannedChapterIds]);
```

- [ ] **Step 5: Add the `plan_chapter` branch to `handleGuideRun`**

Update the existing `handleGuideRun` function (around line 258-280) — add one new `if` branch after the existing `if (runMode === "export") { setShowExport(true); return; }` line:

```ts
    const { mode: runMode, prompt: runPrompt, chapterId: runChapterId } = action.run;
    if (runMode === "story_health") { setShowStoryHealth(true); return; }
    if (runMode === "export") { setShowExport(true); return; }
    if (runMode === "plan_chapter") { setChapterPlanChapterId(runChapterId ?? null); setShowChapterPlan(true); return; }
    setMode(runMode);
```

- [ ] **Step 6: Mount `ChapterPlanPanel`**

Add the panel after the existing `{showExport && (...)}` block (around line 614-620):

```tsx
      {showChapterPlan && chapterPlanChapterId && (
        <ChapterPlanPanel
          projectId={project.id}
          chapterId={chapterPlanChapterId}
          chapterTitle={project.chapters?.find((c: any) => c.id === chapterPlanChapterId)?.title ?? "Chapter"}
          onClose={() => setShowChapterPlan(false)}
          onSelectMode={(m) => setMode(m)}
          setPrompt={setPrompt}
          onDismissGuide={() => handleGuideDismiss(`plan-chapter-${chapterPlanChapterId}`)}
        />
      )}
```

- [ ] **Step 7: Run the reachability test to verify it now passes**

```
npx vitest run src/components/__tests__/live-shell-reachability.test.ts
```
Expected: all tests PASS, including the new `"ChapterPlanPanel is imported somewhere in the live shell's file tree"` case from Task 4.

- [ ] **Step 8: Run the full suite and typecheck**

```
npm test
npx tsc --noEmit
```
Expected: all tests pass (no regressions), no type errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/GhostWriterApp.tsx
git commit -m "feat: wire ChapterPlanPanel into GhostWriterApp via the plan-chapter Guide rung"
```
