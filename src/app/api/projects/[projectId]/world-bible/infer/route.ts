export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { db } from "@/db";
import { projects, chapters } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/engine";

const anthropic = new Anthropic();

export async function POST(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "story_modes_advanced")) {
    return NextResponse.json({ error: "upgrade_required", feature: "story_modes_advanced" }, { status: 403 });
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allChapters = await db.query.chapters.findMany({
    where: and(
      eq(chapters.projectId, params.projectId),
      sql`length(${chapters.content}) > 100`
    ),
  });

  if (allChapters.length < 2) {
    return NextResponse.json(
      { error: "Write at least 2 chapters first. The system needs your writing to analyse." },
      { status: 400 }
    );
  }

  const content = allChapters
    .map((c: any) => c.content)
    .join("\n\n---\n\n")
    .slice(0, 25000);

  const response = await anthropic.messages.create({
    model: MODELS.default,
    max_tokens: 3000,
    messages: [{
      role: "user",
      content: `Extract World Bible information explicitly present in these ${project.format} chapters.
Only extract what is clearly stated or strongly implied — do not invent.

${content}

Return ONLY valid JSON, no markdown:
{
  "characters": [{ "name": "exact name", "role": "one line", "appearance": "if mentioned", "personality": "observable traits", "relationships": "explicit relationships" }],
  "locations": [{ "name": "exact name", "description": "what text says about this place" }],
  "worldRules": ["one established fact per item"],
  "timelineEvents": ["one past event per item"],
  "plotThreads": [{ "name": "thread name", "description": "what it involves" }]
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
