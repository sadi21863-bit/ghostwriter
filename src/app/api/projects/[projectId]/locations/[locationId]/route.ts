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

export async function PATCH(req: Request, { params }: { params: { projectId: string; locationId: string } }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership(params.projectId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = LocationPatch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
  const [u] = await db.update(locations).set(parsed.data).where(eq(locations.id, params.locationId)).returning();
  return NextResponse.json(u);
}

export async function DELETE(_: Request, { params }: { params: { projectId: string; locationId: string } }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership(params.projectId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.delete(locations).where(eq(locations.id, params.locationId));
  return NextResponse.json({ ok: true });
}
