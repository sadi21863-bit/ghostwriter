import { NextRequest, NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/auth-helpers';
import { checkAiRateLimit } from '@/lib/ratelimit';
import { db } from '@/db';
import { workPackets } from '@/db/schema';
import { ilike } from 'drizzle-orm';
import { researchWorkPacket } from '@/lib/ai/research-agent';

export async function POST(req: NextRequest) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const { title, medium } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 });

  // Check if work packet already exists (case-insensitive)
  const existing = await db.query.workPackets.findFirst({
    where: ilike(workPackets.title, title.trim()),
  });
  if (existing) return NextResponse.json({ packet: existing, cached: true });

  const result = await researchWorkPacket(title.trim(), medium);

  const [packet] = await db.insert(workPackets).values({
    userId: session.user.id,
    title: result.title || title.trim(),
    creator: result.creator,
    medium: result.medium,
    genres: result.genres,
    thematicCore: result.thematicCore,
    craftPrinciples: result.craftPrinciples as any,
    structuralNotes: result.structuralNotes,
    characterNotes: result.characterNotes,
    dialogueNotes: result.dialogueNotes,
    isPublic: false,
    status: 'provisional',
  }).returning();

  return NextResponse.json({ packet, cached: false, confidence: result.confidence });
}
