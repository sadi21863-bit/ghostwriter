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

  const chapData = allChapters
    .filter((c: any) => c.content?.length > 100)
    .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((c: any) => ({
      id: c.id,
      title: c.title || `Chapter ${c.sortOrder ?? ""}`,
      excerpt: (() => {
        const content = c.content;
        if (content.length <= 3000) return content;
        const start  = content.slice(0, 1200);
        const middle = content.slice(Math.floor(content.length / 2) - 400, Math.floor(content.length / 2) + 400);
        const end    = content.slice(-800);
        return `${start}\n\n[...]\n\n${middle}\n\n[...]\n\n${end}`;
      })(),
    }));

  if (chapData.length < 2) {
    return NextResponse.json({ error: "Write at least 2 chapters to generate the tension curve." }, { status: 400 });
  }

  const response = await anthropic.messages.create({
    model: MODELS.default,
    max_tokens: 2000,
    system: [{ type: "text", text: "You are a narrative structure analyst. Score each chapter on narrative tension dimensions. Return only valid JSON.", cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: `Score each chapter on three dimensions using Brewer & Lichtenstein's structural affect theory:

1. SUSPENSE (1-10): How much uncertainty about a future outcome exists? High = reader doesn't know what will happen and the stakes are clear. Low = outcome is obvious or stakes unclear.

2. CURIOSITY (1-10): How much unanswered backstory or hidden information is pulling the reader forward? High = significant information gaps exist that the reader wants closed. Low = everything is explained.

3. EMOTIONAL INTENSITY (1-10): How strong are the emotional stakes? High = characters are under significant emotional pressure or transformation. Low = emotional flat.

Also count the DIALOGUE DENSITY: what percentage of this chapter is dialogue? (0-100)

CHAPTERS:
${JSON.stringify(chapData, null, 2)}

Return ONLY valid JSON:
{
  "scores": [
    {
      "chapterId": "id",
      "title": "chapter title",
      "suspense": 5,
      "curiosity": 5,
      "emotionalIntensity": 5,
      "dialogueDensity": 30,
      "note": "one sentence describing the dominant narrative force in this chapter"
    }
  ]
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
