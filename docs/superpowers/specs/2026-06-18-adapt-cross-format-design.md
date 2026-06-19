# Adapt: Cross-Format Story Conversion (v1: Novel → Screenplay)

**Status:** Approved, ready for implementation planning.
**Origin:** `ghostwriter-ux-workflow.md` Item 5 ("Cross-format conversion / 'Turn this into X'"), Execution Order step 5.

## Problem

Users with a finished Novel project have no way to turn it into a Screenplay (or other format) without manually re-typing/re-structuring everything in a brand new project. Research cited in the originating work order (LivingWriter, ComicInk/Lore Machine) validates demand for this pattern, with two hard constraints on doing it well:

1. Format conversion must be decomposed (narrative first, format conversion as a separate pass) — never a single one-shot whole-project re-prompt, or output gets superficial style with broken structure.
2. The converted version must be stored alongside the original, not replacing it — most of a novel won't survive verbatim into a script, and the user should be able to compare/keep both.

## Scope (v1)

Ship the **menu** with the full capability map visible, but only **one** working conversion: **Novel → Screenplay**. Every other target (Web Series, Comic, Higgsfield Series/Film, Novelization) appears in the same UI as a disabled "Coming soon" card, so the menu doesn't need rework when more targets ship later — only new conversion routes plus flipping `disabled: false` on that capability-map entry.

Out of scope for v1 (tracked for later, not blocking this spec): any conversion target besides Novel→Screenplay; Item 9 (terminal Guide state pointing at Adapt) — deferred until at least one real conversion exists to point to.

## Entry Point & UI

A new "🎭 Adapt this story →" button in `src/components/stages/ExportStageView.tsx`, gated by `isStoryFormat(project.format)` (same gate already used for the Comic Studio button there), positioned alongside the existing Export/Production Studio/Comic Studio buttons.

Clicking it opens a new `AdaptPanel` component (`src/components/AdaptPanel.tsx`), modal overlay — same visual pattern as `ExportPanel.tsx` (`position: fixed`, centered, `onClick`-outside-to-close).

**Capability map** (hardcoded client-side, not a backend concept):
```ts
const ADAPT_TARGETS: Record<string, { format: string; label: string; enabled: boolean }[]> = {
  Novel: [
    { format: "Screenplay", label: "Screenplay", enabled: true },
    { format: "Web Series", label: "Web Series", enabled: false },
    { format: "Comic", label: "Comic (use Comic Studio)", enabled: false },
    { format: "Higgsfield Series", label: "Higgsfield Series", enabled: false },
  ],
  Screenplay: [
    { format: "Comic", label: "Comic (use Comic Studio)", enabled: false },
    { format: "Higgsfield Series", label: "Higgsfield Film/Series", enabled: false },
    { format: "Novel", label: "Novelization", enabled: false },
  ],
  "Web Series": [
    { format: "Higgsfield Series", label: "Higgsfield Series", enabled: false },
    { format: "Comic", label: "Comic (use Comic Studio)", enabled: false },
  ],
};
```
`AdaptPanel` renders `ADAPT_TARGETS[project.format] ?? []` as a grid of cards; disabled cards show a "Coming soon" badge and don't respond to clicks.

**Preview (no API call):** Clicking the enabled "Screenplay" card shows, computed entirely from data already in the client (`project.chapters.length`):
> "This will convert **12 chapters** into a new Screenplay project. Estimated cost: **~12 generations** (1 per chapter) against your monthly limit."

with a "Start Conversion" button and a "Cancel" button (back to the capability grid).

## Data Model Change

