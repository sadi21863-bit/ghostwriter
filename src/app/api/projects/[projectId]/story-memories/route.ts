export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { storyMemories, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function GET(_: Request, { params }: { params: { projectId: string } }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership(params.projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const memories = await db.query.storyMemories.findMany({
    where: eq(storyMemories.projectId, params.projectId),
    orderBy: (m, { desc }) => [desc(m.createdAt)],
  });
  return NextResponse.json(memories);
}

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership(params.projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { fact, category = "general", structuredData } = await req.json();
  if (!fact?.trim()) return NextResponse.json({ error: "fact required" }, { status: 400 });

  const [memory] = await db.insert(storyMemories).values({
    projectId: params.projectId,
    fact: fact.trim(),
    category,
    structuredData: structuredData ?? null,
    autoExtracted: false,
  }).returning();

  return NextResponse.json(memory);
}

export async function DELETE(req: Request, { params }: { params: { projectId: string } }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership(params.projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { memoryId } = await req.json();
  await db.delete(storyMemories).where(
    and(eq(storyMemories.id, memoryId), eq(storyMemories.projectId, params.projectId))
  );
  return NextResponse.json({ ok: true });
}
