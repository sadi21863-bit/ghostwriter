import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects } from "@/db/schema";
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

  // For each chapter, find which characters appear in content
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

  const edges: { charAId: string; charBId: string; charAName: string; charBName: string; sharedChapters: number }[] = [];
  const connectedIds = new Set<string>();

  for (const [aId, bMap] of Object.entries(coOccurrences)) {
    for (const [bId, count] of Object.entries(bMap)) {
      const charA = characters.find(c => c.id === aId);
      const charB = characters.find(c => c.id === bId);
      if (!charA || !charB) continue;
      edges.push({ charAId: aId, charBId: bId, charAName: charA.name, charBName: charB.name, sharedChapters: count });
      connectedIds.add(aId);
      connectedIds.add(bId);
    }
  }

  const isolated = characters.filter(c => !connectedIds.has(c.id)).map(c => ({ id: c.id, name: c.name }));

  const nodes = characters.map(c => ({
    id: c.id,
    name: c.name,
    role: c.role,
    portraitUrl: c.portraitUrl,
  }));

  return NextResponse.json({ nodes, edges, isolated });
}
