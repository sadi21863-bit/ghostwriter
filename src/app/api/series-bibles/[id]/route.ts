export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/auth-helpers';
import { db } from '@/db';
import { seriesBibles, projects } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getRequiredSession();

  const bible = await db.query.seriesBibles.findFirst({
    where: and(eq(seriesBibles.id, (await params).id), eq(seriesBibles.userId, s.user.id)),
  });
  if (!bible) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Resolve project names
  let linkedProjects: { id: string; name: string; format: string }[] = [];
  if ((bible.projectIds as string[]).length > 0) {
    linkedProjects = await db.query.projects.findMany({
      where: and(
        inArray(projects.id, bible.projectIds as string[]),
        eq(projects.userId, s.user.id),
      ),
      columns: { id: true, name: true, format: true },
    }) as any;
  }

  return NextResponse.json({ bible, linkedProjects });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getRequiredSession();
  const body = await req.json();

  const allowed = ['name', 'premise', 'tone', 'worldRules', 'seriesCharacterArcs', 'continuityNotes', 'projectIds', 'timeline'];
  const updates: Record<string, any> = { updatedAt: new Date() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const [bible] = await db.update(seriesBibles)
    .set(updates)
    .where(and(eq(seriesBibles.id, (await params).id), eq(seriesBibles.userId, s.user.id)))
    .returning();

  if (!bible) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ bible });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getRequiredSession();
  await db.delete(seriesBibles).where(
    and(eq(seriesBibles.id, (await params).id), eq(seriesBibles.userId, s.user.id)),
  );
  return NextResponse.json({ success: true });
}
