/**
 * Postgres adapter for the production-shot CRUD repository port
 * (`handlers/production-shots.ts`).
 *
 * Same conventions as `pg-character-location-repos.ts` — chained Drizzle
 * queries over `@/db`, ownership proved through the projects table scoped by
 * the actor, and every write carrying an explicit project scope so a leaked
 * shotId from another project is just "no row matched". The handler never sees
 * Drizzle; this is the one place this layer meets the `production_shots` table.
 */

import { db } from "@/db";
import { productionShots, projects } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type {
  ProductionShotCrudRepository,
  ProductionShotRow,
} from "@/lib/core/handlers/production-shots";

export const pgProductionShotCrudRepository: ProductionShotCrudRepository = {
  async ownsProject(projectId, actorId) {
    const row = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
      columns: { id: true },
    });
    return !!row;
  },

  async list(projectId) {
    // Byte-identical to the pre-migration GET: primaryCharacter joined in,
    // ordered (sceneNumber, shotNumber). The stitch/scene-video paths order by
    // (sortOrder, shotNumber) by design — do NOT "fix" the list ordering here.
    const rows = await db.query.productionShots.findMany({
      where: eq(productionShots.projectId, projectId),
      with: { primaryCharacter: true },
      orderBy: (t, { asc }) => [asc(t.sceneNumber), asc(t.shotNumber)],
    });
    return rows as unknown as ProductionShotRow[];
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
