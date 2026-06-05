export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, chapters } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await getRequiredSession();
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { fromChapterId, branchLabel } = await req.json();
  if (!fromChapterId) return NextResponse.json({ error: "fromChapterId required" }, { status: 400 });

  const fromChapter = await db.query.chapters.findFirst({
    where: and(eq(chapters.id, fromChapterId), eq(chapters.projectId, projectId)),
  });
  if (!fromChapter) return NextResponse.json({ error: "Chapter not found" }, { status: 404 });

  // Get all chapters from this one onwards (same branch, same sort order or later)
  const allChapters = await db.query.chapters.findMany({
    where: and(
      eq(chapters.projectId, projectId),
      eq(chapters.branchId as any, fromChapter.branchId ?? "main")
    ),
  });
  const toFork = allChapters.filter(c => (c.sortOrder ?? 0) >= (fromChapter.sortOrder ?? 0));

  const newBranchId = randomUUID();
  const label = branchLabel?.trim() || `Branch ${new Date().toLocaleDateString()}`;

  const newChapters = await db.insert(chapters).values(
    toFork.map(c => ({
      projectId: projectId,
      title: c.title,
      content: c.content ?? "",
      summary: c.summary ?? "",
      tags: (c.tags ?? []) as string[],
      chapterType: c.chapterType ?? "chapter",
      sortOrder: c.sortOrder ?? 0,
      wordCount: c.wordCount ?? 0,
      branchId: newBranchId,
      branchLabel: label,
      parentChapterId: c.id,
    }))
  ).returning();

  return NextResponse.json({ branchId: newBranchId, branchLabel: label, chapters: newChapters });
}
