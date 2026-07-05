export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/auth-helpers';
import { db } from '@/db';
import { chapters, projects } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { buildContext } from '@/lib/ai/context-builder';
import { ALT_DRAFT_GOALS } from '@/lib/alt-draft/goals';
import type { AltDraftGoal, AlternateDraft } from '@/types';
import { altDraftSystemPrompt, runWriterCall } from '@/lib/roles/writer';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; chapterId: string }> }
) {
  const session = await getRequiredSession();
  const { goal } = await req.json() as { goal: AltDraftGoal };

  const chapter = await db.query.chapters.findFirst({
    where: and(eq(chapters.id, (await params).chapterId), eq(chapters.projectId, (await params).projectId)),
  });
  if (!chapter?.content?.trim()) {
    return NextResponse.json({ error: 'Chapter is empty' }, { status: 400 });
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, (await params).projectId), eq(projects.userId, session.user.id)),
    with: { characters: true, locations: true, plotThreads: true, referenceWorks: true, storyMemories: true, characterRelationships: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const goalConfig = ALT_DRAFT_GOALS[goal];
  if (!goalConfig) return NextResponse.json({ error: 'Invalid goal' }, { status: 400 });

  const baseContext = buildContext(project as any);

  const { MODELS } = await import('@/lib/ai/engine');
  const result = await runWriterCall({
    userId: session.user.id,
    operation: "alt-draft",
    model: MODELS.quality,
    maxTokens: 4000,
    system: altDraftSystemPrompt(baseContext, goalConfig.label, goalConfig.directive),
    messages: [{
      role: 'user',
      content: `Original:\n\n${chapter.content}\n\nGenerate the alternate draft now.`,
    }],
  });
  if (!result.ok) return result.response;

  const fullText = result.text;
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
    .where(eq(chapters.id, (await params).chapterId));

  return NextResponse.json({ draft: newDraft });
}
