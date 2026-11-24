/**
 * SQLite adapter for the production-shot CRUD repository port
 * (`handlers/production-shots.ts`) — line-for-line port of
 * `pg-production-shot-repos.ts` over the sqlite-proxy baseline (`@/db/sqlite`),
 * in the same factory shape as the sibling tracer adapters
 * (docs/migration/phase3-prep.md §4).
 *
 * The REAL verb surface (verified against both consumers — the list/PATCH
 * handlers `handlers/production-shots.ts`, and `local-host.ts`'s `/shots` +
 * `/shots/:shotId` mounts): `ownsProject`, `list`, `findById`,
 * `updateScoped`. There is no create verb on this port — rows are seeded by
 * `generate-package`/`preview-all` (transport-coupled, still route-side) or by
 * tests, and the promote-branch/prompt-rebuild business rules all live in the
 * HANDLER over the generic port (the wave-4 comic lesson, seconded: mirroring
 * the adapter is bare `where/on orderBy/update` mechanics).
 *
 * One structural divergence, forced by the baseline: pg's `list` pulls
 * project + shots + the `primaryCharacter` relation in ONE relational query
 * (`with: { primaryCharacter: true }`). `sqlite-schema.ts` deliberately ships
 * no `relations()` blocks (see its header — "add relations when a handler that
 * consumes them migrates"), so the same read is re-expressed here as sibling
 * queries with the identical predicates the relation encodes — shots scoped
 * by `projectId`, ordered `(sceneNumber, shotNumber)` (the pre-migration GET's
 * exact order; the stitch/scene-video paths order by `(sortOrder, shotNumber)`
 * by design — do NOT "fix" the list ordering here, same guard as pg), and the
 * referenced characters fetched by id (`inArray`, guarded for the empty set —
 * drizzle refuses an empty `in()`) and attached per row under pg's relation
 * field name `primaryCharacter` (null when the FK is; a dangling id cannot
 * exist because the FK is `onDelete: set null` and `createSqliteDb` runs
 * `PRAGMA foreign_keys = ON` on every connection, so the set-null actually
 * fires locally the way it fires on the pg server). No JOIN executes anywhere
 * — folding shots × characters into a manual JOIN would multiply rows and hit
 * the duplicate-column object-mode merge the proxy's
 * `stmt.setReturnArrays(true)` guards elsewhere, and neither is a faithful
 * port (the comic adapter's `listWithPanels` re-expression precedent).
 *
 * No embedding handling on this cluster: nothing here carries a pgvector
 * column. `candidatePreviewUrls` round-trips typed through the baseline's
 * `text(mode: "json")` (jsonb → TEXT json discipline, §4.2);
 * `trimStartSec`/`trimEndSec` are real-numbered (nullable real);
 * `createdAt`/`updatedAt` are `integer(mode:"timestamp_ms")` — Date-in/Date-out,
 * zero conversion. Unknown patch keys stay reachable ONLY through
 * `updateScoped` because the handler filters them before this layer sees the
 * object — same "input arrives validated" contract pg has.
 *
 * The deletion predicates deliberately keep pg's refusals: `ownsProject` for
 * the actor, and every write/read scoped by BOTH id and projectId so a leaked
 * cross-project shotId is just "no row matched" (null → the handler's 404).
 *
 * Imports come from `src/db/sqlite*` only. This file must never touch `@/db`
 * (Neon) or `next*` — guarded by the source-purity test in
 * `__tests__/sqlite-production-shot-parity.test.ts`.
 */

import { and, asc, eq, inArray } from "drizzle-orm";

import type { DrizzleSqliteDb } from "@/db/sqlite";
import { characters, productionShots, projects } from "@/db/sqlite-schema";
import type {
  ProductionShotCrudRepository,
  ProductionShotRow,
} from "@/lib/core/handlers/production-shots";

export function makeSqliteProductionShotCrudRepository(
  db: DrizzleSqliteDb,
): ProductionShotCrudRepository {
  return {
    async ownsProject(projectId, actorId) {
      const row = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
        columns: { id: true },
      });
      return !!row;
    },

    /**
     * The pre-migration GET's exact read, re-expressed over the relation-less
     * baseline (see header). The primary-character attach key is pg's relation
     * field name, `primaryCharacter` — the GET body serializes it verbatim, and
     * the PATCH handler's prompt-rebuild never sees it.
     */
    async list(projectId) {
      const rows = await db.query.productionShots.findMany({
        where: eq(productionShots.projectId, projectId),
        orderBy: [asc(productionShots.sceneNumber), asc(productionShots.shotNumber)],
      });
      // Sibling relation load — by id, not by project (the FK's own scope;
      // a cross-project primaryCharacterId is impossible through every write
      // path, and code-scoping these would ADD a predicate pg's one-query read
      // doesn't have).
      const charIds = [
        ...new Set(rows.map((r) => r.primaryCharacterId).filter((id): id is string => !!id)),
      ];
      const charMap = new Map<string, typeof characters.$inferSelect>();
      if (charIds.length > 0) {
        const chars = await db.query.characters.findMany({
          where: inArray(characters.id, charIds),
        });
        for (const c of chars) charMap.set(c.id, c);
      }
      return rows.map((row) => ({
        ...row,
        primaryCharacter: row.primaryCharacterId ? (charMap.get(row.primaryCharacterId) ?? null) : null,
      })) as unknown as ProductionShotRow[];
    },

    async findById(projectId, shotId) {
      const row = await db.query.productionShots.findFirst({
        where: and(eq(productionShots.id, shotId), eq(productionShots.projectId, projectId)),
      });
      return (row as ProductionShotRow | undefined) ?? null;
    },

    async updateScoped(projectId, shotId, patch) {
      const [row] = await db
        .update(productionShots)
        .set(patch as unknown as typeof productionShots.$inferInsert)
        .where(and(eq(productionShots.id, shotId), eq(productionShots.projectId, projectId)))
        .returning();
      return (row as ProductionShotRow | undefined) ?? null;
    },
  };
}
