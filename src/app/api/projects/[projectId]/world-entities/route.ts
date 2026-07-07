export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { worldEntities, projects } from "@/db/schema";
import { eq, and, asc, ne, isNotNull } from "drizzle-orm";
import { WorldEntityKindSchema, encodeWorldEntityProperties, type WorldEntityProperties } from "@/lib/types/story";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { buildWorldEntityEmbeddingText, findSimilarEntities } from "@/lib/world-bible/duplicate-detection";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.userId, userId)) });
}

// World Bible expansion: objects/weapons/organizations/factions/phenomena/entities/
// concepts as first-class, kind-tagged rows. Mirrors the characters/locations routes.
export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  if (!await verifyOwnership(projectId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rows = await db.query.worldEntities.findMany({
    where: eq(worldEntities.projectId, projectId),
    orderBy: [asc(worldEntities.kind), asc(worldEntities.sortOrder)],
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  if (!await verifyOwnership(projectId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  if (!body?.name || typeof body.name !== "string") return NextResponse.json({ error: "name is required" }, { status: 400 });
  const kind = WorldEntityKindSchema.parse(body.kind ?? "object");
  let properties: WorldEntityProperties;
  try { properties = encodeWorldEntityProperties(body.properties ?? {}); }
  catch { return NextResponse.json({ error: "invalid properties" }, { status: 400 }); }

  const embedding = await generateEmbedding(buildWorldEntityEmbeddingText({ name: body.name, summary: body.summary, description: body.description })).catch(() => null);

  const [r] = await db.insert(worldEntities).values({
    projectId, kind, name: body.name,
    summary: body.summary ?? "", description: body.description ?? "", properties,
    linkedCharacterIds: body.linkedCharacterIds ?? [], linkedLocationIds: body.linkedLocationIds ?? [],
    linkedPlotThreadIds: body.linkedPlotThreadIds ?? [], linkedEntityIds: body.linkedEntityIds ?? [],
    alwaysInContext: body.alwaysInContext ?? false, sortOrder: body.sortOrder ?? 0, embedding,
  }).returning();

  let similarEntities: ReturnType<typeof findSimilarEntities> = [];
  if (r && embedding) {
    // Scoped to the same kind — a similarly-worded object and faction are
    // unlikely to be "the same entity" the way two objects might be.
    const others = await db.query.worldEntities.findMany({
      where: and(eq(worldEntities.projectId, projectId), eq(worldEntities.kind, kind), ne(worldEntities.id, r.id), isNotNull(worldEntities.embedding)),
      columns: { id: true, name: true, embedding: true },
    });
    similarEntities = findSimilarEntities(embedding, others);
  }

  return NextResponse.json({ ...r, similarEntities }, { status: 201 });
}
