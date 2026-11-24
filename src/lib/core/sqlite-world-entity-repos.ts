/**
 * SQLite adapters for the world-entity CRUD repository port
 * (`handlers/world-entities.ts`) and the intentional-violation acknowledgement
 * port (`handlers/intentional-violations.ts`) — line-for-line port of
 * `pg-world-entity-repos.ts` over the sqlite-proxy baseline (`@/db/sqlite`),
 * in the same factory shape as the first two tracer pairs
 * (docs/migration/phase3-prep.md §4).
 *
 * Embedding degradation — the ONE sanctioned divergence, identical to the
 * sibling `sqlite-character-location-repos.ts` pair: `world_entities` carries
 * a pgvector `embedding` column on Neon that the local baseline omits entirely
 * (§4.2/§5.3 — vector features honestly OFF, no placeholder column), so
 *  - `create`/`updateScoped` strip any `embedding` key (an unknown key would
 *    corrupt the INSERT/UPDATE column list; the handler always threads one —
 *    `null` from the default no-embed seam — which is dropped too),
 *  - `findScoped` short-circuits `onlyWithEmbedding: true` to `[]` (an empty
 *    duplicate-scan pool: nothing was ever embedded here), and
 *  - `findSimilarEntities` (`src/lib/world-bible/duplicate-detection.ts`,
 *    called by the handler) therefore filters every candidate out — cosine
 *    duplicate detection finds NOTHING, with no soft crash. Degraded, not
 *    faked.
 *
 * The `world_entities.properties` jsonb round-trips through the baseline's
 * `text(mode: "json")` translation like every other jsonb column: drizzle
 * JSON-encodes on write and parses on read, so core keeps the typed object
 * and never sees the TEXT column. Verified against `pg-world-entity-repos.ts`
 * — the pg adapter performs NO zod decode of its own either; the route already
 * normalized `kind` through `WorldEntityKindSchema` and encoded `properties`
 * through `encodeWorldEntityProperties` (both in `src/lib/types/story.ts`)
 * before the handler saw them, so this adapter passes through verbatim and
 * does not reimplement that validation.
 *
 * `intentionalViolations` is NOT a second table: it lives on the `projects`
 * row (an acknowledgement map keyed by violationType). The sqlite baseline
 * carries the same `$type<Record<...>>()` json column, so the read/merge/write
 * verbs are cast-free and a null/stale value reads as the empty map, exactly
 * like pg — the port exposes only those three verbs (no resolve/delete
 * lifecycle exists upstream of this adapter either).
 *
 * Imports come from `src/db/sqlite*` only. This file must never touch `@/db`
 * (Neon) or `next*` — guarded by the source-purity test in
 * `__tests__/sqlite-world-entity-parity.test.ts`.
 */

import { and, asc, eq, ne, type SQL } from "drizzle-orm";

import type { DrizzleSqliteDb } from "@/db/sqlite";
import { projects, worldEntities } from "@/db/sqlite-schema";
import type {
  FindWorldEntityQuery,
  WorldEntityCrudRepository,
  WorldEntityRow,
} from "@/lib/core/handlers/world-entities";
import type {
  IntentionalViolationMap,
  IntentionalViolationRepository,
} from "@/lib/core/handlers/intentional-violations";

export function makeSqliteWorldEntityCrudRepository(
  db: DrizzleSqliteDb,
): WorldEntityCrudRepository {
  return {
    async ownsProject(projectId, actorId) {
      const row = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
        columns: { id: true },
      });
      return !!row;
    },

    async create(projectId, fields) {
      // §4.2 degrade: an embedding computed for pg is never stored locally —
      // strip it before it corrupts the INSERT column list.
      const rest = Object.fromEntries(
        Object.entries(fields).filter(([key]) => key !== "embedding"),
      );
      const [row] = await db
        .insert(worldEntities)
        .values({ projectId, ...rest } as unknown as typeof worldEntities.$inferInsert)
        .returning();
      return (row as WorldEntityRow | undefined) ?? null;
    },

    /**
     * Project-scoped read ordered by (kind, sortOrder) — the order the Story
     * Bible UI groups world elements in. The duplicate-scan query reuses this
     * with kind/excludeId/onlyWithEmbedding narrowing; with
     * `onlyWithEmbedding` set it short-circuits to an empty pool (the pg twin
     * isNotNull-filters its vector column; this baseline has no such column
     * to filter, so "nothing embedded" is the honest result).
     */
    async findScoped(projectId, query: FindWorldEntityQuery = {}) {
      if (query.onlyWithEmbedding) {
        return [];
      }
      const conditions: SQL[] = [eq(worldEntities.projectId, projectId)];
      if (query.kind) conditions.push(eq(worldEntities.kind, query.kind));
      if (query.excludeId) conditions.push(ne(worldEntities.id, query.excludeId));
      const rows = await db.query.worldEntities.findMany({
        where: and(...conditions),
        orderBy: [asc(worldEntities.kind), asc(worldEntities.sortOrder)],
      });
      return rows as unknown as WorldEntityRow[];
    },

    async updateScoped(projectId, entityId, patch) {
      // Same strip as `create`: an `embedding` in the patch has no local
      // column to land in.
      const rest = Object.fromEntries(
        Object.entries(patch).filter(([key]) => key !== "embedding"),
      );
      const [row] = await db
        .update(worldEntities)
        .set(rest as unknown as typeof worldEntities.$inferInsert)
        .where(and(eq(worldEntities.id, entityId), eq(worldEntities.projectId, projectId)))
        .returning();
      return (row as WorldEntityRow | undefined) ?? null;
    },

    async deleteScoped(projectId, entityId) {
      await db
        .delete(worldEntities)
        .where(and(eq(worldEntities.id, entityId), eq(worldEntities.projectId, projectId)));
    },
  };
}

export function makeSqliteIntentionalViolationRepository(
  db: DrizzleSqliteDb,
): IntentionalViolationRepository {
  return {
    async ownsProject(projectId, actorId) {
      const row = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
        columns: { id: true },
      });
      return !!row;
    },

    /**
     * The `intentional_violations` json column (`projects.intentionalViolations`
     * in `sqlite-schema.ts`, `$type<Record<string, {confirmed, purpose,
     * timestamp}>>` like pg); a null/stale value reads as the empty map,
     * exactly like the route's `|| {}` fallback did.
     */
    async readAcknowledgements(projectId) {
      const row = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
        columns: { intentionalViolations: true },
      });
      return (row?.intentionalViolations ?? {}) as IntentionalViolationMap;
    },

    /**
     * Read-modify-write in ONE update, mirroring the pre-migration POST's write
     * mechanics: find the stored map, set the new key (overwriting a previous
     * acknowledgement of the same violationType — that IS the dedupe
     * semantics), single UPDATE.
     */
    async recordAcknowledgement(projectId, payload) {
      const row = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
        columns: { intentionalViolations: true },
      });
      const existing = (row?.intentionalViolations ?? {}) as IntentionalViolationMap;
      const merged: IntentionalViolationMap = {
        ...existing,
        [payload.violationType]: payload.entry,
      };
      await db
        .update(projects)
        .set({ intentionalViolations: merged })
        .where(eq(projects.id, projectId));
    },
  };
}
