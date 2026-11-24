/**
 * Phase 2 / v4 §7 — Postgres adapter for the story-OS CRUD repository ports
 * (`handlers/story-state.ts`, `.../story-memories.ts`, `.../story-graph.ts`,
 * `.../story-checkpoints.ts`, `.../story-plans.ts`).
 *
 * Same conventions as `pg-character-location-repos.ts` — chained Drizzle reads
 * over `@/db`, ownership proved through the projects table scoped by the actor,
 * and every write carrying an explicit project scope. The handlers never see
 * Drizzle; this is the one place this layer meets the story-OS tables, so the
 * phase-3 local-store adapter has exactly these bindings to replace.
 *
 * Embedding note: `storyPromises.embedding` (pgvector) is NOT written here —
 * the write deliberately stays in `updatePromiseEmbedding`
 * (`src/lib/story/promise-cross-reference.ts`), which the route binds into the
 * handler's `embedSetup` fire-and-forget seam exactly as it called it inline
 * before this migration. `storyThreads` has no embedding column at all. The
 * created promise row therefore returns without an embedding (filled moments
 * later by the background update), byte-identical to the pre-migration
 * response.
 */

import { db } from "@/db";
import {
  characterRelationships,
  projects,
  storyCheckpoints,
  storyMemories,
  storyPlans,
  storyPromises,
  storyThreads,
} from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
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

export const pgStoryStateRepository: StoryStateRepository = {
  async ownsProject(projectId, actorId) {
    const row = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
      columns: { id: true },
    });
    return !!row;
  },

  async findThreads(projectId) {
    const rows = await db.query.storyThreads.findMany({
      where: eq(storyThreads.projectId, projectId),
      with: { promises: true },
      orderBy: (t, { asc: ascOrder }) => [ascOrder(t.createdAt)],
    });
    return rows as unknown as StoryThreadRow[];
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
      .values({ projectId, ...fields } as typeof storyPromises.$inferInsert)
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
      .set(patch as unknown as typeof storyPromises.$inferInsert)
      .where(and(eq(storyPromises.id, promiseId), eq(storyPromises.projectId, projectId)))
      .returning();
    return (row as StoryPromiseRow | undefined) ?? null;
  },
};

export const pgStoryMemoryRepository: StoryMemoryRepository = {
  async ownsProject(projectId, actorId) {
    const row = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
      columns: { id: true },
    });
    return !!row;
  },

  async findScoped(projectId) {
    const rows = await db.query.storyMemories.findMany({
      where: eq(storyMemories.projectId, projectId),
      orderBy: (m, { desc: descOrder }) => [descOrder(m.createdAt)],
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

  async deleteScoped(projectId, memoryId) {
    await db
      .delete(storyMemories)
      .where(and(eq(storyMemories.id, memoryId as string), eq(storyMemories.projectId, projectId)));
  },
};

export const pgStoryGraphRepository: StoryGraphRepository = {
  async ownsProject(projectId, actorId) {
    const row = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
      columns: { id: true },
    });
    return !!row;
  },

  /**
   * The pre-migration route's exact reads: the full project row with the graph's
   * relations (scoped by id only — ownership was already proved), plus the
   * stored character relationships. Null project = vanished between the two.
   */
  async readGraphData(projectId): Promise<StoryGraphData> {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      with: { characters: true, locations: true, plotThreads: true, chapters: true, worldEntities: true },
    });
    const storedRels = (await db.query.characterRelationships.findMany({
      where: eq(characterRelationships.projectId, projectId),
    })) as unknown as StoredRelationshipRow[];
    return { project: (project as Record<string, unknown>) ?? null, storedRels };
  },
};

export const pgStoryCheckpointRepository: StoryCheckpointRepository = {
  async ownsProject(projectId, actorId) {
    const row = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
      columns: { id: true },
    });
    return !!row;
  },

  /** The health read's exact columns — no more data than the formula consumes. */
  async readSnapshotInputs(projectId): Promise<CheckpointSnapshotInputs | null> {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      with: {
        chapters: { columns: { id: true, title: true, wordCount: true, arcPosition: true } },
        plotThreads: { columns: { id: true, status: true, starvationWarning: true } },
        storyPromises: { columns: { id: true, status: true } },
      },
    });
    if (!project) return null;
    const proj = project as unknown as CheckpointSnapshotInputs;
    return {
      chapters: proj.chapters ?? [],
      plotThreads: proj.plotThreads ?? [],
      storyPromises: proj.storyPromises ?? [],
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

export const pgStoryPlanRepository: StoryPlanRepository = {
  async ownsProject(projectId, actorId) {
    const row = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
      columns: { id: true },
    });
    return !!row;
  },

  async findScoped(projectId) {
    const rows = await db.query.storyPlans.findMany({
      where: eq(storyPlans.projectId, projectId),
      orderBy: (p, { desc: descOrder }) => [descOrder(p.createdAt)],
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

  async deleteScoped(projectId, planId) {
    await db
      .delete(storyPlans)
      .where(and(eq(storyPlans.id, planId as string), eq(storyPlans.projectId, projectId)));
  },
};
