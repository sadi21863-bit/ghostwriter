/**
 * SQLite adapters for the character/location CRUD repository ports
 * (`handlers/characters.ts`, `handlers/locations.ts`) — the local-store tracer
 * described in docs/migration/phase3-prep.md §4. Line-for-line port of
 * `pg-character-location-repos.ts` over the sqlite-proxy baseline (`@/db/sqlite`),
 * with the two §4.2 degrade conventions applied:
 *
 * 1. `embedding` is never stored locally (pgvector columns are omitted from
 *    `sqlite-schema.ts`), so `create` strips it and `findScoped` with
 *    `onlyWithEmbedding` honestly returns an empty pool — duplicate detection
 *    then degrades to "no similar entities" with no cosine scan at all
 *    (`findSimilarEntities` filters non-array embeddings, so nothing soft-crashes).
 * 2. Imports come from `src/db/sqlite*` only. This file must never touch
 *    `@/db` (Neon) or `next*` — guarded by the source-purity test.
 */

import { and, eq, ne, type SQL } from "drizzle-orm";

import type { DrizzleSqliteDb } from "@/db/sqlite";
import { characters, locations, projects } from "@/db/sqlite-schema";
import type { CharacterCrudRepository, CharacterRow } from "@/lib/core/handlers/characters";
import type { LocationCrudRepository, LocationRow } from "@/lib/core/handlers/locations";

export function makeSqliteCharacterCrudRepository(db: DrizzleSqliteDb): CharacterCrudRepository {
  return {
    async ownsProject(projectId, actorId) {
      const row = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
        columns: { id: true },
      });
      return !!row;
    },

    async findProjectFormat(projectId, actorId) {
      const row = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
        columns: { format: true },
      });
      return (row?.format as string | undefined) ?? null;
    },

    async create(projectId, fields) {
      // `embedding` (computed by the host for pg) is intentionally dropped: the
      // column does not exist locally (§4.2 degrade), and unknown keys would
      // corrupt the INSERT column list.
      const rest = Object.fromEntries(
        Object.entries(fields).filter(([key]) => key !== "embedding"),
      );
      const [row] = await db
        .insert(characters)
        .values({ projectId, ...rest } as unknown as typeof characters.$inferInsert)
        .returning();
      return (row as CharacterRow | undefined) ?? null;
    },

    async findScoped(projectId, query) {
      if (query.onlyWithEmbedding) {
        return [];
      }
      const conditions: SQL[] = [];
      if (query.excludeId !== undefined) conditions.push(ne(characters.id, query.excludeId));
      const rows = await db.query.characters.findMany({
        where: and(eq(characters.projectId, projectId), ...conditions),
        columns: { id: true, name: true },
      });
      return rows as unknown as CharacterRow[];
    },

    async updateScoped(projectId, characterId, patch) {
      const rest = Object.fromEntries(
        Object.entries(patch).filter(([key]) => key !== "embedding"),
      );
      const [row] = await db
        .update(characters)
        .set(rest as unknown as typeof characters.$inferInsert)
        .where(and(eq(characters.id, characterId), eq(characters.projectId, projectId)))
        .returning();
      return (row as CharacterRow | undefined) ?? null;
    },

    async deleteScoped(projectId, characterId) {
      await db
        .delete(characters)
        .where(and(eq(characters.id, characterId), eq(characters.projectId, projectId)));
    },
  };
}

export function makeSqliteLocationCrudRepository(db: DrizzleSqliteDb): LocationCrudRepository {
  return {
    async ownsProject(projectId, actorId) {
      const row = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
        columns: { id: true },
      });
      return !!row;
    },

    async create(projectId, fields) {
      const rest = Object.fromEntries(
        Object.entries(fields).filter(([key]) => key !== "embedding"),
      );
      const [row] = await db
        .insert(locations)
        .values({ projectId, ...rest } as unknown as typeof locations.$inferInsert)
        .returning();
      return (row as LocationRow | undefined) ?? null;
    },

    async findScoped(projectId, query) {
      if (query.onlyWithEmbedding) {
        return [];
      }
      const conditions: SQL[] = [];
      if (query.excludeId !== undefined) conditions.push(ne(locations.id, query.excludeId));
      const rows = await db.query.locations.findMany({
        where: and(eq(locations.projectId, projectId), ...conditions),
        columns: { id: true, name: true },
      });
      return rows as unknown as LocationRow[];
    },

    async updateScoped(projectId, locationId, patch) {
      const rest = Object.fromEntries(
        Object.entries(patch).filter(([key]) => key !== "embedding"),
      );
      const [row] = await db
        .update(locations)
        .set(rest as unknown as typeof locations.$inferInsert)
        .where(and(eq(locations.id, locationId), eq(locations.projectId, projectId)))
        .returning();
      return (row as LocationRow | undefined) ?? null;
    },

    async deleteScoped(projectId, locationId) {
      await db
        .delete(locations)
        .where(and(eq(locations.id, locationId), eq(locations.projectId, projectId)));
    },
  };
}
