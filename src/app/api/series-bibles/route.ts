export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/auth-helpers';
import { db } from '@/db';
import { seriesBibles } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const s = await getRequiredSession();
  const bibles = await db.query.seriesBibles.findMany({
    where: eq(seriesBibles.userId, s.user.id),
    orderBy: (b, { desc }) => [desc(b.updatedAt)],
  });
  return NextResponse.json({ bibles });
}

export async function POST(req: Request) {
  const s = await getRequiredSession();
  const { name, premise, projectIds } = await req.json();

  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const [bible] = await db.insert(seriesBibles).values({
    userId: s.user.id,
    name: name.trim(),
    premise: premise ?? '',
    projectIds: projectIds ?? [],
  }).returning();

  return NextResponse.json({ bible });
}
