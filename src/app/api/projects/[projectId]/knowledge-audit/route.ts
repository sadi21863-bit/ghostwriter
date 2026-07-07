export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/auth-helpers';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { MODELS } from '@/lib/ai/engine';
import { getUserTier, canAccessFeature } from '@/lib/subscription';
import { knowledgeAuditSystemPrompt, runEditorCall } from '@/lib/roles/editor';
import { buildPromiseSemanticHints } from '@/lib/story/promise-cross-reference';

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
      chapters:     { orderBy: (c, { asc }) => [asc(c.sortOrder)] },
      characters:   true,
      locations:    true,
      // Structured, user-authored promise ledger (Promise Tracker panel) —
      // ground truth for the PROMISE/PAYOFF check below, so it doesn't rely
      // purely on the LLM inferring promises from raw manuscript text.
      storyThreads: { with: { promises: true } },
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

  const promiseRef = ((project as any).storyThreads ?? []).map((t: any) => {
    const parts = [`Thread: ${t.name} (${t.threadType}, ${t.status})`];
    for (const p of t.promises ?? []) {
      parts.push(`  - Promise [priority ${p.priority}, ${p.status}]: ${p.setup}${p.payoffIntent ? ` → intended payoff: ${p.payoffIntent}` : ''}`);
    }
    return parts.join('\n');
  }).join('\n\n');

  // Semantic cross-reference hints (extends the literal promiseRef above) —
  // catches a promise that's "the same setup, worded differently" than what's
  // actually in the manuscript, which exact-text injection alone can't. A
  // no-op when neither the promises nor the chapters have embeddings yet
  // (both are computed lazily, on save — see items 52/this item).
  const allPromises = ((project as any).storyThreads ?? []).flatMap((t: any) => t.promises ?? []);
  const semanticHints = buildPromiseSemanticHints(allPromises, chapters);

  const result = await runEditorCall({
    userId: session.user.id,
    operation: "knowledge-audit",
    model: MODELS.default,
    maxTokens: 3000,
    system: knowledgeAuditSystemPrompt(chapters.length),
    messages: [{
      role: 'user',
      content: `WORLD BIBLE (character reference):
${characterRef || 'No character profiles defined.'}

STRUCTURED PROMISE TRACKER (user-authored, ground truth):
${promiseRef || 'No promises/threads tracked yet — infer promise/payoff purely from the manuscript.'}
${semanticHints ? `\nSEMANTIC CROSS-REFERENCE HINTS (unconfirmed leads, verify against the manuscript before treating as fact):\n${semanticHints}\n` : ''}
MANUSCRIPT:
${manuscript.slice(0, 180000)}`,
    }],
  });
  if (!result.ok) return result.response;

  const clean = result.text.replace(/```json\n?|```/g, '').trim();

  try {
    const result = JSON.parse(clean);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Audit failed to parse. Try again.' }, { status: 422 });
  }
}
