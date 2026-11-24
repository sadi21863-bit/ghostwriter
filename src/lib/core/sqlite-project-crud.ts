/**
 * SQLite adapter for the `ProjectsCoreRepository` port
 * (`src/lib/core/handlers/projects.ts`) — line-for-line port of
 * `pg-project-crud.ts` over the sqlite-proxy baseline (`@/db/sqlite`), in the
 * same factory shape as the sibling tracer adapters
 * (docs/migration/phase3-prep.md §4).
 *
 * The REAL verb surface of the port (verified against both consumers — the
 * cloud routes `api/projects/route.ts` + `api/projects/[projectId]/route.ts`,
 * and `local-host.ts`'s GET/POST /projects + GET/PATCH/DELETE
 * /projects/:projectId mounts): `ownsProject`, `listForUser`, `countForUser`,
 * `create`, `read`, `updateScoped`, `deleteScoped` — all seven ported. The
 * tier cap does NOT live in this layer: `getTier` is a handler PARAMETER
 * (each cloud route supplies the same `getUserTier` helper it always used;
 * the local host threads the `deps.getTier` slot), and this adapter's only
 * cap-facing verb is the light `countForUser` — exactly pg's shape.
 *
 * One structural divergence, forced by the baseline (the documented
 * re-expression the relationship adapter's header established): pg's
 * `listForUser`/`read` are RELATIONAL queries (`with: { chapters, characters
 * }` / the 9-relation graph read). `sqlite-schema.ts` deliberately ships no
 * `relations()` blocks, so both are re-expressed as sibling scoped queries
 * carrying the identical predicates the relations encode (child
 * `projectId` = the project(s) in scope):
 *  - `listForUser`: the actor's root rows, then one `inArray` chapter-stub
 *    query and one `inArray` character query over those ids, grouped by
 *    `projectId` — which is exactly what pg's relational builder does
 *    internally (root query + per-relation `IN (...)` fan-out, grouped).
 *  - `read`: the project row, then each of the 9 child tables with the
 *    identical `projectId` predicate. Chapters keep pg's `asc(sortOrder)`;
 *    every other child has no ORDER BY on pg either — DB row order on both
 *    engines.
 * A `with` call would throw on the relation-less builder, and folding two
 * child tables into one manual JOIN would multiply rows — neither is a
 * faithful port. All reads stay join-free, so the SQLite object-mode
 * duplicate-column hazard never applies to this read path (the proxy's
 * `setReturnArrays(true)` remains the standing guard for any future one —
 * stated, not fabricated, in the parity test).
 *
 * `create` is the same two NON-transactional inserts as pg (project row,
 * then its seeded `Chapter 1`) — never rolled back separately, then and
 * now. `projects` is the parent table of most FK cascades in the baseline
 * (characters/locations/chapters/worldEntities/plotThreads/referenceWorks/
 * storyMemories/characterRelationships/storyPromises all `onDelete:
 * cascade`, and `userId` cascades to the project row itself), and
 * `createSqliteDb` turns `PRAGMA foreign_keys = ON` on every connection, so
 * `deleteScoped` takes the children down the way the pg server does.
 *
 * jsonb → `text(mode: "json")` (`genres`, `dismissedGuideIds`, `aiRules`,
 * `intentionalViolations`): drizzle JSON-encodes on write and parses on
 * read, so core keeps the typed array/map and never sees the TEXT column.
 * The adapter performs NO decode of its own — verified against the pg
 * adapter, which passes jsonb through verbatim too (`aiRules` is encoded at
 * the route edge via `encodeAIRules` before the handler sees it; the zod
 * decoders stay in `src/lib/types/story.ts`). Dates are
 * `integer(mode: "timestamp_ms")` — Date-in/Date-out, zero conversion; the
 * handler-stamped `updatedAt` round-trips as a real Date.
 *
 * Two mechanical differences worth naming (both code-verified, both inert):
 *  - this baseline's `projects` declaration puts `genres` before `format`
 *    (pg's table declares `format` first), so `.returning()` row key ORDER
 *    differs between engines on that one swap. JSON key order is
 *    semantically inert — every consumer of these rows reads by name.
 *  - `universeId`/`seriesParentId`/`adaptedFromProjectId` are plain text
 *    columns here exactly as pg has bare uuid columns — no `.references()`
 *    exists on either engine, so no user/project delete order surprises.
 *
 * Imports come from `src/db/sqlite*` only. This file must never touch `@/db`
 * (Neon), `next*`, or the subscription module — the tier RESOLVER is
 * injected upstream (the route supplies `getUserTier`, whose `@/db`-import
 * stays out of core), guarded by the source-purity test in
 * `__tests__/sqlite-project-parity.test.ts`.
 */

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import type { DrizzleSqliteDb } from "@/db/sqlite";
import {
  characterRelationships as characterRelationshipsTable,
  chapters as chaptersTable,
  characters as charactersTable,
  locations as locationsTable,
  plotThreads as plotThreadsTable,
  projects,
  referenceWorks as referenceWorksTable,
  storyMemories as storyMemoriesTable,
  storyPromises as storyPromisesTable,
  worldEntities as worldEntitiesTable,
} from "@/db/sqlite-schema";
import type {
  ProjectGraphRow,
  ProjectInsertData,
  ProjectListRow,
  ProjectsCoreRepository,
} from "@/lib/core/handlers/projects";
import type { ProjectRow } from "@/lib/core/repositories";

