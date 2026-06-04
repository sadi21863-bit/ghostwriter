export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/auth-helpers';
import { db } from '@/db';
import { workPackets } from '@/db/schema';
import { or, isNull, eq } from 'drizzle-orm';
import { generateEmbedding, cosineSimilarity } from '@/lib/ai/embeddings';

export async function POST(req: NextRequest) {
  const session = await getRequiredSession();
  const { query, limit = 5 } = await req.json();
  if (!query?.trim()) return NextResponse.json({ results: [] });

  const queryEmbedding = await generateEmbedding(query);

  const allPackets = await db.query.workPackets.findMany({
    where: or(isNull(workPackets.userId), eq(workPackets.userId, session.user.id)),
  });

  const withScores = allPackets
    .filter(p => Array.isArray((p as any).embedding) && (p as any).embedding.length > 0)
    .map(p => ({
      packet: p,
      score: cosineSimilarity(queryEmbedding, (p as any).embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return NextResponse.json({
    results: withScores.map(({ packet, score }) => ({
      id: packet.id,
      title: packet.title,
      medium: packet.medium,
      thematicCore: packet.thematicCore,
      score: Math.round(score * 100) / 100,
    })),
  });
}
