export const dynamic = 'force-dynamic';

// src/app/api/projects/[projectId]/characters/[characterId]/evolution/route.ts
import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, characterEvolutionLog } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; characterId: string }> }
) {
  const session = await getRequiredSession();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, (await params).projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const logs = await db.query.characterEvolutionLog.findMany({
    where: and(
      eq(characterEvolutionLog.characterId, (await params).characterId),
      eq(characterEvolutionLog.projectId, (await params).projectId)
    ),
    orderBy: [asc(characterEvolutionLog.chapterIndex)],
  });

  return NextResponse.json({ logs });
}
