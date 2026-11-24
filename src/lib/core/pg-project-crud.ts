/**
 * Postgres adapter for the `ProjectsCoreRepository` port
 * (`src/lib/core/handlers/projects.ts`).
 *
 * A sibling of `pg-repositories.ts` (which stays untouched): this module is the
 * only other place allowed to import `@/db` for the projects CRUD, and every
 * query below mirrors the pre-migration route's query verbatim — same columns,
 * same `with` shapes, same ordering — minus the ownership `eq` that moved to
 * `ownsProject` (probed by the handler before the scoped methods run).
 */

import { db } from "@/db";
import { chapters, projects } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type {
  ProjectGraphRow,
  ProjectInsertData,
  ProjectListRow,
  ProjectsCoreRepository,
} from "@/lib/core/handlers/projects";
import type { ProjectRow } from "@/lib/core/repositories";

export const pgProjectCrudRepository: ProjectsCoreRepository = {
  async ownsProject(projectId, actorId) {
    const row = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
      columns: { id: true },
    });
    return !!row;
  },

  async listForUser(actorId) {
    // The pre-migration GET body: 9 project columns, chapter + character
    // stubs, newest-updated first, as a bare array.
    const rows = await db.query.projects.findMany({
      where: eq(projects.userId, actorId),
      columns: {
        id: true,
        name: true,
        format: true,
        genres: true,
        updatedAt: true,
        createdAt: true,
        skillLevel: true,
        isHiggsfieldProject: true,
        universeId: true,
      },
      with: {
        chapters: { columns: { id: true, title: true, wordCount: true, sortOrder: true } },
        characters: { columns: { id: true, name: true } },
      },
      orderBy: (p, { desc }) => [desc(p.updatedAt)],
    } as never);
    return rows as unknown as ProjectListRow[];
  },

  async countForUser(actorId) {
    // The tier cap's light count: id columns only.
    const rows = await db.query.projects.findMany({
      where: eq(projects.userId, actorId),
      columns: { id: true },
    });
    return rows.length;
  },

  async create(actorId, data: ProjectInsertData) {
    // The values the pre-migration POST inserted — `Chapter 1` seeded right
    // after the project row, never rolled back separately (same two
    // unordered inserts the route made).
    const [p] = await db
      .insert(projects)
      .values({
        userId: actorId,
        name: data.name,
        format: data.format,
        skillLevel: data.skillLevel,
        genres: data.genres,
        storyType: data.storyType,
        biggestChallenge: data.biggestChallenge,
      } as typeof projects.$inferInsert)
      .returning();
    await db.insert(chapters).values({ projectId: p.id, title: "Chapter 1", sortOrder: 0 });
    return p as ProjectRow;
  },

  async read(projectId) {
    // The pre-migration GET-one graph read, byte-for-byte — the only change is
    // the WHERE (ownership was already proved by the handler's `ownsProject`
    // probe, matching the port contract).
    const row = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      with: {
        chapters: { orderBy: (c, { asc }) => [asc(c.sortOrder)] },
        characters: true,
        locations: true,
        plotThreads: true,
        worldEntities: true,
        referenceWorks: true,
        storyMemories: true,
        characterRelationships: true,
        storyPromises: true,
      },
    } as never);
    return (row as ProjectGraphRow | undefined) ?? null;
  },

  async updateScoped(projectId, patch) {
    // Ownership is the handler's probe (the port contract); the WHERE here is
    // project-id only, exactly as the port specifies.
    const [row] = await db
      .update(projects)
      .set(patch as typeof projects.$inferInsert)
      .where(eq(projects.id, projectId))
      .returning();
    return (row as ProjectRow | undefined) ?? null;
  },

  async deleteScoped(projectId) {
    await db.delete(projects).where(eq(projects.id, projectId));
  },
};
