/**
 * SQLite adapter for the story-OS repository ports (`handlers/story-state.ts`,
 * `.../story-memories.ts`, `.../story-graph.ts`, `.../story-checkpoints.ts`,
 * `.../story-plans.ts`) — line-for-line port of `pg-story-os-repos.ts` over
 * the sqlite-proxy baseline (`@/db/sqlite`), one factory per pg object, in the
 * same shape as the sibling tracer adapters
 * (docs/migration/phase3-prep.md §4).
 *
 * REAL verb surface (code-verified against the handlers + the local host's
 * `/story-state`, `/story-memories`, `/story-graph`, `/checkpoints`, and
 * `/story-plans` mounts):
 *  - story-state: `ownsProject`/`findThreads`/`createThread`/`createPromise`/
 *    `updateThreadScoped`/`updatePromiseScoped` (the Promise Tracker pair);
 *  - story-memories: `ownsProject`/`findScoped`/`create`/`deleteScoped`
 *    (silent-zero-match delete, handler-owned hook);
 *  - story-graph: `ownsProject`/`readGraphData` (the read → build → health
 *    handler composes the pure builder over this data);
 *  - story-checkpoints: `ownsProject`/`readSnapshotInputs`/`findScoped`/
 *    `create`/`deleteScoped`;
 *  - story-plans: `ownsProject`/`findScoped`/`updateScoped`/`deleteScoped`
 *    (the POST stays transport-coupled by design).
 *
 * Relational re-expressions (the baseline ships no `relations()` blocks — see
 * its header; the relationship/comic/project adapters established the
 * sibling-query pattern, this file applies it three more times):
 *  1. story-state's `findThreads` — pg's `with: { promises: true }` becomes
 *     threads (scoped, ordered `createdAt` ASC) plus the joined promises
 *     fetched BY THREAD ID only (pg's relation joins on `storyPromises.threadId`
 *     without a promise-project predicate; the FK is `onDelete: set null`, so an
 *     unlinked promise attaches to no thread) and grouped under pg's relation
 *     field name `promises` per thread, `[]` when none.
 *  2. story-graph's `readGraphData` — pg's five-relation project read becomes
 *     a bare project probe plus five sibling `findMany`s carrying the exact
 *     predicates the relations encode (child `projectId` = this project), no
 *     `orderBy` (pg's relational spec orders nothing; DB row order on both
 *     engines), attached under pg's relation field names
 *     `characters`/`locations`/`plotThreads`/`chapters`/`worldEntities`. A
 *     vanished project reads as `{ project: null, storedRels }` — pg's own
 *     `?? null` shape, with `storedRels` still real (it's a separate read).
 *  3. story-checkpoints' `readSnapshotInputs` — the three projected child
 *     arrays (`CheckpointsSnapshotInputs`' exact columns) become sibling
 *     projected `findMany`s; null project returns null (pg's early return).
 *
 * Embedding note — the ONE sanctioned divergence, mirroring the
 * character-location/world-entity treatments: `story_promises` carries a
 * pgvector `embedding` column on Neon that the baseline OMITS ENTIRELY
 * (`sqlite-schema.ts`: "pg: vectorColumn(\"embedding\") — OMITTED"). The pg
 * adapter never writes it from here anyway (the write stays in
 * `updatePromiseEmbedding`, route-bound behind the handler's `embedSetup`
 * fire-and-forget seam), so no legitimate field ever carries an `embedding`
 * key — but a stray one would corrupt the INSERT column list here while
 * writing silently on pg. Create/update strip it (degraded-not-faked; local
 * promises are always un-embedded and `findLikelyPayoffChapters` honestly
 * finds nothing horizontally through this adapter's rows).
 *
 * jsonb payloads (`structuredData`, `snapshot`, `beats`) round-trip typed
 * through the baseline's `text(mode:"json")`; dates are
 * `integer(mode:"timestamp_ms")` (Date-in/Date-out).
 *
 * Imports come from `src/db/sqlite*` only. This file must never touch `@/db`
 * (Neon) or `next*` — guarded by the source-purity test in
 * `__tests__/sqlite-story-os-parity.test.ts`.
 */

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import type { DrizzleSqliteDb } from "@/db/sqlite";
import {
  characterRelationships,
  chapters,
  characters,
  locations,
  plotThreads,
  projects,
  storyCheckpoints,
  storyMemories,
  storyPlans,
  storyPromises,
  storyThreads,
  worldEntities,
} from "@/db/sqlite-schema";
import type {
  StoryStateRepository,
  StoryThreadRow,
  StoryPromiseRow,
} from "@/lib/core/handlers/story-state";
import type {
  StoryMemoryRepository,
  StoryMemoryRow,
} from "@/lib/core/handlers/story-memories";
import type {
  StoryGraphRepository,
  StoryGraphData,
  StoredRelationshipRow,
} from "@/lib/core/handlers/story-graph";
import type {
  StoryCheckpointRepository,
  StoryCheckpointRow,
  CheckpointSnapshotInputs,
} from "@/lib/core/handlers/story-checkpoints";
import type {
  StoryPlanRepository,
  StoryPlanRow,
} from "@/lib/core/handlers/story-plans";

