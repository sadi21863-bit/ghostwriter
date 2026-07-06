export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, characterRelationships } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { buildStoryGraph } from "@/lib/graph/story-graph";
import { analyzeGraphHealth } from "@/lib/graph/graph-health";
import { contextIsTrimmed } from "@/lib/ai/context-builder";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

// The multi-entity Story Graph (Phase 1) — characters + locations + threads and
// the relationships that already exist in the World Bible. Separate from
// /relationship-map (which WorldBiblePanel still consumes in its char-only shape)
// so this is purely additive and non-breaking.
export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  if (!await verifyOwnership(projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: { characters: true, locations: true, plotThreads: true, chapters: true, worldEntities: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const storedRels = await db.query.characterRelationships.findMany({
    where: eq(characterRelationships.projectId, projectId),
  });

  const graph = buildStoryGraph({
    characters: (project as any).characters ?? [],
    locations: (project as any).locations ?? [],
    plotThreads: (project as any).plotThreads ?? [],
    chapters: (project as any).chapters ?? [],
    storedRels: storedRels.map(r => ({ characterAId: r.characterAId, characterBId: r.characterBId, trustLevel: r.trustLevel, relationshipType: r.relationshipType })),
    worldEntities: (project as any).worldEntities ?? [],
  });

  // Headroom trims context silently (by design, for prompt-cache stability) — this
  // is the one place that surfaces it as a yes/no signal, in the same response as
  // the structural graph health, since Studio's graph view is where a user would
  // naturally look to understand whether their project's full story reaches the AI.
  const contextTrimmed = contextIsTrimmed({ ...(project as any), characterRelationships: storedRels });

  return NextResponse.json({ ...graph, health: analyzeGraphHealth(graph), contextTrimmed });
}
