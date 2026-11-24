/**
 * Postgres adapters for the character/location CRUD repository ports
 * (`handlers/characters.ts`, `handlers/locations.ts`).
 *
 * Same conventions as `pg-repositories.ts` â€” chained Drizzle selects over
 * `@/db`, ownership proved through the projects table scoped by the actor, and
 * every write carrying an explicit project scope. The handlers above never see
 * Drizzle; this is the one place this layer meets the tables, so the phrase-3
 * local-store adapter has exactly these two bindings to replace.
 */

import { db } from "@/db";
import { characters, locations, projects } from "@/db/schema";
import { and, eq, isNotNull, ne, type SQL } from "drizzle-orm";
import type {
  CharacterCrudRepository,
  CharacterRow,
} from "@/lib/core/handlers/characters";
import type {
  LocationCrudRepository,
  LocationRow,
} from "@/lib/core/handlers/locations";

export const pgCharacterCrudRepository: CharacterCrudRepository = {
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
    const [row] = await db
      .insert(characters)
      .values({ projectId, ...fields } as unknown as typeof characters.$inferInsert)
      .returning();
    return (row as CharacterRow | undefined) ?? null;
  },

  async findScoped(projectId, query) {
    const conditions: SQL[] = [];
    if (query.excludeId !== undefined) conditions.push(ne(characters.id, query.excludeId));
    if (query.onlyWithEmbedding) conditions.push(isNotNull(characters.embedding));
    const rows = await db.query.characters.findMany({
      where: and(eq(characters.projectId, projectId), ...conditions),
      columns: { id: true, name: true, embedding: true },
    });
    return rows as unknown as CharacterRow[];
  },

  async updateScoped(projectId, characterId, patch) {
    const [row] = await db
      .update(characters)
      .set(patch as unknown as typeof characters.$inferInsert)
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

export const pgLocationCrudRepository: LocationCrudRepository = {
  async ownsProject(projectId, actorId) {
    const row = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
      columns: { id: true },
    });
    return !!row;
  },

  async create(projectId, fields) {
    const [row] = await db
      .insert(locations)
      .values({ projectId, ...fields } as unknown as typeof locations.$inferInsert)
      .returning();
    return (row as LocationRow | undefined) ?? null;
  },

  async findScoped(projectId, query) {
    const conditions: SQL[] = [];
    if (query.excludeId !== undefined) conditions.push(ne(locations.id, query.excludeId));
    if (query.onlyWithEmbedding) conditions.push(isNotNull(locations.embedding));
    const rows = await db.query.locations.findMany({
      where: and(eq(locations.projectId, projectId), ...conditions),
      columns: { id: true, name: true, embedding: true },
    });
    return rows as unknown as LocationRow[];
  },

  async updateScoped(projectId, locationId, patch) {
    const [row] = await db
      .update(locations)
      .set(patch as unknown as typeof locations.$inferInsert)
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
