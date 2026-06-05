export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, readerSessions } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { randomBytes } from "crypto";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function POST(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership((await params).projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const [session] = await db.insert(readerSessions).values({
    projectId: (await params).projectId,
    token,
    expiresAt,
  }).returning();

  const shareUrl = `${process.env.NEXTAUTH_URL ?? ""}/reader/${token}`;
  return NextResponse.json({ token: session.token, shareUrl, expiresAt: session.expiresAt });
}

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership((await params).projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sessions = await db.query.readerSessions.findMany({
    where: and(
      eq(readerSessions.projectId, (await params).projectId),
      gt(readerSessions.expiresAt, new Date())
    ),
    with: { reactions: true },
  });

  // Aggregate reactions by chapter
  const allReactions = sessions.flatMap(s => s.reactions);
  const byChapter: Record<string, { chapterId: string; reactions: typeof allReactions }> = {};
  for (const r of allReactions) {
    byChapter[r.chapterId] ??= { chapterId: r.chapterId, reactions: [] };
    byChapter[r.chapterId].reactions.push(r);
  }

  return NextResponse.json({
    activeSessions: sessions.length,
    heatmap: Object.values(byChapter),
  });
}
