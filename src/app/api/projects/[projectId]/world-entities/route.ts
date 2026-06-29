export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { worldEntities, projects } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { WorldEntityKindSchema, encodeWorldEntityProperties, type WorldEntityProperties } from "@/lib/types/story";

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
  const [r] = await db.insert(worldEntities).values({
    projectId, kind, name: body.name,
    summary: body.summary ?? "", description: body.description ?? "", properties,
    linkedCharacterIds: body.linkedCharacterIds ?? [], linkedLocationIds: body.linkedLocationIds ?? [],
    linkedPlotThreadIds: body.linkedPlotThreadIds ?? [], linkedEntityIds: body.linkedEntityIds ?? [],
    alwaysInContext: body.alwaysInContext ?? false, sortOrder: body.sortOrder ?? 0,
  }).returning();
  return NextResponse.json(r, { status: 201 });
}