/** The chapter/character stub shapes pg's `with:` list options produced. */
type ChapterStub = { id: string; title: string; wordCount: number | null; sortOrder: number | null };
type CharacterStub = { id: string; name: string };

export function makeSqliteProjectCrudRepository(db: DrizzleSqliteDb): ProjectsCoreRepository {
  return {
    async ownsProject(projectId, actorId) {
      const row = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
        columns: { id: true },
      });
      return !!row;
    },

    async listForUser(actorId) {
      // The pre-migration GET body: 9 project columns, chapter + character
      // stubs, newest-updated first, as a bare array. pg's single relational
      // read is re-expressed as sibling queries (see header): the root read
      // plus pg's own per-relation `IN (...)` fan-out, grouped per project.
      const rows = await db.query.projects.findMany({
        where: eq(projects.userId, actorId),
        columns: {
          id: true,
          name: true,
          format: true,
          genres: true,
          updatedAt: true,
          createdAt: true,
          skillLevel: true,
          isHiggsfieldProject: true,
          universeId: true,
        },
        orderBy: [desc(projects.updatedAt)],
      });
      // pg's fan-out never runs for an empty root set — neither does ours.
      if (rows.length === 0) return [];

      const projectIds = rows.map(r => r.id);
      // The exact child selections pg's `with` options carried — chapter
      // stub (id/title/wordCount/sortOrder), character stub (id/name). The
      // relation's join key (projectId) is selected for the grouping step
      // below and stripped on attach, reproducing pg's stub key sets
      // byte-for-byte (no extra `projectId` member on a stub row). No extra
      // ORDER BY (child rows in DB order, exactly like pg's fan-out).
      const chapterStubs = await db.query.chapters.findMany({
        where: inArray(chaptersTable.projectId, projectIds),
        columns: { id: true, projectId: true, title: true, wordCount: true, sortOrder: true },
      });
      const characterStubs = await db.query.characters.findMany({
        where: inArray(charactersTable.projectId, projectIds),
        columns: { id: true, projectId: true, name: true },
      });
      // The grouping step pg's relational builder performs after the fan-out.
      const chaptersByProject = new Map<string, ChapterStub[]>();
      for (const c of chapterStubs) {
        const { projectId, ...stub } = c;
        void projectId;
        const list = chaptersByProject.get(projectId) ?? [];
        list.push(stub);
        chaptersByProject.set(projectId, list);
      }
      const charactersByProject = new Map<string, CharacterStub[]>();
      for (const c of characterStubs) {
        const { projectId, ...stub } = c;
        void projectId;
        const list = charactersByProject.get(projectId) ?? [];
        list.push(stub);
        charactersByProject.set(projectId, list);
      }

      return rows.map((p) => ({
        ...p,
        chapters: chaptersByProject.get(p.id) ?? [],
        characters: charactersByProject.get(p.id) ?? [],
      })) as unknown as ProjectListRow[];
    },

    async countForUser(actorId) {
      // The tier cap's light count: id columns only.
      const rows = await db.query.projects.findMany({
        where: eq(projects.userId, actorId),
        columns: { id: true },
      });
      return rows.length;
    },

    async create(actorId, data: ProjectInsertData) {
      // The values the pre-migration POST inserted — `Chapter 1` seeded right
      // after the project row, never rolled back separately (same two
      // unordered inserts the route made).
      const [p] = await db
        .insert(projects)
        .values({
          userId: actorId,
          name: data.name,
          format: data.format,
          skillLevel: data.skillLevel,
          genres: data.genres,
          storyType: data.storyType,
          biggestChallenge: data.biggestChallenge,
        } as typeof projects.$inferInsert)
        .returning();
      await db.insert(chaptersTable).values({ projectId: p.id, title: "Chapter 1", sortOrder: 0 });
      return p as ProjectRow;
    },

    async read(projectId) {
      // The pre-migration GET-one graph read, byte-for-byte — the only change
      // is the WHERE (ownership was already proved by the handler's
      // `ownsProject` probe, matching the port contract). pg's single
      // relational read is re-expressed as sibling scoped reads (see header):
      // the project row, then each of the 9 relation tables with the
      // identical `projectId` predicate the relations encode — chapters
      // ordered by pg's `asc(sortOrder)`, the rest unordered (DB row order on
      // pg too).
      const row = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });
      // Vanished between the handler's ownsProject and this read — pg's
      // findFirst comes back undefined here too (null, never a TypeError).
      if (!row) return null;

      const chapters = await db.query.chapters.findMany({
        where: eq(chaptersTable.projectId, projectId),
        orderBy: [asc(chaptersTable.sortOrder)],
      });
      const characters = await db.query.characters.findMany({
        where: eq(charactersTable.projectId, projectId),
      });
      const locations = await db.query.locations.findMany({
        where: eq(locationsTable.projectId, projectId),
      });
      const plotThreads = await db.query.plotThreads.findMany({
        where: eq(plotThreadsTable.projectId, projectId),
      });
      const worldEntities = await db.query.worldEntities.findMany({
        where: eq(worldEntitiesTable.projectId, projectId),
      });
      const referenceWorks = await db.query.referenceWorks.findMany({
        where: eq(referenceWorksTable.projectId, projectId),
      });
      const storyMemories = await db.query.storyMemories.findMany({
        where: eq(storyMemoriesTable.projectId, projectId),
      });
      const characterRelationships = await db.query.characterRelationships.findMany({
        where: eq(characterRelationshipsTable.projectId, projectId),
      });
      const storyPromises = await db.query.storyPromises.findMany({
        where: eq(storyPromisesTable.projectId, projectId),
      });

      // Same attachment order pg's `with:` block lists: chapters first, then
      // the other 8 relation keys in their order.
      return {
        ...row,
        chapters,
        characters,
        locations,
        plotThreads,
        worldEntities,
        referenceWorks,
        storyMemories,
        characterRelationships,
        storyPromises,
      } as unknown as ProjectGraphRow;
    },

    async updateScoped(projectId, patch) {
      // Ownership is the handler's probe (the port contract); the WHERE here is
      // project-id only, exactly as the port specifies.
      const [row] = await db
        .update(projects)
        .set(patch as unknown as typeof projects.$inferInsert)
        .where(eq(projects.id, projectId))
        .returning();
      return (row as ProjectRow | undefined) ?? null;
    },

    async deleteScoped(projectId) {
      await db.delete(projects).where(eq(projects.id, projectId));
    },
  };
}
