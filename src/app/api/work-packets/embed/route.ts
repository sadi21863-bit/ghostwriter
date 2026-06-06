export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/auth-helpers';
import { db } from '@/db';
import { workPackets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateEmbedding, buildPacketEmbeddingText } from '@/lib/ai/embeddings';

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    await getRequiredSession();
  }

  const allPackets = await db.query.workPackets.findMany();
  const unembedded = allPackets.filter(p => !(p as any).embedding);

  let processed = 0;
  for (const packet of unembedded) {
    const text = buildPacketEmbeddingText({
      title: packet.title,
      medium: packet.medium,
      thematicCore: packet.thematicCore ?? '',
      craftPrinciples: (packet.craftPrinciples as any[]) ?? [],
    });
    const embedding = await generateEmbedding(text);
    await db.update(workPackets)
      .set({ embedding: embedding as any })
      .where(eq(workPackets.id, packet.id));
    processed++;
  }

  return NextResponse.json({ processed });
}
