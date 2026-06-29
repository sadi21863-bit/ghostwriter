# First-Class Director Data: Beat Sheet — Design Spec

**Status:** Approved design, pre-implementation
**Date:** 2026-06-29
**Sub-project:** #3 of the "4-stage funnel + AI roles" roadmap. Depends on #1 (registry — shipped) and reuses the zod pattern from the JSONB-typing work (`src/lib/types/story.ts`).

## Context

The Director role currently produces ephemeral prose (outline mode → text into the editor). There is no persisted, structured plan artifact. Continuity tables (`storyThreads`, `storyPromises`, `storyCheckpoints`) exist but none is a beat sheet, and there is no `/api/director/*`. This sub-project gives the Director a **first-class, structured, persisted beat sheet** that the user edits and the Writer drafts from.

Approved scope: **beat sheet only** for v1 (outline already exists as a mode; production shot-plans already persist via `generate-package`). The `story_plans` table is generic/kind-tagged so outline/production-plan can join later without a migration rewrite.

## Goals

1. A `story_plans` table holding a kind-tagged plan whose `beats` is a structured, zod-guarded JSONB array.
2. `/api/projects/[id]/story-plans` (GET/POST/PATCH/DELETE) — POST generates beats via Claude (Director, structured JSON not prose).
3. A `BeatSheetPanel` surfaced in the Shape stage: generate, edit beats inline, and **"Draft this →"** per beat (hands the beat to the existing Writer flow).
4. Beats are real data the Writer drafts from; the Editor can later check coverage. No behavior change to existing modes/routes.

## Non-goals

