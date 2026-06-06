export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { universes, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type Ctx = { params: Promise<{ universeId: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const s = await getRequiredSession();
  const { universeId } = await params;
  const universe = await db.query.universes.findFirst({
    where: and(eq(universes.id, universeId), eq(universes.userId, s.user.id)),
  });
  if (!universe) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const list = await db.query.projects.findMany({
    where: and(eq(projects.universeId, universeId), eq(projects.userId, s.user.id)),
    columns: { id: true, name: true, format: true, timelineSort: true, phase: true, storyType: true, createdAt: true, updatedAt: true },
    with: { chapters: { columns: { id: true, wordCount: true } } },
    orderBy: (p, { asc }) => [asc(p.timelineSort)],
  });
  return NextResponse.json(list);
}

export async function POST(req: Request, { params }: Ctx) {
  const s = await getRequiredSession();
  const { universeId } = await params;
  const universe = await db.query.universes.findFirst({
    where: and(eq(universes.id, universeId), eq(universes.userId, s.user.id)),
  });
  if (!universe) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { projectId, timelineSort, phase } = await req.json();
  // Link an existing project to this universe
  const [u] = await db.update(projects).set({
    universeId,
    storyType: "universe-story",
    ...(timelineSort !== undefined && { timelineSort }),
    ...(phase !== undefined && { phase }),
  }).where(and(eq(projects.id, projectId), eq(projects.userId, s.user.id))).returning();
  return NextResponse.json(u);
}
