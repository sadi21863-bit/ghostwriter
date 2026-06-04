export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/auth-helpers';
import { db } from '@/db';
import { workPackets, workPatterns } from '@/db/schema';
import { or, isNull, eq } from 'drizzle-orm';
import { generatePatterns } from '@/lib/ai/pattern-agent';

export async function GET(_: Request) {
  await getRequiredSession();
  const patterns = await db.query.workPatterns.findMany({
    where: eq(workPatterns.isPublic, true),
    orderBy: (wp, { asc }) => [asc(wp.name)],
  });
  return NextResponse.json({ patterns });
}

export async function POST(_: NextRequest) {
  const session = await getRequiredSession();

  const packets = await db.query.workPackets.findMany({
    where: or(isNull(workPackets.userId), eq(workPackets.userId, session.user.id)),
    columns: { title: true, medium: true, genres: true, thematicCore: true, craftPrinciples: true },
  });

  if (packets.length < 5) {
    return NextResponse.json({ error: 'Need at least 5 work packets to generate patterns' }, { status: 400 });
  }

  const generatedPatterns = await generatePatterns(packets as any);

  const stored: any[] = [];
  for (const pattern of generatedPatterns) {
    const supportingIds = await Promise.all(
      (pattern.supportingPacketTitles ?? []).map(async (title: string) => {
        const p = await db.query.workPackets.findFirst({
          where: eq(workPackets.title, title),
          columns: { id: true },
        });
        return p?.id ?? null;
      })
    );

    const [stored_pattern] = await db.insert(workPatterns).values({
      name: pattern.name,
      description: pattern.description,
      medium: pattern.medium,
      genres: pattern.genres as any,
      supportingPacketIds: supportingIds.filter(Boolean) as any,
      generationDirective: pattern.generationDirective,
      applicableTo: pattern.applicableTo as any,
      isPublic: true,
    }).returning();

    stored.push(stored_pattern);
  }

  return NextResponse.json({ patterns: stored, count: stored.length });
}
