export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { platformEvents } from '@/db/schema';
import { gte, sql } from 'drizzle-orm';

export async function GET(req: Request) {
  if (!process.env.ADMIN_SECRET) {
    return new Response('Server misconfigured: ADMIN_SECRET not set', { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      event: platformEvents.event,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(platformEvents)
    .where(gte(platformEvents.createdAt, thirtyDaysAgo))
    .groupBy(platformEvents.event);

  const counts = Object.fromEntries(rows.map(r => [r.event, r.count]));
  const total = rows.reduce((s, r) => s + r.count, 0);

  return NextResponse.json({ counts, total, since: thirtyDaysAgo });
}
