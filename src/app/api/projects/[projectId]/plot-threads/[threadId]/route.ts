import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { plotThreads, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const PlotThreadPatch = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["Active", "Resolved", "Dormant"]).optional(),
  stakes: z.string().optional(),
  connections: z.string().optional(),
  alwaysInContext: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.userId, userId)) });
}

export async function PATCH(req: Request, { params }: { params: { projectId: string; threadId: string } }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership(params.projectId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = PlotThreadPatch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
  const [u] = await db.update(plotThreads).set(parsed.data).where(eq(plotThreads.id, params.threadId)).returning();
  return NextResponse.json(u);
}

export async function DELETE(_: Request, { params }: { params: { projectId: string; threadId: string } }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership(params.projectId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.delete(plotThreads).where(eq(plotThreads.id, params.threadId));
  return NextResponse.json({ ok: true });
}