One new column, one new migration:
```ts
adaptedFromProjectId: uuid("adapted_from_project_id"),
```
Added to the `projects` table in `src/db/schema.ts`, immediately after `seriesParentId` (same bare-uuid style, no `.references()` — consistent with how `seriesParentId`/`universeId` are already declared on this table, since cross-referencing a nullable self/foreign relationship with `onDelete` semantics isn't needed for an informational lineage pointer).

Displayed in the new project: a small line in `WritingRoom`'s header, next to the project name/format badge (`src/components/WritingRoom.tsx`, same row as `project.format`), reading "Adapted from: **{source project name}** →", linking to `/project/{adaptedFromProjectId}`. Only rendered when `project.adaptedFromProjectId` is set.

## Conversion Flow

**Step 1 — create target project + copy World Bible.**
`POST /api/projects/[sourceProjectId]/adapt` with body `{ targetFormat: "Screenplay" }`.

Server:
- Verifies ownership of the source project, verifies `targetFormat` is a valid enabled conversion for `source.format` (defense against a forged request targeting a disabled pair).
- Gates on `canAccessFeature(tier, "export")` (same tier check already used by `/export/blurb` and `/export/query-letter`) — 403 `{ error: "upgrade_required", feature: "export" }` if not entitled.
- Creates a new `projects` row: `format: targetFormat`, `name: "${source.name} (Screenplay)"`, `adaptedFromProjectId: source.id`, `storyType: "linear"` (an adaptation is its own standalone work, not automatically a series/universe member), `skillLevel` and `genres` copied from source.
- Copies `characters`, `locations`, `plotThreads` rows from source to new project: same field values, fresh `id`s, new `projectId`. Independent afterward — editing one project's World Bible never touches the other's.
- Does **not** create any chapters yet (that's step 2, per-chapter, metered individually).
- Returns `{ newProjectId }`.

**Step 2 — convert chapters one at a time (client-orchestrated loop).**
For each source chapter, sorted by `sortOrder`, the client calls:
`POST /api/projects/[newProjectId]/adapt-chapter` with body `{ sourceProjectId, sourceChapterId }`.

Server:
- Verifies ownership of both the source and target project (target must have `adaptedFromProjectId === sourceProjectId`, defending against converting into an unrelated project).
- Gates via `meterAndGate(userId, "adapt-chapter")`. New entry in `src/lib/metering/costs.ts`: `OPERATION_CREDITS["adapt-chapter"] = 1.0` (same weight as `"generate"` — one chapter conversion costs the same as one Write-mode generation, since it's one Claude call of comparable size).
- Loads source chapter content (plain text via `tiptapToPlainText` if TipTap JSON), builds a dedicated conversion prompt:
  - System: `STORY_FORMAT_RULES["Screenplay"]` (from `engine.ts`, reused verbatim — the same rules real Screenplay-format generation already follows) + an explicit conversion instruction ("Convert the following novel chapter into a screenplay scene. Preserve all narrative content, dialogue, and character actions — adapt the FORM, not the substance. Multiple INT./EXT. scene headings are expected if the source chapter spans more than one location or time.").
  - User message: the source chapter's plain text.
- Calls `anthropic.messages.create` directly (one-off call, mirroring the existing pattern in `/export/blurb` and `/export/query-letter` routes — this is a content-transformation task, not a fit for the `MODE_REGISTRY`/`MI` dispatch which is for generating new content from a prompt, not transforming existing content).
- On success: creates a new `chapters` row in the target project — `title` identical to the source chapter's title (1:1 mapping per the chapter-mapping decision above, so titles staying identical keeps the correspondence obvious), `content` = the converted screenplay text run through the existing `plainTextToTipTap()` (`src/lib/editor/content-migration.ts`) to produce valid TipTap JSON, `sortOrder` matching the source chapter's `sortOrder`, `wordCount` via the existing `getWordCount()` helper. Returns `{ chapterId, title, wordCount }`.
- On failure (Claude error, or `meterAndGate` returning a 429/403): calls `refundCredits(userId, "adapt-chapter")` if metering succeeded but the Claude call failed, and returns the error as-is (429 quota / 403 upgrade / 500 generic).

**Client loop behavior:** `AdaptPanel` calls step 2 sequentially (await each before starting the next — never parallel, to keep `sortOrder` creation deterministic and avoid bursting the rate limiter). Updates a progress indicator ("Converting chapter 4 of 12…") between calls. If any call fails:
- Stop the loop immediately (don't attempt remaining chapters).
- Show how many succeeded ("7 of 12 chapters converted") plus the specific error (upgrade prompt if 403/429, generic retry message otherwise).
- The new project is **not** deleted or rolled back — it's immediately open-able with whatever chapters did convert, and the user can re-open `AdaptPanel` later to resume (out of scope for v1 to build an explicit "resume" affordance; re-running step 1 again would currently create a *second* new project, which is an acceptable known limitation for v1, documented rather than silently wrong).

On full success: "✓ Done — Open Screenplay project →" linking to `/project/{newProjectId}`.

## Error Handling Summary

| Failure point | Behavior |
|---|---|
| Step 1 tier gate fails | 403 before any project/credits are touched; `AdaptPanel` shows the existing upgrade-prompt pattern |
| Step 1 succeeds, step 2 chapter 1 fails | New project exists but has zero chapters — still linked via `adaptedFromProjectId`, still usable (empty Screenplay project with copied World Bible) |
| Step 2 fails partway (quota hit at chapter N) | Chapters 1..N-1 already exist in the target project; loop stops; partial-progress message shown |
| Step 2 fails partway (Claude error, not quota) | Same stop-and-report behavior; `refundCredits` called so the failed chapter's reserved credit is returned |

## Testing

- `src/app/api/projects/[projectId]/adapt/__tests__/route.test.ts`: mocked db — verifies tier gate, verifies World Bible copy (characters/locations/plotThreads rows present in target with new ids), verifies rejection of an unsupported `targetFormat` for the source format.
- `src/app/api/projects/[projectId]/adapt-chapter/__tests__/route.test.ts`: mocked db + mocked Anthropic — verifies ownership check (target.adaptedFromProjectId must match), verifies metering call, verifies chapter creation with correct `sortOrder`, verifies `refundCredits` called on Claude failure.
- Existing `engine.test.ts` pattern extended if `STORY_FORMAT_RULES` access needs a new export (likely already exported/reachable, confirm during implementation).

## Explicitly Deferred (not in this spec)

- Item 9 (terminal Guide state) — wait until Novel→Screenplay ships and is real, then point the Guide's "you're done" message at it.
- Any conversion besides Novel→Screenplay.
- A "resume partial conversion" affordance.
- Showing original-vs-converted side by side in the UI (the new project is just a normal project; comparing requires opening both projects in separate tabs for v1).
