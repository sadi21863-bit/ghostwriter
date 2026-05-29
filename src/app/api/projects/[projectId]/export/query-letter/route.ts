import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { db } from "@/db";
import { projects, chapters, characters } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "export")) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { targetAgent } = await req.json().catch(() => ({}));

  const allChapters = await db.query.chapters.findMany({
    where: eq(chapters.projectId, params.projectId),
  });
  const allCharacters = await db.query.characters.findMany({
    where: eq(characters.projectId, params.projectId),
  });

  const wordCountEstimate = allChapters.length * 2500;
  const protagonist = allCharacters.find((c: any) => c.role?.toLowerCase().includes("protagonist") || c.role?.toLowerCase().includes("main")) || allCharacters[0];
  const antagonist = allCharacters.find((c: any) => (c as any).antagonistToggle || c.role?.toLowerCase().includes("antagonist"));

  const synopsis = allChapters
    .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .slice(0, 3)
    .map((c: any) => c.summary || c.title)
    .filter(Boolean)
    .join(" ");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [{
      role: "user",
      content: `Write an industry-format query letter for this novel. Follow the standard query letter format precisely.

PROJECT DETAILS:
- Title: ${project.name}
- Genre: ${(project as any).genres?.join(", ") || "unspecified"}
- Format: ${project.format}
- Estimated word count: ~${wordCountEstimate.toLocaleString()} words
- Protagonist: ${protagonist ? `${protagonist.name}${protagonist.role ? ` (${protagonist.role})` : ""}${protagonist.personality ? ` — ${protagonist.personality}` : ""}` : "not specified"}
- Antagonist/Conflict: ${antagonist ? `${antagonist.name}${antagonist.personality ? ` — ${antagonist.personality}` : ""}` : "not specified"}
- Synopsis/Opening: ${synopsis || "not available"}
- Story notes: ${(project as any).notes || "none"}
${targetAgent ? `- Target agent: ${targetAgent}` : ""}

QUERY LETTER FORMAT:
1. Hook (1–2 sentences) — what is compelling about this story right now?
2. Plot synopsis (2–3 paragraphs) — introduce protagonist, inciting incident, central conflict, stakes
3. Comps (1 sentence, optional if genre is clear) — "X meets Y" or comparable titles
4. Bio (1 short paragraph) — professional bio placeholder
5. Closing line

Write the complete query letter. Make it professional and compelling. Do not include placeholders — use the project details provided.`,
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return NextResponse.json({ queryLetter: text });
}
