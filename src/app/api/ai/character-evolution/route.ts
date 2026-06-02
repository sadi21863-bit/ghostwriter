// src/app/api/ai/character-evolution/route.ts
// Analyses story memories for a project's main characters and generates
// evolution updates showing how each character has changed and why.
// Called automatically every 5 chapters (fire-and-forget from client).

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier } from "@/lib/subscription";
import { db } from "@/db";
import { projects, characters, storyMemories, characterEvolutionLog } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/engine";

const anthropic = new Anthropic();

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const tier = await getUserTier(session.user.id);
  if (!["story_pro", "all_access"].includes(tier)) {
    return NextResponse.json({ skipped: true, reason: "free_tier" });
  }

  const { projectId, chapterIndex } = await req.json();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const mainChars = await db.query.characters.findMany({
    where: and(
      eq(characters.projectId, projectId),
      eq(characters.alwaysInContext, true)
    ),
  });
  if (!mainChars.length) return NextResponse.json({ skipped: true, reason: "no_main_characters" });

  const memories = await db.query.storyMemories.findMany({
    where: and(
      eq(storyMemories.projectId, projectId),
      inArray(storyMemories.category, ["character_decision", "relationship"])
    ),
  });

  const results: { characterId: string; characterName: string; evolutionSummary: any; contradictionWarning: any }[] = [];

  for (const char of mainChars) {
    const charMemories = memories.filter(m =>
      m.fact.toLowerCase().includes(char.name.toLowerCase())
    );
    if (charMemories.length < 2) continue;

    const existing = await db.query.characterEvolutionLog.findFirst({
      where: and(
        eq(characterEvolutionLog.characterId, char.id),
        eq(characterEvolutionLog.chapterIndex, chapterIndex)
      ),
    });
    if (existing) continue;

    const prompt = `You are analysing how a fictional character has evolved based on story events.

CHARACTER CURRENT PROFILE:
Name: ${char.name}
Role: ${char.role ?? "Unknown"}
Personality: ${char.personality ?? "Not specified"}
Fears: ${char.fears ?? "Not specified"}
Desires: ${char.desires ?? "Not specified"}
Arc: ${char.arc ?? "Not specified"}
Speech pattern: ${char.speechPattern ?? "Not specified"}

STORY EVENTS INVOLVING THIS CHARACTER (character decisions and relationship changes):
${charMemories.map(m => `- ${m.fact}`).join("\n")}

Current chapter: ${chapterIndex + 1}

Based on these events, analyse how this character has realistically changed. Characters change through what happens to them — their fears, desires, personality, speech patterns, and relationships evolve.

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "hasEvolved": true/false,
  "evolutionSummary": "Plain English 2-3 sentence summary of how this character has changed and why",
  "updatedTraits": {
    "personality": "updated value or null if unchanged",
    "fears": "updated value or null if unchanged",
    "desires": "updated value or null if unchanged",
    "speechPattern": "updated value or null if unchanged",
    "arc": "updated value or null if unchanged"
  },
  "contradictionWarning": "Warning text if the character's recent events contradict their established traits, or null"
}`;

    try {
      const response = await anthropic.messages.create({
        model: MODELS.default,
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const clean = text.replace(/```json\n?|```/g, "").trim();
      const analysis = JSON.parse(clean);

      if (!analysis.hasEvolved) continue;

      const previousState = {
        personality: char.personality,
        fears: char.fears,
        desires: char.desires,
        speechPattern: char.speechPattern,
        arc: char.arc,
      };

      await db.insert(characterEvolutionLog).values({
        projectId,
        characterId: char.id,
        chapterIndex,
        triggerMemoryIds: charMemories.map(m => m.id),
        previousState,
        updatedTraits: analysis.updatedTraits,
        evolutionSummary: analysis.evolutionSummary,
      });

      const updateData: Record<string, string> = {};
      if (analysis.updatedTraits.personality) updateData.personality = analysis.updatedTraits.personality;
      if (analysis.updatedTraits.fears)       updateData.fears = analysis.updatedTraits.fears;
      if (analysis.updatedTraits.desires)     updateData.desires = analysis.updatedTraits.desires;
      if (analysis.updatedTraits.speechPattern) updateData.speechPattern = analysis.updatedTraits.speechPattern;
      if (analysis.updatedTraits.arc)         updateData.arc = analysis.updatedTraits.arc;

      if (Object.keys(updateData).length > 0) {
        await db.update(characters).set(updateData).where(eq(characters.id, char.id));
      }

      results.push({
        characterId: char.id,
        characterName: char.name,
        evolutionSummary: analysis.evolutionSummary,
        contradictionWarning: analysis.contradictionWarning,
      });

    } catch {
      continue;
    }
  }

  return NextResponse.json({ evolved: results });
}
