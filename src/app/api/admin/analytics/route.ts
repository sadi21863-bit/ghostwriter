export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { platformEvents } from '@/db/schema';
import { gte } from 'drizzle-orm';

export async function GET(req: Request) {
  if (!process.env.ADMIN_SECRET) {
    return new Response('Server misconfigured: ADMIN_SECRET not set', { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const events = await db.query.platformEvents.findMany({
    where: gte(platformEvents.createdAt, thirtyDaysAgo),
    columns: { event: true, createdAt: true },
    limit: 50000,
    orderBy: (e, { desc }) => [desc(e.createdAt)],
  });

  const counts = events.reduce((acc, e) => {
    acc[e.event] = (acc[e.event] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return NextResponse.json({ counts, total: events.length, since: thirtyDaysAgo });
}
