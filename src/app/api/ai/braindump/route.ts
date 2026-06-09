export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/auth-helpers';
import { checkAiRateLimit } from '@/lib/ratelimit';
import { getUserTier, MONTHLY_GENERATION_LIMITS } from '@/lib/subscription';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '@/lib/ai/engine';

interface BraindumpResult {
  projectName:    string;
  premise:        string;
  format:         string;
  genres:         string[];
  controllingIdea: string;
  characters:     Array<{
    name:    string;
    role:    string;
    description: string;
  }>;
  worldFacts:     string[];
  openConflicts:  string[];
  suggestedTitle: string;
}

export async function POST(req: NextRequest) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const tier = await getUserTier(session.user.id);
  const monthlyLimit = MONTHLY_GENERATION_LIMITS[tier] ?? 10;

  if (monthlyLimit !== -1) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { monthlyGenerations: true, monthlyGenerationsResetAt: true },
    });
    const now = new Date();
    const resetAt = user?.monthlyGenerationsResetAt;
    const isNewMonth = !resetAt ||
      resetAt.getMonth() !== now.getMonth() ||
      resetAt.getFullYear() !== now.getFullYear();

    if (isNewMonth) {
      await db.update(users)
        .set({ monthlyGenerations: 0, monthlyGenerationsResetAt: now })
        .where(eq(users.id, session.user.id));
    } else if ((user?.monthlyGenerations ?? 0) >= monthlyLimit) {
      return NextResponse.json({
        error: 'generation_limit_reached',
        message: `You've used your ${monthlyLimit} generations this month.`,
      }, { status: 429 });
    }
  }

  const { text } = await req.json();

  if (!text || text.trim().length < 50) {
    return NextResponse.json({ error: 'Not enough text to work with' }, { status: 400 });
  }

  const client = new Anthropic();
  const msg = await client.messages.create({
    model: MODELS.default,
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `A writer has dumped their raw story ideas below. Extract the structure.

Return ONLY valid JSON with this exact structure:
{
  "projectName": "working title or 3-word description",
  "premise": "2-sentence story premise",
  "format": "Novel",
  "genres": ["primary genre", "optional second genre"],
  "controllingIdea": "the thematic truth this story explores in one sentence",
  "characters": [
    {"name": "Name", "role": "protagonist|antagonist|supporting", "description": "1 sentence"}
  ],
  "worldFacts": ["key fact about setting", "another key fact"],
  "openConflicts": ["main tension", "secondary tension"],
  "suggestedTitle": "A Short Evocative Title"
}

Extract ONLY what's explicit or strongly implied in the text.
If the text has fewer than 2 named characters, infer archetypes from the description.
Format should be "Novel" unless the text implies screenplay, web series, or podcast.

BRAINDUMP TEXT:
${text.slice(0, 4000)}`,
    }],
  });

  const raw = msg.content.filter(b => b.type === 'text').map(b => (b as any).text).join('');
  const clean = raw.replace(/```json\n?|```/g, '').trim();

  try {
    const result = JSON.parse(clean) as BraindumpResult;

    if (monthlyLimit !== -1) {
      await db.update(users)
        .set({ monthlyGenerations: sql`${users.monthlyGenerations} + 1` })
        .where(eq(users.id, session.user.id));
    }

    return NextResponse.json({ result });
  } catch {
    return NextResponse.json({ error: 'Could not parse story structure. Try adding more detail.' }, { status: 422 });
  }
}
