export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/auth-helpers';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '@/lib/ai/engine';
import { getUserTier, canAccessFeature } from '@/lib/subscription';
import { knowledgeAuditSystemPrompt } from '@/lib/ai/prompts';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getRequiredSession();
  const { projectId } = await params;
  const tier = await getUserTier(session.user.id);

  if (!canAccessFeature(tier, 'story_modes_advanced')) {
    return NextResponse.json({ error: 'upgrade_required', feature: 'knowledge_audit' }, { status: 403 });
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
    with: {
      chapters:   { orderBy: (c, { asc }) => [asc(c.sortOrder)] },
      characters: true,
      locations:  true,
    },
  });

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const chapters = (project.chapters ?? []).filter((c: any) => c.content?.trim().length > 100);
  if (chapters.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 chapters to audit' }, { status: 400 });
  }

  const manuscript = chapters.map((c: any, i: number) =>
    `=== Chapter ${i + 1}: ${c.title} ===\n${c.content}`
  ).join('\n\n');

  const characterRef = (project.characters ?? []).map((c: any) => {
    const parts = [`Character: ${c.name} (${c.role})`];
    if (c.personality) parts.push(`Personality: ${c.personality}`);
    if (c.kinesicsBaseline) parts.push(`NVC baseline: ${c.kinesicsBaseline}`);
    if (c.characterWant) parts.push(`Want: ${c.characterWant}`);
    if (c.characterNeed) parts.push(`Need: ${c.characterNeed}`);
    return parts.join('\n');
  }).join('\n\n');

  const client = new Anthropic();
  const msg = await client.messages.create({
    model: MODELS.default,
    max_tokens: 1500,
    system: knowledgeAuditSystemPrompt(chapters.length),
    messages: [{
      role: 'user',
      content: `WORLD BIBLE (character reference):
${characterRef || 'No character profiles defined.'}

MANUSCRIPT:
${manuscript.slice(0, 180000)}`,
    }],
  });

  const raw = msg.content.filter(b => b.type === 'text').map(b => (b as any).text).join('');
  const clean = raw.replace(/```json\n?|```/g, '').trim();

  try {
    const result = JSON.parse(clean);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Audit failed to parse. Try again.' }, { status: 422 });
  }
}
