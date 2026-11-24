/**
 * Phase 2 / v4 §7 — Postgres adapter for the world-entity CRUD ports
 * (`src/lib/core/handlers/world-entities.ts`) and the intentional-violation
 * acknowledgement port (`.../intentional-violations.ts`).
 *
 * Lives in its own file — not `pg-repositories.ts` — so this cluster only
 * changes when its own slice changes; the layer rule is the same as
 * `pg-thread-reference-repos.ts`: `@/db` imports live here and every handler
 * above stays transport-agnostic.
 *
 * `create` deliberately spreads the caller's fields instead of copying them:
 * the handler (`worldEntityInsertFields`) already applied the column defaults,
 * and drizzle skips `undefined` values, which is what the inlined route did.
 * The intentional-violations jsonb column is typed clean by the schema
 * (`projects.intentionalViolations`), so reads/writes need no `any` casts.
 */

import { db } from "@/db";
import { projects, worldEntities } from "@/db/schema";
import { and, asc, eq, isNotNull, ne } from "drizzle-orm";
import type {
  FindWorldEntityQuery,
  WorldEntityCrudRepository,
  WorldEntityRow,
} from "@/lib/core/handlers/world-entities";
import type {
  IntentionalViolationMap,
  IntentionalViolationRepository,
} from "@/lib/core/handlers/intentional-violations";

export const pgWorldEntityRepository: WorldEntityCrudRepository = {
  async ownsProject(projectId, actorId) {
    const row = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
      columns: { id: true },
    });
    return !!row;
  },

  async create(projectId, fields) {
    const [row] = await db
      .insert(worldEntities)
      .values({ projectId, ...fields } as typeof worldEntities.$inferInsert)
      .returning();
    return (row as WorldEntityRow | undefined) ?? null;
  },

  /**
   * Project-scoped read ordered by (kind, sortOrder) — the order the Story
   * Bible UI groups world elements in. The duplicate-scan query reuses this
   * with kind/excludeId/onlyWithEmbedding narrowing.
   */
  async findScoped(projectId, query: FindWorldEntityQuery = {}) {
    const conditions = [eq(worldEntities.projectId, projectId)];
    if (query.kind) conditions.push(eq(worldEntities.kind, query.kind));
    if (query.excludeId) conditions.push(ne(worldEntities.id, query.excludeId));
    if (query.onlyWithEmbedding) conditions.push(isNotNull(worldEntities.embedding));
    const rows = await db.query.worldEntities.findMany({
      where: and(...conditions),
      orderBy: [asc(worldEntities.kind), asc(worldEntities.sortOrder)],
    });
    return rows as WorldEntityRow[];
  },

  async updateScoped(projectId, entityId, patch) {
    const [row] = await db
      .update(worldEntities)
      .set(patch as typeof worldEntities.$inferInsert)
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

export const pgIntentionalViolationRepository: IntentionalViolationRepository = {
  async ownsProject(projectId, actorId) {
    const row = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
      columns: { id: true },
    });
    return !!row;
  },

  /**
   * The `intentional_violations` jsonb column (`projects.intentionalViolations`
   * in the schema, `$type<Record<string, {confirmed, purpose, timestamp}>>`);
   * a null/stale value reads as the empty map, exactly like the route's
   * `|| {}` fallback did.
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
   * acknowledgement of the same violationType), single UPDATE.
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
