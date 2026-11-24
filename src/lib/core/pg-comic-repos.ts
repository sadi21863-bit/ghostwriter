/**
 * Postgres adapters for the comic page/panel CRUD repository ports
 * (`handlers/comics.ts`).
 *
 * Same conventions as `pg-character-location-repos.ts` — chained Drizzle reads
 * over `@/db`, ownership proved through the projects table scoped by the actor,
 * and every write carrying an explicit project scope. The handlers never see
 * Drizzle; this is the one place this layer meets the comic tables, so the
 * phase-3 local-store adapter has exactly these two bindings to replace.
 *
 * Note the create adapters merge the caller's `projectId` into the fields
 * explicitly (`{ projectId, ...fields }`), the way `pg-world-entity-repos.ts`
 * and `pg-thread-reference-repos.ts` do — the port hands the scope to the
 * adapter so the handler cannot forget it.
 */

import { db } from "@/db";
import { comicPages, comicPanels, projects } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type {
  ComicPageCrudRepository,
  ComicPageRow,
  ComicPanelCrudRepository,
  ComicPanelRow,
} from "@/lib/core/handlers/comics";

export const pgComicPageCrudRepository: ComicPageCrudRepository = {
  async ownsProject(projectId, actorId) {
    const row = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
      columns: { id: true },
    });
    return !!row;
  },

  async countByProject(projectId) {
    const rows = await db.query.comicPages.findMany({
      where: eq(comicPages.projectId, projectId),
      columns: { id: true },
    });
    return rows.length;
  },

  async listWithPanels(projectId) {
    const rows = await db.query.comicPages.findMany({
      where: eq(comicPages.projectId, projectId),
      with: { panels: { orderBy: (p, { asc }) => [asc(p.panelIndex)] } },
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });
    return rows as unknown as ComicPageRow[];
  },

  async create(projectId, fields) {
    const [row] = await db
      .insert(comicPages)
      .values({ projectId, ...fields } as unknown as typeof comicPages.$inferInsert)
      .returning();
    return (row as ComicPageRow | undefined) ?? null;
  },

  async deleteScoped(projectId, pageId) {
    await db
      .delete(comicPages)
      .where(and(eq(comicPages.id, pageId), eq(comicPages.projectId, projectId)));
  },
};

export const pgComicPanelCrudRepository: ComicPanelCrudRepository = {
  async ownsProject(projectId, actorId) {
    const row = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
      columns: { id: true },
    });
    return !!row;
  },

  async findScoped(projectId, panelId) {
    const row = await db.query.comicPanels.findFirst({
      where: and(eq(comicPanels.id, panelId), eq(comicPanels.projectId, projectId)),
    });
    return (row as ComicPanelRow | undefined) ?? null;
  },

  async create(projectId, fields) {
    const [row] = await db
      .insert(comicPanels)
      .values({ projectId, ...fields } as unknown as typeof comicPanels.$inferInsert)
      .returning();
    return (row as ComicPanelRow | undefined) ?? null;
  },

  async updateScoped(projectId, panelId, patch) {
    const [row] = await db
      .update(comicPanels)
      .set(patch as unknown as typeof comicPanels.$inferInsert)
      .where(and(eq(comicPanels.id, panelId), eq(comicPanels.projectId, projectId)))
      .returning();
    return (row as ComicPanelRow | undefined) ?? null;
  },
};
