/**
 * SQLite adapters for the comic page/panel CRUD repository ports
 * (`handlers/comics.ts`) — line-for-line port of `pg-comic-repos.ts` over the
 * sqlite-proxy baseline (`@/db/sqlite`), in the same factory shape as the
 * sibling tracer adapters (`sqlite-character-location-repos.ts` /
 * `sqlite-thread-reference-repos.ts`; docs/migration/phase3-prep.md §4).
 *
 * One structural divergence, forced by the baseline (same class as
 * `sqlite-relationship-repos.ts`): pg's `listWithPanels` is ONE relational
 * read (`db.query.comicPages.findMany({ with: { panels: … } })`).
 * `sqlite-schema.ts` deliberately ships no `relations()` blocks, so the same
 * read is re-expressed here as sibling scoped `findMany`s with the identical
 * predicates and orderings the relation encodes — pages scoped by
 * `projectId`, ordered `createdAt` DESC (newest-first), then the panels the
 * `comicPages.panels` relation would nest (`pageId IN (pageIds)`, the
 * relation's own join predicate) ordered `panelIndex` ASC, grouped back onto
 * their page with an empty `panels` array wherever the relational read would
 * have attached one. A `with` call would throw on the relation-less builder;
 * folding the two reads into one manual JOIN would not be a faithful port
 * either. No JOIN is executed anywhere in this file — every read stays a
 * sibling query.
 *
 * What the port deliberately does NOT carry (verified against
 * `handlers/comics.ts`, the five cloud routes, and `local-host.ts`'s four
 * comic mounts): all Phase-C candidate mechanics are HANDLER-owned over these
 * generic ports, on both engines. `updateComicPanel` reads `findScoped`
 * first, refuses an unknown `promoteCandidateUrl` with the route's exact 400
 * body, then writes the swap through `updateScoped` (promoted URL → primary
 * `imageUrl`, old primary appended to the remaining candidates);
 * `deployPanelImage` builds append-vs-overwrite itself (`keepAsCandidate` →
 * `candidateImageUrls = [...existing, newUrl]` leaving the primary untouched,
 * else `imageUrl = newUrl`); `letterComicPanel` writes `letteredImageUrl`
 * without touching the raw `imageUrl`; and the vision-critic
 * qualityScore/Weakest/Note write is just another `updateScoped` annotation.
 * So the adapter stays mechanical — no promote/keep/letter/critic verb
 * exists on the pg file, and none exists here. `comic_panels` rows also
 * carry their own direct `projectId` FK, so every panel verb scopes by it
 * directly, exactly the predicate pg uses — there is no panel→page→project
 * indirection anywhere in this layer (the handler's letter verb re-proves
 * PAGE ownership through a separate `ChildResourceRepository` port,
 * route-side, unchanged here).
 *
 * Conventions inherited from the baseline (`sqlite-schema.ts` header): uuid
 * ids generate client-side via `$defaultFn` and surface through
 * `.returning()`; both tables' `createdAt` is `integer(mode:
 * "timestamp_ms")` — Date-in/Date-out parity with pg rows, zero conversion;
 * `candidateImageUrls` (jsonb on pg) is `text(mode: "json")` — drizzle
 * JSON-encodes on write and parses on read, so the typed `string[]` survives
 * the TEXT storage and core never sees a string. `comicPanels` has NO
 * `updatedAt` column on either engine (the handler header is load-bearing:
 * an empty patch degenerates the same way), and nothing here carries a
 * pgvector column, so there is no `embedding` strip to perform.
 *
 * Imports come from `src/db/sqlite*` only. This file must never touch `@/db`
 * (Neon) or `next*` — guarded by the source-purity tests.
 */

import { and, eq, inArray } from "drizzle-orm";

import type { DrizzleSqliteDb } from "@/db/sqlite";
import { comicPages, comicPanels, projects } from "@/db/sqlite-schema";
import type {
  ComicPageCrudRepository,
  ComicPageRow,
  ComicPanelCrudRepository,
  ComicPanelRow,
} from "@/lib/core/handlers/comics";

export function makeSqliteComicPageCrudRepository(db: DrizzleSqliteDb): ComicPageCrudRepository {
  return {
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
      // pg's single relational read re-expressed as sibling scoped queries
      // (see header): the parent read keeps pg's own `where` + `orderBy`
      // verbatim; the nested panels keep the relation's own predicate
      // (`pageId` = the parent's id) and pg's nested `panelIndex` ASC
      // ordering. Pages with zero panels still surface with `panels: []`,
      // the shape the relational read guarantees.
      const pages = await db.query.comicPages.findMany({
        where: eq(comicPages.projectId, projectId),
        orderBy: (p, { desc }) => [desc(p.createdAt)],
      });
      const pageIds = pages.map((page) => page.id);
      if (pageIds.length === 0) return [];
      const panels = await db.query.comicPanels.findMany({
        where: inArray(comicPanels.pageId, pageIds),
        orderBy: (p, { asc }) => [asc(p.panelIndex)],
      });
      const panelsByPage = new Map<string, ComicPanelRow[]>();
      for (const panel of panels as unknown as ComicPanelRow[]) {
        const list = panelsByPage.get(panel.pageId);
        if (list) list.push(panel);
        else panelsByPage.set(panel.pageId, [panel]);
      }
      return pages.map((page) => ({
        ...page,
        panels: panelsByPage.get(page.id) ?? [],
      })) as unknown as ComicPageRow[];
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
}

export function makeSqliteComicPanelCrudRepository(db: DrizzleSqliteDb): ComicPanelCrudRepository {
  return {
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
}
