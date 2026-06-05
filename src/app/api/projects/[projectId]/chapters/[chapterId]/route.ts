export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { chapters, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type Ctx = { params: Promise<{ projectId: string; chapterId: string }> };

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.userId, userId)) });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const s = await getRequiredSession();
  if (!await verifyOwnership((await params).projectId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json();
  if (b.content !== undefined) b.wordCount = b.content.trim().split(/\s+/).filter(Boolean).length;
  const [u] = await db.update(chapters).set({ ...b, updatedAt: new Date() }).where(eq(chapters.id, (await params).chapterId)).returning();
  return NextResponse.json(u);
}

export async function DELETE(_: Request, { params }: Ctx) {
  const s = await getRequiredSession();
  if (!await verifyOwnership((await params).projectId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.delete(chapters).where(eq(chapters.id, (await params).chapterId));
  return NextResponse.json({ ok: true });
}
