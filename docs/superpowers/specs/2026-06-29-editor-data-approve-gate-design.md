# Editor Data + Approve-Gate — Design Spec

**Status:** Approved design, pre-implementation
**Date:** 2026-06-29
**Sub-project:** #4 of the funnel roadmap (the linchpin — see `MASTER-PLAN-2026-06-29.md` §5). Depends on #1–#3.

## Context

The Editor role's pieces exist but are ephemeral: `/api/ai/refine`, `/api/projects/[id]/quality-check`, and `StoryHealthPanel`'s on-demand `issues` are never persisted, and chapters have no review/approval state. This sub-project gives the Editor **persisted findings (notes/issues)** and a **soft approve-gate** that becomes the single QA-before-spend chokepoint before paid Produce generation (comic/video/audio).

Approved decisions: **soft gate** (warn + explicit override, not hard-block) in v1.

## Goals

1. `editor_notes` table — persisted Editor findings per project/chapter.
2. `chapters.reviewStatus` (`draft|in_review|approved`) — the approve-gate flag.
3. `/api/projects/[id]/editor-notes` route (GET/POST/PATCH/DELETE) + chapter approve via PATCH.
4. An Editor panel in the Produce stage: list/resolve/dismiss notes, "Fix This" (existing prose-fix), "Scan chapter" (persist quality-check results as notes), Approve chapter.
5. A soft gate: Produce surfaces warn when launching paid generation on un-approved chapters, with an explicit override.

## Non-goals

- Hard-blocking Produce (deferred; soft gate only).
- New server-side analysis engines — reuse the existing `quality-check` for "Scan"; persist its output as notes.
- Reader-analytics integration (later).

## Architecture

### A. Schema — `src/db/schema.ts`

```ts
export const editorNotes = pgTable("editor_notes", {
  id:           uuid("id").defaultRandom().primaryKey(),
  projectId:    uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  chapterId:    uuid("chapter_id").references(() => chapters.id, { onDelete: "cascade" }),
  type:         varchar("type", { length: 12 }).notNull().default("issue"),       // issue | suggestion
  severity:     varchar("severity", { length: 8 }).notNull().default("medium"),   // high | medium | low
  category:     varchar("category", { length: 24 }).notNull().default("general"), // pacing|continuity|aiism|voice|stakes|general
  message:      text("message").notNull(),
  suggestedFix: text("suggested_fix").default(""),
  status:       varchar("status", { length: 10 }).notNull().default("open"),      // open | resolved | dismissed
  source:       varchar("source", { length: 16 }).notNull().default("manual"),    // manual | story_health | aiisms | quality_check
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
});
```
Add `reviewStatus: varchar("review_status", { length: 12 }).notNull().default("draft")` to `chapters`. Add `editorNotes: many(editorNotes)` to `projectsRelations`. Migration generated + pushed.

### B. Route — `src/app/api/projects/[projectId]/editor-notes/route.ts`

- `GET ?chapterId=&status=` → list notes (newest first), optional filters.
- `POST` — two shapes:
  - single `{ chapterId?, type?, severity?, category?, message, suggestedFix?, source? }` → insert one note (manual or one finding).
  - bulk `{ notes: [...] }` → insert many (client persists a `quality-check` run's issues, mapping `{severity, chapter, message}` → note rows with `source:"quality_check"`).
- `PATCH` — `{ noteId, status }` (resolve/dismiss) OR `{ chapterId, reviewStatus }` (approve-gate). Validates enums; 400 on bad value.
- `DELETE` — `{ noteId }`.
- All `getRequiredSession` + project-ownership; child rows scoped by `projectId`.

### C. UI — `src/components/EditorNotesPanel.tsx` (Produce stage)

- Lists the project's chapters with `reviewStatus` chip + open-note count.
- Per chapter (expandable): open notes (severity color, category, message, suggestedFix), each with **Resolve** / **Dismiss** and **Fix This** (calls existing `/api/ai/prose-fix` with the note's message/suggestedFix → applies to chapter content via the existing apply path). A **+ Add note** manual form. A **Scan chapter** button → calls `/api/projects/[id]/quality-check` and bulk-POSTs issues as notes. An **Approve chapter** button → PATCH `reviewStatus:"approved"` (toggles to "draft" if already approved).
- Mounted in `PolishStageView` (which renders in the Produce funnel stage).

### D. Soft gate

A tiny shared helper `chapterApprovalSummary(chapters): { approved, total, unapproved: string[] }`. In the Produce surfaces that launch paid media (`ExportStageView`'s Production/Comic openers, and ComicStudio/ProductionStudio generate buttons), show a non-blocking banner when unapproved chapters exist: "N chapter(s) not yet Editor-approved — review in the Editor panel first." No hard block; an explicit "generate anyway" remains. (v1 wires the banner in `ExportStageView`; deeper per-button gating folds into #5.)

### E. Registry

Add an `editor_review` tool capability (role editor, stage produce, endpoint `/api/projects/[projectId]/editor-notes`) so the Editor surface appears in the StageRoleRail's Review row. Keep `story_health` omission note from #1 resolved here if its surfaced action is now this panel.

## Testing

1. **Route** (`editor-notes/__tests__/route.test.ts`): POST single + bulk insert; PATCH note status + chapter reviewStatus (400 on bad enum); GET filters; ownership 404. Mock convention as established.
2. **Approval helper** unit test: counts approved/unapproved correctly.
3. **Registry drift guard** stays green (new tool endpoint resolves).
4. **Reachability**: add `EditorNotesPanel` to MUST_BE_REACHABLE.
5. Full suite + `tsc` green; no existing behavior changed (additive schema + new route + new panel + one banner).

## Files

- Modify: `src/db/schema.ts` (+ `editor_notes`, + `chapters.reviewStatus`, + relation) + migration
- Create: `src/app/api/projects/[projectId]/editor-notes/route.ts` + test
- Create: `src/components/EditorNotesPanel.tsx`
- Create: `src/lib/editor/approval.ts` (`chapterApprovalSummary`) + test
- Modify: `src/components/stages/PolishStageView.tsx` (mount panel), `src/components/stages/ExportStageView.tsx` (soft-gate banner), `src/lib/capabilities/registry.ts` (+ editor_review cap), reachability test

## Success criteria

- Editor findings persist; a user resolves/dismisses/fixes them and approves chapters.
- Produce shows a soft, overridable warning for unapproved chapters.
- `tsc` clean; full suite green; the approve-gate is the documented chokepoint #5/Comic/Video will build on.
