export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/auth-helpers';
import { checkAiRateLimit } from '@/lib/ratelimit';
import { db } from '@/db';
import { projects, chapters } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import { MODELS, getFormatRules } from '@/lib/ai/engine';
import { meterAndGate, refundCredits } from '@/lib/metering/meter';
import { tiptapToPlainText, isValidTipTapJson, plainTextToTipTap, getWordCount } from '@/lib/editor/content-migration';

const anthropic = new Anthropic();

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const { sourceProjectId, sourceChapterId } = await req.json() as { sourceProjectId: string; sourceChapterId: string };
  const { projectId: targetProjectId } = await params;

  const target = await db.query.projects.findFirst({
    where: and(eq(projects.id, targetProjectId), eq(projects.userId, session.user.id)),
  });
  if (!target || target.adaptedFromProjectId !== sourceProjectId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const sourceChapter = await db.query.chapters.findFirst({
    where: and(eq(chapters.id, sourceChapterId), eq(chapters.projectId, sourceProjectId)),
  });
  if (!sourceChapter) return NextResponse.json({ error: 'Source chapter not found' }, { status: 404 });

  const gate = await meterAndGate(session.user.id, 'adapt-chapter');
  if (gate) return gate;

  try {
    const sourceText = sourceChapter.content && isValidTipTapJson(sourceChapter.content)
      ? tiptapToPlainText(JSON.parse(sourceChapter.content))
      : (sourceChapter.content ?? '');

    const response = await anthropic.messages.create({
      model: MODELS.default,
      max_tokens: 4000,
      system: [{
        type: 'text',
        text: getFormatRules(target.format).trim() + '\n\nConvert the following novel chapter into a screenplay scene. Preserve all narrative content, dialogue, and character actions — adapt the FORM, not the substance. Multiple INT./EXT. scene headings are expected if the source chapter spans more than one location or time. Output only the converted screenplay text, no preamble or explanation.',
        cache_control: { type: 'ephemeral' },
      }],
      messages: [{ role: 'user', content: sourceText }],
    });

    const convertedText = response.content.filter(b => b.type === 'text').map((b: any) => b.text).join('');
    const tiptapContent = JSON.stringify(plainTextToTipTap(convertedText));

    const [newChapter] = await db.insert(chapters).values({
      projectId: target.id,
      title: sourceChapter.title,
      content: tiptapContent,
      sortOrder: sourceChapter.sortOrder,
      wordCount: getWordCount(tiptapContent),
    }).returning();

    return NextResponse.json({ chapterId: newChapter.id, title: newChapter.title, wordCount: newChapter.wordCount });
  } catch (e: any) {
    await refundCredits(session.user.id, 'adapt-chapter');
    return NextResponse.json({ error: e.message || 'Chapter conversion failed.' }, { status: 500 });
  }
}
