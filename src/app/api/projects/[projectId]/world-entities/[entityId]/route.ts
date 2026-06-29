export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { worldEntities, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { WorldEntityKindSchema, encodeWorldEntityProperties } from "@/lib/types/story";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.userId, userId)) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ projectId: string; entityId: string }> }) {
  const s = await getRequiredSession();
  const { projectId, entityId } = await params;
  if (!await verifyOwnership(projectId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const f of ["name", "summary", "description", "linkedCharacterIds", "linkedLocationIds", "linkedPlotThreadIds", "linkedEntityIds", "alwaysInContext", "sortOrder"]) {
    if (f in body) patch[f] = body[f];
  }
  if ("kind" in body) patch.kind = WorldEntityKindSchema.parse(body.kind);
  if ("properties" in body) {
    try { patch.properties = encodeWorldEntityProperties(body.properties); }
    catch { return NextResponse.json({ error: "invalid properties" }, { status: 400 }); }
  }
  const [u] = await db.update(worldEntities).set(patch)
    .where(and(eq(worldEntities.id, entityId), eq(worldEntities.projectId, projectId)))
    .returning();
  return NextResponse.json(u);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ projectId: string; entityId: string }> }) {
  const s = await getRequiredSession();
  const { projectId, entityId } = await params;
  if (!await verifyOwnership(projectId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.delete(worldEntities).where(and(eq(worldEntities.id, entityId), eq(worldEntities.projectId, projectId)));
  return NextResponse.json({ ok: true });
}
