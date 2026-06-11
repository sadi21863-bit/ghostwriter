export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { db } from "@/db";
import { readerSessions, readerReactions, chapters } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";

type Ctx = { params: Promise<{ token: string }> };

async function getActiveSession(token: string) {
  return db.query.readerSessions.findFirst({
    where: and(
      eq(readerSessions.token, token),
      gt(readerSessions.expiresAt, new Date())
    ),
  });
}

export async function GET(_: Request, { params }: Ctx) {
  const session = await getActiveSession((await params).token);
  if (!session) return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });

  const projectChapters = await db.query.chapters.findMany({
    where: eq(chapters.projectId, session.projectId),
  });

  return NextResponse.json({
    chapters: projectChapters
      .filter(c => (c.content?.length ?? 0) > 0)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(c => ({ id: c.id, title: c.title, content: c.content ?? "" })),
  });
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await getActiveSession((await params).token);
  if (!session) return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });

  const { chapterId, textOffset, reactionType } = await req.json();
  if (!chapterId || textOffset === undefined || !reactionType)
    return NextResponse.json({ error: "chapterId, textOffset, and reactionType required" }, { status: 400 });

  const chapter = await db.query.chapters.findFirst({
    where: and(eq(chapters.id, chapterId), eq(chapters.projectId, session.projectId)),
    columns: { id: true },
  });
  if (!chapter) return NextResponse.json({ error: "Invalid chapter" }, { status: 400 });

  const [reaction] = await db.insert(readerReactions).values({
    sessionId: session.id,
    chapterId,
    textOffset,
    reactionType,
  }).returning();

  return NextResponse.json(reaction);
}
