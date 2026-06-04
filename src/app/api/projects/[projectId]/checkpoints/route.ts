export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/auth-helpers';
import { db } from '@/db';
import { projects, storyCheckpoints } from '@/db/schema';
import { and, eq, desc } from 'drizzle-orm';

export async function GET(_: Request, { params }: { params: { projectId: string } }) {
  const s = await getRequiredSession();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, params.projectId), eq(projects.userId, s.user.id)),
    columns: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const checkpoints = await db.query.storyCheckpoints.findMany({
    where: eq(storyCheckpoints.projectId, params.projectId),
    orderBy: [desc(storyCheckpoints.createdAt)],
  });

  return NextResponse.json({ checkpoints });
}

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  const s = await getRequiredSession();
  const { name, notes } = await req.json();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, params.projectId), eq(projects.userId, s.user.id)),
    with: {
      chapters:      { columns: { id: true, title: true, wordCount: true, arcPosition: true } },
      plotThreads:   { columns: { id: true, status: true, starvationWarning: true } },
      storyPromises: { columns: { id: true, status: true } },
    },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const proj = project as any;
  const totalWordCount  = proj.chapters.reduce((sum: number, c: any) => sum + (c.wordCount ?? 0), 0);
  const openThreadCount = proj.plotThreads.filter((t: any) => t.status === 'open' || t.status === 'Active').length;
  const openPromises    = proj.storyPromises.filter((p: any) => p.status === 'open').length;

  const healthScore = Math.max(0, 100
    - (proj.plotThreads.filter((t: any) => t.starvationWarning).length * 5)
    - (proj.chapters.filter((c: any) => (c.wordCount ?? 0) < 300).length * 3)
    - (openPromises > 5 ? (openPromises - 5) * 4 : 0)
  );

  const [checkpoint] = await db.insert(storyCheckpoints).values({
    projectId: params.projectId,
    name:  name?.trim() || `Checkpoint — ${new Date().toLocaleDateString()}`,
    notes: notes ?? '',
    snapshot: {
      totalWordCount,
      chapterCount: proj.chapters.length,
      chapters: proj.chapters.map((c: any) => ({
        id: c.id, title: c.title, wordCount: c.wordCount ?? 0, arcPosition: c.arcPosition ?? '',
      })),
      openThreadCount,
      openPromises,
      healthScore,
    },
  }).returning();

  return NextResponse.json({ checkpoint });
}

export async function DELETE(req: Request, { params }: { params: { projectId: string } }) {
  const s = await getRequiredSession();
  const { checkpointId } = await req.json();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, params.projectId), eq(projects.userId, s.user.id)),
    columns: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(storyCheckpoints).where(
    and(
      eq(storyCheckpoints.id, checkpointId),
      eq(storyCheckpoints.projectId, params.projectId),
    ),
  );

  return NextResponse.json({ success: true });
}