- Outline / production-plan kinds (deferred; table supports them later).
- Editor coverage-checking UI (sub-project #4).
- Auto-linking beats to chapters beyond storing a `chapterId` when the user drafts one.

## Architecture

### A. Schema — `src/db/schema.ts`

```ts
export const storyPlans = pgTable("story_plans", {
  id:        uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  kind:      varchar("kind", { length: 20 }).notNull().default("beat_sheet"),
  title:     text("title").notNull().default("Beat Sheet"),
  beats:     jsonb("beats").$type<unknown[]>().notNull().default(sql`'[]'`),
  status:    varchar("status", { length: 20 }).notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```
Relation: add `storyPlans: many(storyPlans)` to `projectsRelations`. Migration generated + pushed via the documented PowerShell flow.

### B. Beat schema + guards — `src/lib/types/story.ts` (extend)

```ts
export const StoryBeatPurposeSchema = z.enum(["setup", "rising", "turn", "climax", "payoff", "transition"]);
export const StoryBeatSchema = z.object({
  id: z.string(),
  order: z.number(),
  label: z.string(),
  summary: z.string().catch(""),
  purpose: StoryBeatPurposeSchema.catch("rising"),
  characterIds: z.array(z.string()).catch([]),
  threadIds: z.array(z.string()).catch([]),
  chapterId: z.string().optional(),
});
export type StoryBeat = z.infer<typeof StoryBeatSchema>;

export function decodeStoryBeats(raw: unknown): StoryBeat[] { /* decodeArray(raw, StoryBeatSchema, "beats") */ }
export function encodeStoryBeats(value: unknown): StoryBeat[] { /* z.array(StoryBeatSchema).parse(value) */ }
```
Reuses the existing `decodeArray` helper + the lenient-decode/strict-encode convention already in `story.ts`. Unit-tested alongside the existing story-guard tests.

### C. Director prompt — `src/lib/ai/prompts.ts` (add)

```ts
export function beatSheetSystemPrompt(format: string, characters: {id:string;name:string}[], threads: {id:string;name:string}[]): string
```
Instructs Claude (a Story Architect) to output **only JSON**: `{ "beats": [ { "label", "summary", "purpose", "characters": [names], "threads": [names] } ... ] }`. The route maps character/thread *names* back to ids (the model reasons in names; we persist ids), assigns `order` and a generated `id` per beat. Mirrors how `generate-package` already prompts for structured output + maps names to World Bible rows.

### D. Route — `src/app/api/projects/[projectId]/story-plans/route.ts`

- `GET` → list the project's story plans (newest first).
- `POST` → body `{ prompt?, title? }`. Loads project + characters + threads, calls Claude with `beatSheetSystemPrompt`, `safeParseJson`s the result, maps names→ids, assigns order+ids via `encodeStoryBeats`, inserts a `story_plans` row, returns it. Metered via the existing `meterAndGate(userId, "generate")` (planning is a generation-weight op) — confirm the helper name/path at implementation (`src/lib/metering`).
- `PATCH` → body `{ planId, title?, beats? }`. `beats` validated through `encodeStoryBeats` (400 on invalid), title optional. Ownership via project check.
- `DELETE` → body `{ planId }`.
- All guarded by `getRequiredSession` + project-ownership check (the established pattern). Gated to non-free tiers? No — outline/brainstorm are ungated, so beat sheet is ungated too (consistent with the Director planning modes).

### E. UI — `src/components/BeatSheetPanel.tsx` + Shape-stage surfacing

- Fetches `GET /api/projects/[id]/story-plans` on mount; shows the latest plan (or an empty state with a "Generate beat sheet" button + optional prompt).
- Renders beats as an ordered, editable list: each beat shows `label`, `purpose` (a small select), `summary` (editable textarea), linked character/thread chips. Edits debounce-PATCH the whole `beats` array (same debounce pattern as ComicStudio's panel edits).
- Each beat has **"✍️ Draft this →"** → calls the existing `onSelectMode("write")` + `setPrompt(beat.summary)` path (props already available in the Shape stage), so drafting a beat reuses the Writer flow with zero new generation plumbing.
- Surfaced in `StructureStageView` (the Shape stage body) above/below its existing content, gated to story formats (`isStoryFormat`).

## Data flow

```
POST /story-plans ─► beatSheetSystemPrompt ─► Claude ─► JSON beats ─► names→ids ─► encodeStoryBeats ─► story_plans row
BeatSheetPanel (Shape) ─► GET/PATCH ─► edit beats ─► "Draft this" ─► onSelectMode("write")+setPrompt ─► existing Writer flow
```

## Error handling

- Claude returns non-JSON → `safeParseJson` null → 500 "Couldn't structure a beat sheet, try a longer prompt" (mirrors `generate-package`/comics).
- `PATCH` with malformed `beats` → `encodeStoryBeats` throws → 400.
- `decodeStoryBeats` on read is lenient (drops bad beats, never throws) — a corrupt persisted plan still renders its valid beats.
- Panel fetch failure → empty state; never blocks the Shape view.

## Testing

1. **Beat guards** (extend `src/lib/types/__tests__/story.test.ts`): `decodeStoryBeats` drops malformed beats / falls back to `[]`; `encodeStoryBeats` strips unknown keys + throws on invalid; purpose coercion via `.catch`.
2. **Route** (`.../story-plans/__tests__/route.test.ts`): POST maps character/thread names→ids, assigns order, persists via encode; GET lists; PATCH validates beats (400 on bad); ownership 404; non-JSON Claude → 500. Mock Anthropic + db per the established convention (`vi.fn()` + `.mockResolvedValue`, never zero-arg `vi.fn(impl)`).
3. **Reachability:** add `BeatSheetPanel` to `live-shell-reachability.test.ts` MUST_BE_REACHABLE once wired into StructureStageView.
4. Full suite + `tsc --noEmit` green; no existing route/mode/test modified except additive schema + story.ts + StructureStageView.

## Files

- Modify: `src/db/schema.ts` (+ `storyPlans` table + relation) + new migration
- Modify: `src/lib/types/story.ts` (+ StoryBeat schema + decode/encode) + its test
- Modify: `src/lib/ai/prompts.ts` (+ `beatSheetSystemPrompt`)
- Create: `src/app/api/projects/[projectId]/story-plans/route.ts` + test
- Create: `src/components/BeatSheetPanel.tsx`
- Modify: `src/components/stages/StructureStageView.tsx` (mount BeatSheetPanel) + reachability test

## Success criteria

- A user in the Shape stage generates a structured beat sheet, edits beats, and drafts a beat into a chapter via the existing Writer flow.
- Beats persist as zod-guarded structured data; corrupt data degrades gracefully.
- `tsc` clean; full suite green; zero change to existing generation behavior.
