import { NextRequest, NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/auth-helpers';
import { db } from '@/db';
import { chapters, projects } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { buildContext } from '@/lib/ai/context-builder';
import { ALT_DRAFT_GOALS } from '@/lib/alt-draft/goals';
import Anthropic from '@anthropic-ai/sdk';
import type { AltDraftGoal, AlternateDraft } from '@/types';

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string; chapterId: string } }
) {
  const session = await getRequiredSession();
  const { goal } = await req.json() as { goal: AltDraftGoal };

  const chapter = await db.query.chapters.findFirst({
    where: and(eq(chapters.id, params.chapterId), eq(chapters.projectId, params.projectId)),
  });
  if (!chapter?.content?.trim()) {
    return NextResponse.json({ error: 'Chapter is empty' }, { status: 400 });
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)),
    with: { characters: true, locations: true, plotThreads: true, referenceWorks: true, storyMemories: true, characterRelationships: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const goalConfig = ALT_DRAFT_GOALS[goal];
  if (!goalConfig) return NextResponse.json({ error: 'Invalid goal' }, { status: 400 });

  const baseContext = buildContext(project as any);
  const client = new Anthropic();

  const { MODELS } = await import('@/lib/ai/engine');
  const response = await client.messages.create({
    model: MODELS.quality,
    max_tokens: 4000,
    system: `${baseContext}

You are generating an ALTERNATE DRAFT - a parallel perspective, not a replacement.
The writer will compare it to their original and decide what to use.

GOAL: ${goalConfig.label}
DIRECTIVE: ${goalConfig.directive}

RULES:
1. Preserve all plot events, character actions, and established facts.
2. Do not add new characters, locations, or plot points.
3. Match the approximate length of the original (within 20%).
4. After the draft, write exactly "---INTENT---" on its own line, then 2-3 sentences explaining what specific changes you made and why.`,
    messages: [{
      role: 'user',
      content: `Original:\n\n${chapter.content}\n\nGenerate the alternate draft now.`,
    }],
  });

  const fullText = response.content[0].type === 'text' ? response.content[0].text : '';
  const splitIdx = fullText.indexOf('---INTENT---');
  const draftContent = splitIdx > -1 ? fullText.slice(0, splitIdx).trim() : fullText.trim();
  const intent = splitIdx > -1 ? fullText.slice(splitIdx + 12).trim() : '';

  const newDraft: AlternateDraft = {
    id: crypto.randomUUID(),
    goal,
    content: draftContent,
    wordCount: draftContent.split(/\s+/).length,
    intent,
    createdAt: new Date().toISOString(),
  };

  const existing: AlternateDraft[] = (chapter.alternateDrafts as any) ?? [];
  const updated = [...existing, newDraft].slice(-5);

  await db.update(chapters)
    .set({ alternateDrafts: updated as any })
    .where(eq(chapters.id, params.chapterId));

  return NextResponse.json({ draft: newDraft });
}
