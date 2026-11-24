/**
 * SQLite adapter for the relationship-map repository port
 * (`handlers/relationship-map.ts`) — line-for-line port of
 * `pg-relationship-repos.ts` over the sqlite-proxy baseline (`@/db/sqlite`),
 * in the same factory shape as the sibling tracer adapters
 * `sqlite-character-location-repos.ts` / `sqlite-thread-reference-repos.ts`
 * (docs/migration/phase3-prep.md §4).
 *
 * The REAL verb surface of the port (verified against both consumers — the
 * cloud route `api/projects/[projectId]/relationship-map/route.ts` and
 * `local-host.ts`'s GET/PATCH relationship-map mount): `ownsProject`,
 * `readGraph`, `upsertRelationships`. There is no delete/clear verb on this
 * port; the only deletions touching `character_relationships` are FK
 * cascades, which the baseline DDL carries (`onDelete: cascade` to projects
 * and to both character positions; `createSqliteDb` turns
 * `PRAGMA foreign_keys = ON` on every connection, so the cascades actually
 * fire locally the way they fire on the pg server).
 *
 * One structural divergence, forced by the baseline: pg's `readGraph` pulls
 * project + characters + chapters in ONE relational query
 * (`with: { characters, chapters }`). `sqlite-schema.ts` deliberately ships
 * no `relations()` blocks (see its header — "add relations when a handler
 * that consumes them migrates"), so the same read is re-expressed here as
 * sibling scoped `findMany` queries with the identical scoping predicates the
 * relations encode (child `projectId` = this project). A `with` call would
 * throw on the relation-less builder, and folding characters x chapters into
 * one manual JOIN would multiply rows (a cartesian read) — neither is a
 * faithful port. The existence probe reproduces the header-documented
 * divergence: a project vanished between `ownsProject` and `readGraph`
 * returns an empty but valid graph, not a TypeError.
 *
 * No embedding or date-conversion handling on this cluster: nothing here
 * carries a pgvector column, and `fourHorsemen` round-trips typed through the
 * baseline's `text(mode: "json")` (jsonb → TEXT json discipline, §4.2);
 * `updatedAt` is `integer(mode: "timestamp_ms")` — Date-in/Date-out, zero
 * conversion. Unknown payload keys stay out of every query (the closed
 * `updates` key list below), same mass-assign guard pg has.
 *
 * Imports come from `src/db/sqlite*` only. This file must never touch `@/db`
 * (Neon) or `next*` — guarded by the source-purity tests.
 */

import { and, eq } from "drizzle-orm";

import type { DrizzleSqliteDb } from "@/db/sqlite";
import {
  characterRelationships,
  characters as charactersTable,
  chapters as chaptersTable,
  projects,
} from "@/db/sqlite-schema";
import type {
  RelationshipMapEdge,
  RelationshipMapGraph,
  RelationshipMapRepository,
  RelationshipMapRow,
  RelationshipMapUpsertPayload,
} from "@/lib/core/handlers/relationship-map";

