export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { buildPromiseLedger } from "@/lib/ai/promise-ledger";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  if (!await verifyOwnership(projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const chapterId = new URL(req.url).searchParams.get("chapterId");
  if (!chapterId) return NextResponse.json({ error: "chapterId is required." }, { status: 400 });

  const allChapters = await db.query.chapters.findMany({
    where: (c, { eq }) => eq(c.projectId, projectId),
    orderBy: (c, { asc }) => [asc(c.sortOrder)],
  });
  const target = allChapters.find((c: any) => c.id === chapterId);
  let priorChapterSummary = "";
  if (target && target.sortOrder != null) {
    const targetSortOrder = target.sortOrder as number;
    const prior = allChapters.find((c: any) => c.sortOrder === targetSortOrder - 1);
    priorChapterSummary = prior?.summary ?? "";
  }

  const openPromises = await buildPromiseLedger(projectId, "preserve");

  return NextResponse.json({ openPromises, priorChapterSummary });
}
