export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { db } from "@/db";
import { projects, chapters } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/engine";

const anthropic = new Anthropic();

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "story_modes_advanced")) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, (await params).projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { controllingIdea } = await req.json();
  const idea = controllingIdea || (project as any).controllingIdea;

  if (!idea?.trim()) {
    return NextResponse.json({ error: "Set your Controlling Idea first (Life is X because Y)." }, { status: 400 });
  }

  if (controllingIdea) {
    if (controllingIdea.length > 500) {
      return NextResponse.json({ error: "Controlling Idea must be under 500 characters." }, { status: 400 });
    }
    await db.update(projects)
      .set({ controllingIdea: controllingIdea.trim() } as Partial<typeof projects.$inferInsert>)
      .where(eq(projects.id, (await params).projectId));
  }

  const allChapters = await db.query.chapters.findMany({
    where: and(eq(chapters.projectId, (await params).projectId)),
  });

  const chapData = allChapters
    .filter((c: any) => c.content?.length > 100)
    .map((c: any) => ({ id: c.id, title: c.title || `Chapter ${c.sortOrder ?? 0}`, excerpt: c.content.slice(0, 600) }));

  if (chapData.length === 0) return NextResponse.json({ themeSignals: [], gaps: [], symbolObjects: [] });

  const response = await anthropic.messages.create({
    model: MODELS.default,
    max_tokens: 2500,
    messages: [{
      role: "user",
      content: `Analyse these chapters for thematic development. The story's Controlling Idea is:
"${idea}"
(Format: Life is [X value] because [Y cause])

For each chapter, detect the three theme signals:
1. DIRECT — a character explicitly states a position on the story's central moral question
2. STRUCTURAL — the events of the chapter prove or disprove the Controlling Idea
3. SYMBOLIC — a recurring image, object, or environment carries the thematic charge

Also identify:
- Any recurring objects or images that could function as symbols
- Chapters with NO thematic signal (potential theme gap)
- Whether the protagonist's arc is proving or undermining the Controlling Idea

CHAPTERS:
${JSON.stringify(chapData, null, 2)}

Return ONLY valid JSON:
{
  "chapterAnalysis": [
    {
      "chapterId": "id",
      "title": "title",
      "hasDirectSignal": true, "directNote": "what was said or 'none'",
      "hasStructuralSignal": true, "structuralNote": "how events proved/disproved the idea or 'none'",
      "hasSymbolicSignal": true, "symbolicNote": "what symbol appeared or 'none'",
      "thematicScore": 0
    }
  ],
  "gaps": ["title of chapters with score 0, listed"],
  "consecutiveGaps": [["chapter A title", "chapter B title"]],
  "symbolObjects": ["recurring object or image that could carry symbolic weight"],
  "protagonistArcAssessment": "one sentence: is the arc proving or undermining the Controlling Idea?",
  "overallThematicHealth": "strong | developing | thin"
}`,
    }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
  try {
    return NextResponse.json(JSON.parse(raw.replace(/```json\n?|```/g, "").trim()));
  } catch {
    return NextResponse.json({ error: "Parse failed" }, { status: 500 });
  }
}
