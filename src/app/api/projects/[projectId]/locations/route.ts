export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { locations, projects } from "@/db/schema";
import { eq, and, ne, isNotNull } from "drizzle-orm";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { buildLocationEmbeddingText, findSimilarEntities } from "@/lib/world-bible/duplicate-detection";
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }){
  const session = await getRequiredSession();
  const { projectId } = await params;
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)) });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { name, description, atmosphere, history, sensoryDetails, alwaysInContext, sortOrder } = await req.json();
  if (!name || typeof name !== "string") return NextResponse.json({ error: "name is required" }, { status: 400 });

  const embedding = await generateEmbedding(buildLocationEmbeddingText({ name, description, atmosphere, history })).catch(() => null);

  const [r] = await db.insert(locations).values({
    projectId, name, description, atmosphere, history, sensoryDetails, alwaysInContext, sortOrder, embedding,
  }).returning();

  let similarEntities: ReturnType<typeof findSimilarEntities> = [];
  if (r && embedding) {
    const others = await db.query.locations.findMany({
      where: and(eq(locations.projectId, projectId), ne(locations.id, r.id), isNotNull(locations.embedding)),
      columns: { id: true, name: true, embedding: true },
    });
    similarEntities = findSimilarEntities(embedding, others);
  }

  return NextResponse.json({ ...r, similarEntities }, { status: 201 });
}