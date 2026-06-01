import { NextRequest, NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/auth-helpers';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '@/lib/ai/engine';

interface QualityCheckRequest {
  output: string;
  projectRules: string[];
  involvedCharacters: {
    name: string;
    knowledgeMap?: Record<string, { state: string; entityName: string; belief?: string }>;
    nvcBaseline?: string;
  }[];
  emotionalTone?: string;
  arcPosition?: string;
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await getRequiredSession();

  const owned = await db.query.projects.findFirst({
    where: and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)),
  });
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body: QualityCheckRequest = await req.json();
  const client = new Anthropic();

  const knowledgeLines = body.involvedCharacters.flatMap(c =>
    Object.values(c.knowledgeMap ?? {})
      .filter((e: any) => e.state === 'IGNORANT' || e.state === 'FALSELY_BELIEVES' || e.state === 'ACTIVELY_HIDING')
      .map((e: any) => `${c.name} is ${e.state} about ${e.entityName}${e.belief ? ` (falsely believes: ${e.belief})` : ''}`)
  ).join('\n');

  // TIER 1 — Rule compliance (Haiku, fast)
  const tier1Prompt = `You are a quality auditor for fiction. Analyze this text for rule violations.

TEXT:
${body.output}

CHECK THESE RULES:
${body.projectRules.map((r, i) => `${i + 1}. ${r}`).join('\n') || '(none)'}

CHECK THESE KNOWLEDGE STATES:
${knowledgeLines || '(none)'}

Return ONLY JSON:
{
  "ruleViolations": [{"rule": "exact rule text", "violation": "what in the text violates it", "severity": "high|medium"}],
  "knowledgeViolations": [{"character": "name", "state": "IGNORANT|etc", "entity": "what they shouldn't know", "violation": "the specific text"}],
  "povBreaks": []
}
Return empty arrays if no violations. No other text.`;

  // TIER 2 — Slop detection (Sonnet)
  const tier2Prompt = `You are a fiction quality editor. Identify slop markers in this text.

TEXT:
${body.output}

Check for:
1. Generic emotion phrases (heart raced, tears welled, wave of emotion, felt a surge of, etc.)
2. Named emotions when NVC baselines exist (character shows emotion physically, not stating it)
3. Cliché metaphors or similes
4. Adverb-heavy dialogue tags (said quietly, whispered menacingly, etc.)
5. Passive construction in action moments
6. Summary where scene is needed ("The next few hours were difficult" type)

Return ONLY JSON:
{
  "slopMarkers": [{"type": "generic_emotion|named_emotion|cliche|adverb_tag|passive|summary", "text": "the exact phrase", "suggestion": "brief alternative approach"}],
  "overallSignal": "strong|acceptable|weak"
}
No other text.`;

  const [tier1Response, tier2Response] = await Promise.all([
    client.messages.create({ model: MODELS.fast, max_tokens: 800, messages: [{ role: 'user', content: tier1Prompt }] }),
    client.messages.create({ model: MODELS.default, max_tokens: 800, messages: [{ role: 'user', content: tier2Prompt }] }),
  ]);

  function parseJson(text: string) {
    try { return JSON.parse(text.replace(/```json\n?|```/g, '').trim()); } catch { return null; }
  }

  const t1Text = tier1Response.content.filter(b => b.type === 'text').map(b => (b as any).text).join('');
  const t2Text = tier2Response.content.filter(b => b.type === 'text').map(b => (b as any).text).join('');

  const tier1 = parseJson(t1Text) ?? { ruleViolations: [], knowledgeViolations: [], povBreaks: [] };
  const tier2 = parseJson(t2Text) ?? { slopMarkers: [], overallSignal: 'acceptable' };

  return NextResponse.json({
    ruleViolations:      tier1.ruleViolations ?? [],
    knowledgeViolations: tier1.knowledgeViolations ?? [],
    povBreaks:           tier1.povBreaks ?? [],
    slopMarkers:         tier2.slopMarkers ?? [],
    overallSignal:       tier2.overallSignal ?? 'acceptable',
    hasIssues: (
      (tier1.ruleViolations?.length ?? 0) > 0 ||
      (tier1.knowledgeViolations?.length ?? 0) > 0 ||
      (tier2.slopMarkers?.length ?? 0) > 2
    ),
  });
}
