/**
 * Phase 2 / v4 §7 — Postgres side of the relationship-map port
 * (`RelationshipMapRepository` in `handlers/relationship-map.ts`).
 *
 * This carries the former compound route's read/write/transformation logic
 * VERBATIM — the 149-line `relationship-map/route.ts` mixed authorization with
 * the co-occurrence graph build (characters x chapters → edges, stored
 * relationship data layered on top) and the pair upsert. The authorization
 * moved to the handler; every DB read, the transformation, and the write
 * defaults land here unchanged so the GET/PATCH payload shapes never drift:
 *  - `readGraph` emits exactly the GET body `{ nodes, edges, isolated }`.
 *  - `upsertRelationships` returns the full `character_relationships` row, or
 *    null when the row vanished between read and write (the handler shapes
 *    that refusal instead of serializing undefined).
 *
 * One divergence forced by the port's types: the legacy GET re-read the project
 * (id-only) after its ownership check and 404'd if that second read missed.
 * `readGraph` has no failure channel in the port, so a project that vanished
 * between `ownsProject` and the graph read — physically a race, since the
 * handler just proved ownership moments earlier — reads as an empty but valid
 * graph instead of a TypeError-driven 500.
 */

import { db } from "@/db";
import { characterRelationships, projects } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type {
  RelationshipMapEdge,
  RelationshipMapGraph,
  RelationshipMapRepository,
  RelationshipMapRow,
  RelationshipMapUpsertPayload,
} from "@/lib/core/handlers/relationship-map";

export const pgRelationshipMapRepository: RelationshipMapRepository = {
  async ownsProject(projectId, actorId) {
    const row = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, actorId)),
      columns: { id: true },
    });
    return !!row;
  },

  async readGraph(projectId): Promise<RelationshipMapGraph> {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      with: { characters: true, chapters: true },
    });
    // Vanished between the handler's ownsProject and this read — see header.
    if (!project) return { nodes: [], edges: [], isolated: [] };

    const { characters, chapters } = project;

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
