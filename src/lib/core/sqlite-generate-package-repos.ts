/**
 * SQLite adapter for the generate-package write half's genuinely-new seams
 * (`handlers/generate-package.ts`) — the §4 tracer factory shape, sibling to
 * `sqlite-production-shot-repos.ts`, whose header records why shot rows were
 * SEEDED until this slice: the cloud route's write pass (`runGeneratePackage`)
 * was transport-coupled, so no port carried a create verb. Phase 3 §2.5 stage
 * (d) part 2 extracted that write pass into a handler; THIS file answers the
 * two seams it needed that exist on NO repository port:
 *
 *  - `listChapters` — the chapter-title read the route got for free from its
 *    relational `with: { chapters: { orderBy: [asc(sortOrder)] } }`. No list
 *    verb exists on `ChapterRepository` (it grew from the PATCH/DELETE route's
 *    verbs only), so the handler declares this narrow seam instead of widening
 *    a shared port. Rising `sortOrder` order is part of the CONTRACT
 *    (duplicate lowercased titles resolve to the LAST row — the route's
 *    last-wins edge).
 *  - `shotWrites` — the fresh-slate wipe + the seeded bulk insert, verbatim
 *    predicates from the route: the wipe is unconditional per project; the
 *    insert is ONE statement with `.returning()` (per-row loops would change
 *    the write shape and the atomicity story on the pg side). An empty insert
 *    list is deliberately NOT guarded: both drivers refuse empty `.values()`
 *    with the same error, so the handler's "no invented guard" parity holds
 *    on either engine.
 *
 * `title` is `unknown`-typed toward the port because the port's consumer
 * guards non-string titles itself (the route's `any` read assumed the column's
 * NOT NULL); the adapter projects exactly (id, title) — the sqlite schema keeps
 * no embedding on this table, and nothing else in the write pass reads more.
 *
 * Imports come from `src/db/sqlite*` only. This file must never touch `@/db`
 * (Neon) or `next*` — the same purity rule as its sibling sqlite adapters.
 */

import { asc, eq } from "drizzle-orm";

import type { DrizzleSqliteDb } from "@/db/sqlite";
import { chapters, productionShots } from "@/db/sqlite-schema";
import type {
  DirectorShotInsert,
  GeneratePackageShotWrites,
} from "@/lib/core/handlers/generate-package";
import type { ProductionShotRow } from "@/lib/core/handlers/production-shots";

/** The two new seams, as one factory — the bundle composes them with the
 * character/location/project factories it already knows. */
export interface SqliteGeneratePackageWriteSeams {
  readonly listChapters: (
    projectId: string,
  ) => Promise<Array<{ id: string; title: unknown }>>;
  readonly shotWrites: GeneratePackageShotWrites;
}

export function makeSqliteGeneratePackageWriteSeams(
  db: DrizzleSqliteDb,
): SqliteGeneratePackageWriteSeams {
  return {
    async listChapters(projectId) {
      const rows = await db.query.chapters.findMany({
        where: eq(chapters.projectId, projectId),
        orderBy: [asc(chapters.sortOrder)],
        columns: { id: true, title: true },
      });
      return rows as unknown as Array<{ id: string; title: unknown }>;
    },

    shotWrites: {
      async deleteAllShots(projectId) {
        // Unconditional, project-scoped — the route's fresh-slate step verbatim
        // (it never matched-on-count, and neither does this).
        await db
          .delete(productionShots)
          .where(eq(productionShots.projectId, projectId));
      },

      async createAllShots(projectId, rows) {
        // One statement, one returning() — the route's bulk insert. Rows carry
        // their own projectId already (the handler stamps it); the adapter
        // re-asserts the scope here so a caller-constructed row can never write
        // across projects (same belt-and-braces as the sibling factories' verb
        // scoping).
        const values = rows.map((row) => ({ ...row, projectId }));
        const inserted = await db
          .insert(productionShots)
          .values(values as unknown as (typeof productionShots.$inferInsert)[])
          .returning();
        return inserted as unknown as ProductionShotRow[];
      },
    },
  };
}
