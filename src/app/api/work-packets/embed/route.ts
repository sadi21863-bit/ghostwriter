export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { workPackets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateEmbedding, buildPacketEmbeddingText } from '@/lib/ai/embeddings';
import { requireBearer } from '@/lib/auth-secret';

export async function POST(req: Request) {
  const denied = requireBearer(req.headers.get('authorization'), "CRON_SECRET");
  if (denied) return denied;

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
