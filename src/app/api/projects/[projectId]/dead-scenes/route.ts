import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { db } from "@/db";
import { projects, chapters } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "story_modes_advanced")) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allChapters = await db.query.chapters.findMany({
    where: and(eq(chapters.projectId, params.projectId)),
  });

  const chapterSummaries = allChapters
    .filter((c: any) => c.content && c.content.length > 100)
    .map((c: any) => ({
      id: c.id,
      title: c.title || `Chapter ${c.sortOrder ?? 0}`,
      excerpt: c.content.slice(0, 800),
    }));

  if (chapterSummaries.length === 0) {
    return NextResponse.json({ deadScenes: [], message: "No chapters to analyse yet." });
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: `Analyse each chapter for McKee's scene value shift test. A scene is alive when at least one of these three changes: (1) power balance between characters, (2) emotional state of a character, (3) information available to the reader. A scene where none of these change is narratively dead regardless of how well it is written.

CHAPTERS:
${JSON.stringify(chapterSummaries, null, 2)}

For each chapter, score it:
- Power shift: 0 (no change) or 1 (change detected)
- Emotional delta: 0 or 1
- Information delta: 0 or 1
Total score 0-3. Score 0 = dead scene.

Return ONLY valid JSON:
{
  "results": [
    {
      "chapterId": "id",
      "title": "chapter title",
      "powerShift": 0,
      "emotionalDelta": 0,
      "informationDelta": 0,
      "totalScore": 0,
      "verdict": "alive | thin | dead",
      "diagnosis": "one sentence: what is or isn't changing",
      "suggestion": "one sentence fix (only for scores 0-1)"
    }
  ],
  "summary": { "total": 0, "dead": 0, "thin": 0, "alive": 0 }
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
