import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { plotThreads, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.userId, userId)) });
}

export async function PATCH(req, { params }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership(params.projectId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json();
  const [u] = await db.update(plotThreads).set(b).where(eq(plotThreads.id, params.threadId)).returning();
  return NextResponse.json(u);
}

export async function DELETE(_, { params }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership(params.projectId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.delete(plotThreads).where(eq(plotThreads.id, params.threadId));
  return NextResponse.json({ ok: true });
}