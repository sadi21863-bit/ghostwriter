export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/auth-helpers';
import { checkAiRateLimit } from '@/lib/ratelimit';
import { meterAndGate, refundCredits } from '@/lib/metering/meter';
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

  const gate = await meterAndGate(session.user.id, "braindump");
  if (gate) return gate;

  const { text } = await req.json();

  if (!text || text.trim().length < 50) {
    return NextResponse.json({ error: 'Not enough text to work with' }, { status: 400 });
  }

  const client = new Anthropic();
  let raw: string;
  try {
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
    raw = msg.content.filter(b => b.type === 'text').map(b => (b as any).text).join('');
  } catch {
    await refundCredits(session.user.id, "braindump");
    return NextResponse.json({ error: 'Could not parse story structure. Try adding more detail.' }, { status: 422 });
  }

  const clean = raw.replace(/```json\n?|```/g, '').trim();

  try {
    const result = JSON.parse(clean) as BraindumpResult;
    return NextResponse.json({ result });
  } catch {
    await refundCredits(session.user.id, "braindump");
    return NextResponse.json({ error: 'Could not parse story structure. Try adding more detail.' }, { status: 422 });
  }
}
