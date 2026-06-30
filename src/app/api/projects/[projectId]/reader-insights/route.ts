export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, readerSessions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { buildReaderInsights } from "@/lib/reader/insights";

// Author-facing reader insights over the already-collected share-link sessions +
// reactions. Read-only aggregate; the heavy lifting is the pure buildReaderInsights.
export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, s.user.id)),
    with: { chapters: { columns: { id: true, title: true, sortOrder: true } } },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sessions = await db.query.readerSessions.findMany({
    where: eq(readerSessions.projectId, projectId),
    with: { reactions: { columns: { chapterId: true, reactionType: true } } },
  });

  const reactions = sessions.flatMap((sess: any) => sess.reactions ?? []);
  const insights = buildReaderInsights({
    sessions: sessions.map((x: any) => ({ id: x.id })),
    reactions,
    chapters: (project as any).chapters ?? [],
  });

  return NextResponse.json(insights);
}
