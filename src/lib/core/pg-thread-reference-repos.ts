/**
 * Phase 2 / v4 §7 — Postgres adapter for the plot-thread / reference-work CRUD
 * ports (`src/lib/core/handlers/plot-threads.ts`, `.../reference-works.ts`).
 *
 * Lives in its own file — not `pg-repositories.ts` — so those adapter clusters
 * only need to be touched when their own slice changes; the layer rule is the
 * same: modules like this one are where `@/db` imports are allowed to live, and
 * every handler above stays transport-agnostic.
 *
 * `create` deliberately spreads the caller's data instead of copying field by
 * field: drizzle skips `undefined` values (column default) and inserts an
 * explicit `null` as null, which is exactly what the inlined routes did before
 * this migration — an omitted field keeps hitting the column default.
 */

import { db } from "@/db";
import { plotThreads, projects, referenceWorks } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type {
  PlotThreadCrudRepository,
  PlotThreadRow,
} from "@/lib/core/handlers/plot-threads";
import type {
  ReferenceWorkCrudRepository,
  ReferenceWorkRow,
} from "@/lib/core/handlers/reference-works";

export const pgPlotThreadRepository: PlotThreadCrudRepository = {
  async ownsProject(projectId, actorId) {
    const row = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
      columns: { id: true },
    });
    return !!row;
  },

  async create(projectId, data) {
    const [row] = await db
      .insert(plotThreads)
      .values({ projectId, ...data } as typeof plotThreads.$inferInsert)
      .returning();
    return row as PlotThreadRow;
  },

  async findScoped(projectId, threadId) {
    const row = await db.query.plotThreads.findFirst({
      where: and(eq(plotThreads.id, threadId), eq(plotThreads.projectId, projectId)),
    });
    return (row as PlotThreadRow | undefined) ?? null;
  },

  async updateScoped(projectId, threadId, patch) {
    const [row] = await db
      .update(plotThreads)
      .set(patch as typeof plotThreads.$inferInsert)
      .where(and(eq(plotThreads.id, threadId), eq(plotThreads.projectId, projectId)))
      .returning();
    return (row as PlotThreadRow | undefined) ?? null;
  },

  async deleteScoped(projectId, threadId) {
    await db
      .delete(plotThreads)
      .where(and(eq(plotThreads.id, threadId), eq(plotThreads.projectId, projectId)));
  },
};

export const pgReferenceWorkRepository: ReferenceWorkCrudRepository = {
  async ownsProject(projectId, actorId) {
    const row = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
      columns: { id: true },
    });
    return !!row;
  },

  async create(projectId, data) {
    // Reproduces the inlined route's conditional spread exactly: an omitted
    // `attributes` never enters the INSERT, so the jsonb default still applies.
    const [row] = await db
      .insert(referenceWorks)
      .values({
        projectId,
        title: data.title,
        ...(data.attributes !== undefined && { attributes: data.attributes }),
      } as typeof referenceWorks.$inferInsert)
      .returning();
    return row as ReferenceWorkRow;
  },

  async deleteScoped(projectId, refId) {
    await db
      .delete(referenceWorks)
      .where(and(eq(referenceWorks.id, refId), eq(referenceWorks.projectId, projectId)));
  },
};
