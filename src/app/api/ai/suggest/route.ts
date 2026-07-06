export const dynamic = 'force-dynamic';

// src/app/api/ai/suggest/route.ts
// Active AI suggestion — user-triggered, Pro only.
// One AI call returning structured JSON covering 4 check categories.

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { db } from "@/db";
import { projects, characters, storyMemories } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { anthropic } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/engine";


export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const gate = await meterAndGate(session.user.id, "suggest");
  if (gate) return gate;

  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "ai_suggestion_active")) {
    return NextResponse.json({ error: "upgrade_required", feature: "ai_suggestion_active" }, { status: 403 });
  }

  const { projectId, chapterId, chapterContent } = await req.json();
  if (!chapterContent || chapterContent.length < 100) {
    return NextResponse.json({ suggestions: [] });
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const mainChars = await db.query.characters.findMany({
    where: and(eq(characters.projectId, projectId), eq(characters.alwaysInContext, true)),
  });

  const recentMemories = await db.query.storyMemories.findMany({
    where: eq(storyMemories.projectId, projectId),
    orderBy: [desc(storyMemories.createdAt)],
    limit: 15,
  });

  const charContext = mainChars.map(c =>
    `${c.name}: personality="${c.personality ?? ""}", fears="${c.fears ?? ""}", speech="${c.speechPattern ?? ""}"`
  ).join("\n");

  const memoryContext = recentMemories.map(m => `[${m.category}] ${m.fact}`).join("\n");

  const prompt = `You are reviewing a chapter of a novel for a writer. Analyse the following chapter content and identify specific issues.

PROJECT: ${project.name} | Format: ${project.format}

ESTABLISHED CHARACTERS:
${charContext || "None defined yet"}

ESTABLISHED FACTS (story memories):
${memoryContext || "None yet"}

CHAPTER CONTENT TO REVIEW:
${chapterContent.slice(0, 3000)}

Return ONLY valid JSON (no markdown):
{
  "suggestions": [
    {
      "category": "continuity" | "character_voice" | "world_rule" | "pacing",
      "severity": "warning" | "info",
      "message": "Specific, actionable description of the issue",
      "excerpt": "The exact phrase or sentence from the chapter that has the issue (max 80 chars)",
      "fix": "One specific sentence explaining how to address it"
    }
  ]
}

Rules for suggestions:
- Only flag real issues, not stylistic preferences
- Be specific: quote the exact text with the problem
- Maximum 5 suggestions total
- Only include continuity issues if they contradict established facts above
- Only include character_voice issues if the speech contradicts the established speech pattern
- Pacing issues: note if a chapter is all dialogue with no action, or all action with no interiority
- If the chapter is good, return an empty suggestions array`;

  try {
    const response = await anthropic.messages.create({
      model: MODELS.default,
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content.filter(b => b.type === "text").map(b => (b as any).text).join("") || "{}";
    const clean = text.replace(/```json\n?|```/g, "").trim();

    try {
      const result = JSON.parse(clean);
      return NextResponse.json(result);
    } catch {
      return NextResponse.json({ suggestions: [] });
    }
  } catch (e: any) {
    await refundCredits(session.user.id, "suggest");
    return NextResponse.json({ suggestions: [] });
  }
}
