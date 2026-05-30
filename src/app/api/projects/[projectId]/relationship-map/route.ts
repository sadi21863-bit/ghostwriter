import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, characterRelationships } from "@/db/schema";
import { eq, and } from "drizzle-orm";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function GET(_: Request, { params }: { params: { projectId: string } }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership(params.projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, params.projectId),
    with: { characters: true, chapters: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { characters, chapters } = project;

  // Load stored relationship data
  const storedRels = await db.query.characterRelationships.findMany({
    where: eq(characterRelationships.projectId, params.projectId),
  });
  const relMap = new Map<string, typeof storedRels[0]>();
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

  const edges: {
    charAId: string; charBId: string; charAName: string; charBName: string;
    sharedChapters: number; trustLevel: number; relationshipType: string;
    fourHorsemen: { criticism: number; contempt: number; defensiveness: number; stonewalling: number };
    notes: string;
  }[] = [];
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

  return NextResponse.json({ nodes, edges, isolated });
}

export async function PATCH(req: Request, { params }: { params: { projectId: string } }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership(params.projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { characterAId, characterBId, trustLevel, relationshipType, notes, fourHorsemen } = await req.json();
  if (!characterAId || !characterBId)
    return NextResponse.json({ error: "characterAId and characterBId required" }, { status: 400 });

  const aId = characterAId < characterBId ? characterAId : characterBId;
  const bId = characterAId < characterBId ? characterBId : characterAId;

  const existing = await db.query.characterRelationships.findFirst({
    where: and(
      eq(characterRelationships.projectId, params.projectId),
      eq(characterRelationships.characterAId, aId),
      eq(characterRelationships.characterBId, bId)
    ),
  });

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (trustLevel !== undefined) updates.trustLevel = trustLevel;
  if (relationshipType !== undefined) updates.relationshipType = relationshipType;
  if (notes !== undefined) updates.notes = notes;
  if (fourHorsemen !== undefined) updates.fourHorsemen = fourHorsemen;

  if (existing) {
    const [updated] = await db.update(characterRelationships)
      .set(updates)
      .where(eq(characterRelationships.id, existing.id))
      .returning();
    return NextResponse.json(updated);
  } else {
    const [created] = await db.insert(characterRelationships).values({
      projectId: params.projectId,
      characterAId: aId,
      characterBId: bId,
      trustLevel: trustLevel ?? 50,
      relationshipType: relationshipType ?? "",
      notes: notes ?? "",
      fourHorsemen: fourHorsemen ?? { criticism: 0, contempt: 0, defensiveness: 0, stonewalling: 0 },
    }).returning();
    return NextResponse.json(created);
  }
}
