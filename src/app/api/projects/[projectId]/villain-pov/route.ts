export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { db } from "@/db";
import { projects, characters } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { MODELS } from "@/lib/ai/engine";
import { villainPovSystemPrompt, runDirectorCall } from "@/lib/roles/director";
import { buildPromiseLedger } from "@/lib/ai/promise-ledger";
import { buildVoiceExemplars } from "@/lib/ai/exemplars";
import { buildModeTechniqueContext } from "@/lib/ai/mode-technique-context";
import { suggestCombatStyleForCharacter } from "@/lib/ai/character-combat-style";


export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "story_modes_advanced")) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }

  const { projectId } = await params;

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { characterId, sceneDescription, combatStyleA, combatStyleB } = await req.json();
  if (!characterId || !sceneDescription?.trim()) {
    return NextResponse.json({ error: "characterId and sceneDescription are required" }, { status: 400 });
  }

  const character = await db.query.characters.findFirst({
    where: and(eq(characters.id, characterId), eq(characters.projectId, projectId)),
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

  // If the caller didn't explicitly name a combat style, check whether the antagonist's
  // own World Bible skills already establish one (e.g. a "Krav Maga" skill entry) — grounds
  // the fight in what the author already decided about this character instead of always
  // requiring a blind manual pick from the style list.
  const effectiveCombatStyleA = combatStyleA || suggestCombatStyleForCharacter(character) || undefined;

  const [promiseLedger, voiceExemplars] = await Promise.all([
    buildPromiseLedger(projectId, "generate"),
    buildVoiceExemplars(session.user.id, sceneDescription, effectiveCombatStyleA ? "combat" : undefined),
  ]);
  // An antagonist POV scene is very plausibly a fight (the villain rationalizing
  // violence from their own side of it) — if a combat style is known (explicit or
  // inferred), ground it in the same biomechanics library the Writer's dedicated
  // Combat mode uses, instead of leaving villain-pov fights generic.
  const combatContext = buildModeTechniqueContext({
    mode: "combat",
    combatStyleA: effectiveCombatStyleA,
    combatStyleB,
    // effectiveCombatStyleA always belongs to this route's own character (explicit
    // param or inferred from their own World Bible skill) - binding the name fixes
    // a real observed bug (item 58) where the style's terminology attached to the
    // wrong fighter in the prose. combatStyleB's owner is unknown here (no opponent
    // character is passed to this route), so it's deliberately left unbound rather
    // than guessed.
    combatStyleAOwner: effectiveCombatStyleA ? character.name : undefined,
  });
  const extra = [promiseLedger, voiceExemplars, combatContext].filter(Boolean).join("\n\n");
  const system = villainPovSystemPrompt(character.name, character.role, profileNote, character.personality, character.desires)
    + (extra ? `\n\n${extra}` : "");

  const result = await runDirectorCall({
    userId: session.user.id,
    operation: "villain-pov",
    model: MODELS.default,
    maxTokens: 4000,
    system,
    messages: [{ role: "user", content: sceneDescription }],
  });
  if (!result.ok) return result.response;

  return NextResponse.json({ text: result.text });
}