export function makeSqliteRelationshipMapRepository(db: DrizzleSqliteDb): RelationshipMapRepository {
  return {
    async ownsProject(projectId, actorId) {
      const row = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
        columns: { id: true },
      });
      return !!row;
    },

    async readGraph(projectId): Promise<RelationshipMapGraph> {
      // The project probe + sibling loads replace pg's single relational read
      // (see header). Same vanished-project contract: empty graph, no throw.
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
        columns: { id: true },
      });
      // Vanished between the handler's ownsProject and this read — see header.
      if (!project) return { nodes: [], edges: [], isolated: [] };

      // pg: `project.characters` / `project.chapters` via the relations; here:
      // the identical set (every child whose projectId is this project, no
      // extra filter, no orderBy — DB row order on both engines).
      const characters = await db.query.characters.findMany({
        where: eq(charactersTable.projectId, projectId),
      });
      const chapters = await db.query.chapters.findMany({
        where: eq(chaptersTable.projectId, projectId),
      });

      // Load stored relationship data
      const storedRels = await db.query.characterRelationships.findMany({
        where: eq(characterRelationships.projectId, projectId),
      });
      const relMap = new Map<string, (typeof storedRels)[0]>();
      for (const r of storedRels) {
        const key = r.characterAId < r.characterBId
          ? `${r.characterAId}:${r.characterBId}`
          : `${r.characterBId}:${r.characterAId}`;
        relMap.set(key, r);
      }

      // Co-occurrence analysis
      const coOccurrences: Record<string, Record<string, number>> = {};
      for (const chapter of chapters) {
        const content = (chapter.content || "").toLowerCase();
        if (!content.trim()) continue;
        const present = characters.filter(c => content.includes(c.name.toLowerCase()));
        for (let i = 0; i < present.length; i++) {
          for (let j = i + 1; j < present.length; j++) {
            const a = present[i].id < present[j].id ? present[i] : present[j];
            const b = present[i].id < present[j].id ? present[j] : present[i];
            coOccurrences[a.id] ??= {};
            coOccurrences[a.id][b.id] = (coOccurrences[a.id][b.id] ?? 0) + 1;
          }
        }
      }

      const edges: RelationshipMapEdge[] = [];
      const connectedIds = new Set<string>();

      for (const [aId, bMap] of Object.entries(coOccurrences)) {
        for (const [bId, count] of Object.entries(bMap)) {
          const charA = characters.find(c => c.id === aId);
          const charB = characters.find(c => c.id === bId);
          if (!charA || !charB) continue;
          const key = aId < bId ? `${aId}:${bId}` : `${bId}:${aId}`;
          const stored = relMap.get(key);
          edges.push({
            charAId: aId, charBId: bId, charAName: charA.name, charBName: charB.name,
            sharedChapters: count,
            trustLevel: stored?.trustLevel ?? 50,
            relationshipType: stored?.relationshipType ?? "",
            fourHorsemen: stored?.fourHorsemen ?? { criticism: 0, contempt: 0, defensiveness: 0, stonewalling: 0 },
            notes: stored?.notes ?? "",
          });
          connectedIds.add(aId);
          connectedIds.add(bId);
        }
      }

      const isolated = characters.filter(c => !connectedIds.has(c.id)).map(c => ({ id: c.id, name: c.name }));
      const nodes = characters.map(c => ({ id: c.id, name: c.name, role: c.role, portraitUrl: c.portraitUrl }));

      return { nodes, edges, isolated };
    },

    async upsertRelationships(
      projectId: string,
      payload: RelationshipMapUpsertPayload,
    ): Promise<RelationshipMapRow | null> {
      const aId = payload.characterAId < payload.characterBId ? payload.characterAId : payload.characterBId;
      const bId = payload.characterAId < payload.characterBId ? payload.characterBId : payload.characterAId;

      const existing = await db.query.characterRelationships.findFirst({
        where: and(
          eq(characterRelationships.projectId, projectId),
          eq(characterRelationships.characterAId, aId),
          eq(characterRelationships.characterBId, bId)
        ),
      });

      // Same conditional update set the legacy route built: updatedAt always, and
      // only the fields the caller actually sent. Fields the payload object may
      // carry beyond these never reach a query — the keys below are the closed
      // column list, so unknown client keys cannot mass-assign.
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (payload.trustLevel !== undefined) updates.trustLevel = payload.trustLevel;
      if (payload.relationshipType !== undefined) updates.relationshipType = payload.relationshipType;
      if (payload.notes !== undefined) updates.notes = payload.notes;
      if (payload.fourHorsemen !== undefined) updates.fourHorsemen = payload.fourHorsemen;
      if (payload.powerDifferential !== undefined) updates.powerDifferential = payload.powerDifferential;
      if (payload.emotionalRegister !== undefined) updates.emotionalRegister = payload.emotionalRegister;
      if (payload.knowledgeAsymmetry !== undefined) updates.knowledgeAsymmetry = payload.knowledgeAsymmetry;
      if (payload.dependencyStructure !== undefined) updates.dependencyStructure = payload.dependencyStructure;
      if (payload.attachmentStyleA !== undefined) updates.attachmentStyleA = payload.attachmentStyleA;
      if (payload.arcTrajectory !== undefined) updates.arcTrajectory = payload.arcTrajectory;

      if (existing) {
        const [updated] = await db.update(characterRelationships)
          .set(updates as Partial<typeof characterRelationships.$inferInsert>)
          .where(eq(characterRelationships.id, existing.id))
          .returning();
        return (updated as RelationshipMapRow | undefined) ?? null;
      } else {
        const [created] = await db.insert(characterRelationships).values({
          projectId,
          characterAId: aId,
          characterBId: bId,
          trustLevel: payload.trustLevel ?? 50,
          relationshipType: payload.relationshipType ?? "",
          notes: payload.notes ?? "",
          fourHorsemen: payload.fourHorsemen ?? { criticism: 0, contempt: 0, defensiveness: 0, stonewalling: 0 },
          powerDifferential: payload.powerDifferential ?? 0,
          emotionalRegister: payload.emotionalRegister ?? "",
          knowledgeAsymmetry: payload.knowledgeAsymmetry ?? "",
          dependencyStructure: payload.dependencyStructure ?? "none",
          attachmentStyleA: payload.attachmentStyleA ?? "",
          arcTrajectory: payload.arcTrajectory ?? "",
        }).returning();
        return (created as RelationshipMapRow | undefined) ?? null;
      }
    },
  };
}
