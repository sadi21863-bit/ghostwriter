export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { db } from "@/db";
import { projects, chapters, characters } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { anthropic } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/engine";
import { getFormatNoun } from "@/lib/formats";


const GENRE_BLURB_CONVENTIONS: Record<string, string> = {
  Thriller:   "Thriller blurb convention: hook with a threat + escalation showing it worsens + stakes (who dies/suffers if it fails). Punchy sentences. Present tense.",
  Horror:     "Horror blurb convention: establish the mundane, introduce the wrong note, promise escalation without revealing the nature of the threat.",
  Romance:    "Romance blurb convention: introduce the two leads with their core conflict, establish the obstacle between them, and promise emotional resolution.",
  Mystery:    "Mystery blurb convention: establish the crime, introduce the sleuth with a personal stake, hint at what makes this case different.",
  Fantasy:    "Fantasy blurb convention: establish the world briefly, introduce the protagonist's unique position in it, state the world-level stakes.",
  "Sci-Fi":   "Sci-Fi blurb convention: establish the core speculative premise in one sentence, show what it means for one ordinary person, state the stakes.",
  Drama:      "Literary/Drama blurb convention: lead with voice or premise, establish the thematic question, promise emotional depth over plot.",
  default:    "Back-cover blurb convention: hook, protagonist and their central dilemma, escalating stakes, promise of resolution without spoiling it.",
};

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "export")) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, (await params).projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allChapters = await db.query.chapters.findMany({
    where: eq(chapters.projectId, (await params).projectId),
  });
  const allCharacters = await db.query.characters.findMany({
    where: eq(characters.projectId, (await params).projectId),
  });

  const genres: string[] = (project as any).genres || [];
  const primaryGenre = genres[0] || "default";
  const blurbConvention = GENRE_BLURB_CONVENTIONS[primaryGenre] || GENRE_BLURB_CONVENTIONS.default;

  const protagonist = allCharacters.find((c: any) => c.role?.toLowerCase().includes("protagonist") || c.role?.toLowerCase().includes("main")) || allCharacters[0];

  const synopsis = allChapters
    .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .slice(0, 4)
    .map((c: any) => c.summary || "")
    .filter(Boolean)
    .join(" ");

  const formatNoun = getFormatNoun(project.format);

  const response = await anthropic.messages.create({
    model: MODELS.default,
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: `Write a back-cover blurb and three tagline variants for this ${formatNoun}.

${blurbConvention}

PROJECT DETAILS:
- Title: ${project.name}
- Format: ${project.format}
- Genre: ${genres.join(", ") || "unspecified"}
- Protagonist: ${protagonist ? `${protagonist.name}${protagonist.role ? ` (${protagonist.role})` : ""}${protagonist.personality ? ` — ${protagonist.personality}` : ""}${protagonist.arc ? ` Arc: ${protagonist.arc}` : ""}` : "not specified"}
- Story summary: ${synopsis || (project as any).notes || "not available"}

Write:
1. A 130–150 word back-cover blurb. Tight, compelling, genre-appropriate.
2. Three tagline variants (one line each): (a) character-led, (b) stakes-led, (c) thematic.

Return JSON:
{
  "blurb": "the full blurb",
  "taglines": ["character tagline", "stakes tagline", "thematic tagline"]
}`,
    }],
  });

  const raw = response.content.filter(b => b.type === "text").map(b => (b as any).text).join("") || "{}";
  try {
    return NextResponse.json(JSON.parse(raw.replace(/```json\n?|```/g, "").trim()));
  } catch {
    return NextResponse.json({ error: "Parse failed" }, { status: 500 });
  }
}