/** The stray-embedding strip — see the header's Embedding note. */
function stripEmbedding(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).filter(([key]) => key !== "embedding"),
  );
}

export function makeSqliteStoryStateRepository(db: DrizzleSqliteDb): StoryStateRepository {
  return {
    async ownsProject(projectId, actorId) {
      const row = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
        columns: { id: true },
      });
      return !!row;
    },

    /**
     * The Promise Tracker GET's exact shape: threads oldest-first, each with
     * its promises (pg's relation field name) nested under every thread, so
     * the PromiseTrackerPanel renders identically locally. Promises are
     * fetched by thread id (see header #1), never project-filtered — the same
     * join-key semantics pg's relation has.
     */
    async findThreads(projectId) {
      const threads = await db.query.storyThreads.findMany({
        where: eq(storyThreads.projectId, projectId),
        orderBy: [asc(storyThreads.createdAt)],
      });
      const threadIds = threads.map((t) => t.id);
      const byThread = new Map<string, StoryPromiseRow[]>();
      if (threadIds.length > 0) {
        const promises = await db.query.storyPromises.findMany({
          where: inArray(storyPromises.threadId, threadIds),
        });
        for (const p of promises) {
          const list = byThread.get(p.threadId!) ?? [];
          list.push(p as unknown as StoryPromiseRow);
          byThread.set(p.threadId!, list);
        }
      }
      return threads.map((t) => ({
        ...t,
        promises: byThread.get(t.id) ?? [],
      })) as unknown as StoryThreadRow[];
    },

    async createThread(projectId, fields) {
      const [row] = await db
        .insert(storyThreads)
        .values({ projectId, ...fields } as typeof storyThreads.$inferInsert)
        .returning();
      return row as StoryThreadRow;
    },

    async createPromise(projectId, fields) {
      const [row] = await db
        .insert(storyPromises)
        .values(
          { projectId, ...stripEmbedding(fields) } as typeof storyPromises.$inferInsert,
        )
        .returning();
      return row as StoryPromiseRow;
    },

    async updateThreadScoped(projectId, threadId, patch) {
      const [row] = await db
        .update(storyThreads)
        .set(patch as unknown as typeof storyThreads.$inferInsert)
        .where(and(eq(storyThreads.id, threadId), eq(storyThreads.projectId, projectId)))
        .returning();
      return (row as StoryThreadRow | undefined) ?? null;
    },

    async updatePromiseScoped(projectId, promiseId, patch) {
      const [row] = await db
        .update(storyPromises)
        .set(stripEmbedding(patch) as unknown as typeof storyPromises.$inferInsert)
        .where(and(eq(storyPromises.id, promiseId), eq(storyPromises.projectId, projectId)))
        .returning();
      return (row as StoryPromiseRow | undefined) ?? null;
    },
  };
}

export function makeSqliteStoryMemoryRepository(db: DrizzleSqliteDb): StoryMemoryRepository {
  return {
    async ownsProject(projectId, actorId) {
      const row = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
        columns: { id: true },
      });
      return !!row;
    },

    /** Newest first — the GET order the Promise Tracker renders. */
    async findScoped(projectId) {
      const rows = await db.query.storyMemories.findMany({
        where: eq(storyMemories.projectId, projectId),
        orderBy: [desc(storyMemories.createdAt)],
      });
      return rows as unknown as StoryMemoryRow[];
    },

    async create(projectId, fields) {
      const [row] = await db
        .insert(storyMemories)
        .values({ projectId, ...fields } as typeof storyMemories.$inferInsert)
        .returning();
      return row as StoryMemoryRow;
    },

    /** Silent-zero-match (the original route's exact behaviour). */
    async deleteScoped(projectId, memoryId) {
      await db
        .delete(storyMemories)
        .where(and(eq(storyMemories.id, memoryId as string), eq(storyMemories.projectId, projectId)));
    },
  };
}

