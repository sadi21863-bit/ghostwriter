import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { storyMemories, chapters, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/engine";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function safeParseJson(raw: string) {
  const clean = raw.replace(/```json\n?|```/g, "").trim();
  try { return JSON.parse(clean); } catch { return []; }
}

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function POST(_: Request, { params }: { params: { projectId: string; chapterId: string } }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership(params.projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const chapter = await db.query.chapters.findFirst({
    where: eq(chapters.id, params.chapterId),
  });
  if (!chapter?.content?.trim()) return NextResponse.json({ memories: [] });

  const msg = await client.messages.create({
    model: MODELS.fast,
    max_tokens: 800,
    system: `Extract established facts from this chapter. Return ONLY a JSON array:
[{ "fact": string, "category": "character_decision|world_rule|relationship|event|general" }]
Include: character decisions made, world rules revealed, relationship changes, key events that cannot be undone.
Max 8 facts. No summaries. Only hard facts that affect continuity.`,
    messages: [{ role: "user", content: chapter.content }],
  });

  const raw = msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("");
  const facts: { fact: string; category: string }[] = safeParseJson(raw);

  // Replace auto-extracted memories for this chapter
  await db.delete(storyMemories).where(
    and(
      eq(storyMemories.chapterId, params.chapterId),
      eq(storyMemories.autoExtracted, true)
    )
  );

  if (!facts.length) return NextResponse.json({ memories: [] });

  const inserted = await db.insert(storyMemories).values(
    facts.map(f => ({
      projectId: params.projectId,
      chapterId: params.chapterId,
      fact: f.fact,
      category: f.category || "general",
      autoExtracted: true,
      chapterIndex: chapter.sortOrder ?? 0,
    }))
  ).returning();

  return NextResponse.json({ memories: inserted });
}
