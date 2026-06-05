export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, chapters } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getRequiredSession();
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, (await params).projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const all = await db.query.chapters.findMany({
    where: eq(chapters.projectId, (await params).projectId),
  });
  return NextResponse.json(all);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getRequiredSession();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, (await params).projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const existing = await db.query.chapters.findMany({
    where: eq(chapters.projectId, (await params).projectId),
  });
  const [chapter] = await db
    .insert(chapters)
    .values({
      projectId: (await params).projectId,
      title: body.title || `Chapter ${existing.length + 1}`,
      sortOrder: existing.length,
    })
    .returning();

  return NextResponse.json(chapter, { status: 201 });
}