export function makeSqliteStoryGraphRepository(db: DrizzleSqliteDb): StoryGraphRepository {
  return {
    async ownsProject(projectId, actorId) {
      const row = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
        columns: { id: true },
      });
      return !!row;
    },

    /**
     * The pre-migration route's exact reads, re-expressed over the
     * relation-less baseline (header #2): the project probe + five sibling
     * loads — same set (every child whose projectId is this project, no extra
     * filter, no orderBy — DB row order on both engines), merged under pg's
     * relation field names (the full project row keeps its own columns, exactly
     * what the relational read emitted), then the stored character
     * relationships. pg's storedRels read is INDEPENDENT, so a vanished
     * project still returns the real `{ project: null, storedRels }` — the
     * `?? null` shape pg has — with the child arrays only ever attached to a
     * found project row.
     */
    async readGraphData(projectId): Promise<StoryGraphData> {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });
      const [characters_, locations_, plotThreads_, chapters_, worldEntities_] = await Promise.all([
        db.query.characters.findMany({ where: eq(characters.projectId, projectId) }),
        db.query.locations.findMany({ where: eq(locations.projectId, projectId) }),
        db.query.plotThreads.findMany({ where: eq(plotThreads.projectId, projectId) }),
        db.query.chapters.findMany({ where: eq(chapters.projectId, projectId) }),
        db.query.worldEntities.findMany({ where: eq(worldEntities.projectId, projectId) }),
      ]);
      const storedRels = (await db.query.characterRelationships.findMany({
        where: eq(characterRelationships.projectId, projectId),
      })) as unknown as StoredRelationshipRow[];
      return {
        project:
          project != null
            ? ({
                ...project,
                characters: characters_,
                locations: locations_,
                plotThreads: plotThreads_,
                chapters: chapters_,
                worldEntities: worldEntities_,
              } as unknown as StoryGraphData["project"])
            : null,
        storedRels,
      };
    },
  };
}

export function makeSqliteStoryCheckpointRepository(db: DrizzleSqliteDb): StoryCheckpointRepository {
  return {
    async ownsProject(projectId, actorId) {
      const row = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
        columns: { id: true },
      });
      return !!row;
    },

    /**
     * The health read's exact columns (see header #3): the project probe plus
     * three projected sibling loads. `pg`'s relational read carries the
     * projections INSIDE the project row; this twin returns the three arrays
     * directly — same data, same null-project contract, same `?? []` guards.
     */
    async readSnapshotInputs(projectId): Promise<CheckpointSnapshotInputs | null> {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
        columns: { id: true },
      });
      if (!project) return null;
      const [chapterRows, threadRows, promiseRows] = await Promise.all([
        db.query.chapters.findMany({
          where: eq(chapters.projectId, projectId),
          columns: { id: true, title: true, wordCount: true, arcPosition: true },
        }),
        db.query.plotThreads.findMany({
          where: eq(plotThreads.projectId, projectId),
          columns: { id: true, status: true, starvationWarning: true },
        }),
        db.query.storyPromises.findMany({
          where: eq(storyPromises.projectId, projectId),
          columns: { id: true, status: true },
        }),
      ]);
      return {
        chapters: chapterRows as unknown as CheckpointSnapshotInputs["chapters"],
        plotThreads: threadRows as unknown as CheckpointSnapshotInputs["plotThreads"],
        storyPromises: promiseRows as unknown as CheckpointSnapshotInputs["storyPromises"],
      };
    },

    async findScoped(projectId) {
      const rows = await db.query.storyCheckpoints.findMany({
        where: eq(storyCheckpoints.projectId, projectId),
        orderBy: [desc(storyCheckpoints.createdAt)],
      });
      return rows as unknown as StoryCheckpointRow[];
    },

    async create(projectId, fields) {
      const [row] = await db
        .insert(storyCheckpoints)
        .values({ projectId, ...fields } as typeof storyCheckpoints.$inferInsert)
        .returning();
      return row as StoryCheckpointRow;
    },

    /** Silent-zero-match (the original route's exact behaviour). */
    async deleteScoped(projectId, checkpointId) {
      await db
        .delete(storyCheckpoints)
        .where(
          and(
            eq(storyCheckpoints.id, checkpointId as string),
            eq(storyCheckpoints.projectId, projectId),
          ),
        );
    },
  };
}

export function makeSqliteStoryPlanRepository(db: DrizzleSqliteDb): StoryPlanRepository {
  return {
    async ownsProject(projectId, actorId) {
      const row = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
        columns: { id: true },
      });
      return !!row;
    },

    /** Newest first — the GET order the BeatSheet/plan UI renders. */
    async findScoped(projectId) {
      const rows = await db.query.storyPlans.findMany({
        where: eq(storyPlans.projectId, projectId),
        orderBy: [desc(storyPlans.createdAt)],
      });
      return rows as unknown as StoryPlanRow[];
    },

    async updateScoped(projectId, planId, patch) {
      const [row] = await db
        .update(storyPlans)
        .set(patch as unknown as typeof storyPlans.$inferInsert)
        .where(and(eq(storyPlans.id, planId), eq(storyPlans.projectId, projectId)))
        .returning();
      return (row as StoryPlanRow | undefined) ?? null;
    },

    /** Silent-zero-match (the original route's exact behaviour). */
    async deleteScoped(projectId, planId) {
      await db
        .delete(storyPlans)
        .where(and(eq(storyPlans.id, planId as string), eq(storyPlans.projectId, projectId)));
    },
  };
}
