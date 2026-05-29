import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { db } from "@/db";
import { projects, characters } from "@/db/schema";
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

  const { characterId, sceneDescription } = await req.json();
  if (!characterId || !sceneDescription?.trim()) {
    return NextResponse.json({ error: "characterId and sceneDescription are required" }, { status: 400 });
  }

  const character = await db.query.characters.findFirst({
    where: and(eq(characters.id, characterId), eq(characters.projectId, params.projectId)),
  });
  if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 });

  const typeMap: Record<string, string> = {
    Narcissist:    "This character genuinely believes in their own special status. Every slight is an injustice. Every obstacle is an undeserved insult. The protagonist appears as someone who refuses to acknowledge what this character clearly deserves.",
    Machiavellian: "This character sees the board and everyone on it as pieces. The protagonist is an obstacle to a legitimate goal, perhaps useful in some contexts, but currently blocking progress. There is no malice here — only strategy.",
    Psychopath:    "This character feels no anticipatory anxiety about consequences that constrain other people. The protagonist's resistance appears baffling — why not simply take what you want? The character is not cruel; they are simply unrestrained in ways others cannot imagine.",
    Ideological:   "This character believes they are right and history will vindicate them. The protagonist represents either complicit cowardice or active obstruction of the necessary. The harm this character causes is regrettable but required.",
    Systemic:      "This is not a single character's POV but the POV of the institution — the logic of the organization, the rule, the precedent. The protagonist appears as an anomaly, a disruption, an exception the system was not designed to accommodate.",
  };

  const profileNote = character.antagonistType && typeMap[character.antagonistType as string]
    ? typeMap[character.antagonistType as string]
    : "This character believes they are acting correctly. The protagonist appears as an obstacle to something they genuinely want.";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: `You are writing a scene from the antagonist's point of view. In this scene, the antagonist is correct and the protagonist is an obstacle.

VILLAIN PERSPECTIVE RULES (non-negotiable):
• The antagonist does not experience themselves as the antagonist. They are the protagonist of their own story.
• The protagonist appears as an obstacle to a comprehensible, legitimate goal — not as the hero.
• The antagonist's motivation must be internally coherent. The reader should be able to understand — not necessarily agree with — their position.
• No mustache-twirling. No self-aware villainy. No "I am evil." The antagonist believes they are right.
• The antagonist's internal logic is complete. They have a version of events in which they are fully justified.

CHARACTER PROFILE: ${character.name}${character.role ? ` (${character.role})` : ""}
${profileNote}
${character.personality ? `Personality: ${character.personality}` : ""}
${character.desires ? `Core desire: ${character.desires}` : ""}

Write only the scene. No preamble.`,
    messages: [{
      role: "user",
      content: sceneDescription,
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return NextResponse.json({ text });
}
