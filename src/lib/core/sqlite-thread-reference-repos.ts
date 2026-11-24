/**
 * SQLite adapters for the plot-thread / reference-work CRUD repository ports
 * (`handlers/plot-threads.ts`, `handlers/reference-works.ts`) — line-for-line
 * port of `pg-thread-reference-repos.ts` over the sqlite-proxy baseline
 * (`@/db/sqlite`), in the same factory shape as the sibling
 * `sqlite-character-location-repos.ts` tracer pair (docs/migration/
 * phase3-prep.md §4).
 *
 * No embedding handling on this pair: neither `plot_threads` nor
 * `reference_works` carries a pgvector column, so there is nothing to strip
 * or degrade (§4.2's vector quirks do not apply here).
 *
 * The reference-work `attributes` jsonb column round-trips through the
 * baseline's `text(mode: "json")` convention: drizzle JSON-encodes on write
 * and parses on read, so a caller's typed object (or array — the pg column is
 * untyped) survives the TEXT storage; core never sees a string.
 *
 * `create` deliberately spreads the caller's data instead of copying field by
 * field (same as pg): drizzle skips `undefined` values, so an omitted field
 * keeps hitting the column default — SQLite applies the vendored DDL defaults
 * (`'', 'Active', '{}'`) exactly where pg applied its schema defaults.
 *
 * Imports come from `src/db/sqlite*` only. This file must never touch `@/db`
 * (Neon) or `next*` — guarded by the source-purity tests.
 */

import { and, eq } from "drizzle-orm";

import type { DrizzleSqliteDb } from "@/db/sqlite";
import { plotThreads, projects, referenceWorks } from "@/db/sqlite-schema";
import type {
  PlotThreadCrudRepository,
  PlotThreadRow,
} from "@/lib/core/handlers/plot-threads";
import type {
  ReferenceWorkCrudRepository,
  ReferenceWorkRow,
} from "@/lib/core/handlers/reference-works";

export function makeSqlitePlotThreadCrudRepository(db: DrizzleSqliteDb): PlotThreadCrudRepository {
  return {
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
        .values({ projectId, ...data } as unknown as typeof plotThreads.$inferInsert)
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
        .set(patch as unknown as typeof plotThreads.$inferInsert)
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
}

export function makeSqliteReferenceWorkCrudRepository(
  db: DrizzleSqliteDb,
): ReferenceWorkCrudRepository {
  return {
    async ownsProject(projectId, actorId) {
      const row = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
        columns: { id: true },
      });
      return !!row;
    },

    async create(projectId, data) {
      // Reproduces the pg adapter's conditional spread exactly: an omitted
      // `attributes` never enters the INSERT, so the jsonb default still
      // applies — locally that is the vendored DDL's `'{}'` default, decoded
      // back into a typed empty object on read.
      const [row] = await db
        .insert(referenceWorks)
        .values({
          projectId,
          title: data.title,
          ...(data.attributes !== undefined && { attributes: data.attributes }),
        } as unknown as typeof referenceWorks.$inferInsert)
        .returning();
      return row as ReferenceWorkRow;
    },

    async deleteScoped(projectId, refId) {
      await db
        .delete(referenceWorks)
        .where(and(eq(referenceWorks.id, refId), eq(referenceWorks.projectId, projectId)));
    },
  };
}
