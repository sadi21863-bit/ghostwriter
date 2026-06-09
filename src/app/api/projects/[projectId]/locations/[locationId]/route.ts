export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { locations, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const LocationPatch = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  atmosphere: z.string().optional(),
  history: z.string().optional(),
  sensoryDetails: z.string().optional(),
  linkedCharacterIds: z.array(z.string().uuid()).optional(),
  alwaysInContext: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.userId, userId)) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ projectId: string; locationId: string }> }) {
  const s = await getRequiredSession();
  const { projectId, locationId } = await params;
  if (!await verifyOwnership(projectId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = LocationPatch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
  const [u] = await db.update(locations).set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(locations.id, locationId), eq(locations.projectId, projectId)))
    .returning();
  return NextResponse.json(u);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ projectId: string; locationId: string }> }) {
  const s = await getRequiredSession();
  const { projectId, locationId } = await params;
  if (!await verifyOwnership(projectId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.delete(locations).where(and(eq(locations.id, locationId), eq(locations.projectId, projectId)));
  return NextResponse.json({ ok: true });
}
