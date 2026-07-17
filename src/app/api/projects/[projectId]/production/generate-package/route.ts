export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { db } from "@/db";
import { projects, productionShots, characters, locations, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { MODELS } from "@/lib/ai/engine";
import { PRODUCTION_PACKAGE_SYSTEM_PROMPT, runDirectorCall } from "@/lib/roles/director";
import { buildPromiseLedger } from "@/lib/ai/promise-ledger";
import { LIGHTING_MOODS } from "@/lib/ai/shot-parameters";
import { decrypt } from "@/lib/crypto";
import { bootstrapAndTrainSoulId } from "@/lib/production/soul-id-bootstrap";


function safeParseJson(raw: string) {
  const clean = raw.replace(/```json\n?|```/g, "").trim();
  try { return JSON.parse(clean); } catch { return null; }
}

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function POST(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const promiseLedger = await buildPromiseLedger(projectId, "generate");
  const s = await getRequiredSession();
  const rl = await checkAiRateLimit(s.user.id);
  if (rl) return rl;
  if (!await verifyOwnership(projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      characters: true,
      locations: true,
      plotThreads: true,
      worldEntities: true,
      chapters: { orderBy: (c, { asc }) => [asc(c.sortOrder)] },
      referenceWorks: true,
      storyMemories: true,
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const chaptersText = project.chapters
    .map((c: any) => `CHAPTER: ${c.title}\n${c.content || "(empty)"}`)
    .join("\n\n---\n\n");
  const charsText = project.characters
    .map((c: any) => `${c.name} (${c.role || "character"}): ${c.appearance || ""} ${c.personality || ""}`.trim())
    .join("\n");
  const locsText = project.locations
    .map((l: any) => `${l.name}: ${l.description || ""}`)
    .join("\n");
  const elementsText = ((project as any).worldEntities ?? [])
    .map((e: any) => `${e.name} (${e.kind}): ${e.summary || e.description || ""}`.trim())
    .join("\n");

  const systemPrompt = PRODUCTION_PACKAGE_SYSTEM_PROMPT;

  const userPrompt = `Project: "${project.name}" | Format: ${project.format} | Genres: ${(project.genres as string[]).join(", ")}

CHARACTERS:
${charsText || "None defined"}

LOCATIONS:
${locsText || "None defined"}

WORLD ELEMENTS (objects, weapons, organizations, factions, phenomena — depict these consistently in shots that feature them):
${elementsText || "None defined"}

CHAPTERS:
${chaptersText || "(no chapters written yet)"}${promiseLedger ? `\n\n${promiseLedger}` : ""}

Generate a production package as JSON:
{
  "projectBrief": {
    "title": "string",
    "logline": "one sentence",
    "format": "string",
    "genres": ["string"],
    "tone": "string",
    "styleNotes": "string"
  },
  "characterSheets": [
    {
      "characterId": "leave empty string — route resolves",
      "name": "string",
      "role": "string",
      "soulIdPrompt": "Soul 2.0 optimised FORENSIC LOCK description in ONE tight sentence (~30-40 words): exact clothing, exact hair, exact facial features, exact build. This exact sentence gets repeated verbatim in every shot featuring this character (see SHOT CRAFT below) — specific enough to lock identity, but short, since it repeats in every shot's soulPrompt and eats into the output budget for the whole shot list.",
      "voiceNotes": "string"
    }
  ],
  "locationSheets": [
    {
      "name": "string",
      "visualDescription": "FORENSIC LOCK description in ONE tight sentence (~25-35 words): exact architecture, exact lighting, exact color palette. This exact sentence gets repeated verbatim in every shot set at this location (see SHOT CRAFT below) — keep it short, it repeats per shot.",
      "moodKeywords": ["string"]
    }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "multiShotScript": "Full combined Shot 1: ... Shot 2: ... script for this scene, using @image1-style reference tags and the identity-weight pattern"
    }
  ],
  "shots": [
    {
      "sceneNumber": 1,
      "chapterId": "leave empty string — route resolves by chapterTitle",
      "chapterTitle": "string",
      "shotNumber": 1,
      "shotType": "Medium shot",
      "cameraMovement": "Static",
      "lightingMood": "one of the LIGHTING MOOD OPTIONS below — chosen deliberately for this shot's mood, not defaulted",
      "timeOfDay": "Afternoon",
      "subject": "string",
      "action": "string",
      "location": "string",
      "mood": "string",
      "primaryCharacterName": "string or empty",
      "shotIntent": "one of: hook | reveal | reaction | escalation | reversal | payoff | insert | transition — see SHOT CRAFT below",
      "emotionalTurn": "the character's entering emotional state -> exiting emotional state in this shot, e.g. 'curious -> alarmed'. Every shot with a character must have a turn — a shot where nothing changes emotionally is a flat, cuttable shot.",
      "narrativeHandoff": "how this shot connects to the NEXT one: hard cut | match cut | bookend | reaction shot | continuation",
      "soulPrompt": "ready-to-use Soul 2.0 image prompt — MUST open with that character's/location's exact locked description repeated verbatim from characterSheets/locationSheets (see SHOT CRAFT below), then add only the shot-specific action/pose",
      "videoPrompt": "motion-oriented video prompt",
      "dialogue": "string or empty",
      "speaker": "string or empty"
    }
  ]
}

LIGHTING MOOD OPTIONS (pick per-shot, do not default every shot to the same one): ${LIGHTING_MOODS.join(" | ")}
Vary lightingMood shot to shot to match content: a tense, violent, or frightening beat should lean toward "Dramatic side light", "Backlit silhouette", "Storm light", "Fluorescent cold", or "Neon night" rather than an evenly-lit, flat default like "Golden hour" or "Overcast soft" — flat, even lighting on a high-tension beat undercuts it visually.

SHOT CRAFT — a shot list of "visually interesting moments" reads as a random highlight reel, not a story. Every real scene needs:

1. FORENSIC CONSISTENCY LOCK: write each character's soulIdPrompt and each location's visualDescription as one tight, specific sentence ONCE (see the field descriptions above — short, not exhaustive, since it repeats per shot). Every shot's soulPrompt that features that character or location must repeat that exact sentence verbatim at the start — do not re-paraphrase it fresh per shot. Verbatim repetition is what keeps a character/location looking like the same person/place across shots; a fresh paraphrase each time is the single biggest cause of a shot list feeling random and disconnected.

2. SHOT-SIZE PROGRESSION: shot size should track emotional intensity, not be picked arbitrarily. A scene builds by moving wide -> medium -> close as tension rises, then often pulls back out to wide for the resolution. Do not scatter shot sizes randomly across a scene.

3. SCENE TURN: every shot with a character needs an emotionalTurn — the character enters in one emotional state and exits in a different one (curiosity -> dread, confidence -> fear, isolation -> resolve). A shot where the emotionalTurn is "same -> same" has no reason to exist as a distinct shot.

4. NARRATIVE HANDOFF: choose deliberately how each shot hands off to the next (hard cut / match cut / bookend / reaction shot / continuation) rather than leaving shots to just be concatenated with no connective logic. When a scene or the whole shot list reaches its resolution, the FINAL shot should deliberately visually rhyme with the FIRST shot (same framing/location, contrasting emotional state — e.g. night -> dawn, oppressive -> resolved) as a bookend, per classic opening-image/closing-image craft.

5. AXIS OF ACTION: when two characters share a scene across multiple shots (e.g. a confrontation), keep the camera on one consistent side of the imaginary line between them so their spatial relationship (who's on the left/right) doesn't flip disorientingly between cuts.

6. APPEARANCE-CHANGING CHARACTERS: if a character's appearance changes significantly within this chapter (aging, injury, disguise, transformation — not just a costume change), do NOT try to describe both states in one soulIdPrompt. Output TWO separate characterSheets entries with two distinct locked descriptions, and give the second entry a name that is clearly distinct from the first (e.g. "Marcus" and "Marcus (Aged)") — two sheets sharing the exact same name resolve to the same character record and silently collide, defeating the whole point. Each shot's primaryCharacterName must then reference whichever variant is correct for that point in the story.

Generate 3-6 shots per chapter and one multiShotScript per scene. Focus on shots that actually serve the scene's turn, not just visually interesting moments. Make prompts Higgsfield-ready.`;

  const result = await runDirectorCall({
    userId: s.user.id,
    operation: "generate-package",
    model: MODELS.default,
    // Sonnet 5 runs adaptive thinking on by default (item 36's audit fixed most
    // call sites for this, but not this one) - confirmed live with real chapter
    // content: a 3-chapter project (~32K chars of real prose) consumed the
    // entire 8000-token budget on thinking with ZERO text output, not even
    // truncated JSON. 8000 was sized for short test content, not real chapters.
    // Raised again to 64000 (item 68's SHOT CRAFT addition) - confirmed live
    // that 32000 wasn't enough once shots also carry shotIntent/emotionalTurn/
    // narrativeHandoff plus a verbatim-repeated forensic-lock description: the
    // model completed rich characterSheets/locationSheets but ran out of
    // budget before emitting any shots at all (returned a truncated/deviated
    // JSON shape with a `shotCount` summary field instead of the real `shots`
    // array - not a parse-format bug, a genuine budget exhaustion). 64000 is
    // the real ceiling this tier supports.
    maxTokens: 64000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  if (!result.ok) return result.response;

  const pkg = safeParseJson(result.text);
  if (!pkg?.shots) return NextResponse.json({ error: "Failed to analyze story. Try adding chapter content first." }, { status: 500 });

  // Resolve character names to IDs — create World Bible rows for any character the
  // package introduces that doesn't exist yet, so shots stay linked for portrait-based
  // consistency (previously: a fresh project with no pre-existing characters meant every
  // shot's primaryCharacterId silently stayed null and preview generation never got a
  // reference image).
  const charMap: Record<string, string> = {};
  for (const c of project.characters) {
    charMap[c.name.toLowerCase()] = c.id;
  }
  for (const sheet of pkg.characterSheets ?? []) {
    if (!sheet?.name || charMap[sheet.name.toLowerCase()]) continue;
    const [created] = await db.insert(characters).values({
      projectId,
      name: sheet.name,
      role: sheet.role ?? "",
      appearance: sheet.soulIdPrompt ?? "",
      speechPattern: sheet.voiceNotes ?? "",
    }).returning();
    charMap[sheet.name.toLowerCase()] = created.id;
  }

  // Same gap for locations: create any new location the package introduces.
  const locMap: Record<string, string> = {};
  for (const l of project.locations) {
    locMap[l.name.toLowerCase()] = l.id;
  }
  for (const sheet of pkg.locationSheets ?? []) {
    if (!sheet?.name || locMap[sheet.name.toLowerCase()]) continue;
    const [created] = await db.insert(locations).values({
      projectId,
      name: sheet.name,
      description: sheet.visualDescription ?? "",
      atmosphere: (sheet.moodKeywords ?? []).join(", "),
    }).returning();
    locMap[sheet.name.toLowerCase()] = created.id;
  }

  // Resolve chapter titles to IDs
  const chapterMap: Record<string, string> = {};
  for (const c of project.chapters) {
    chapterMap[c.title.toLowerCase()] = c.id;
  }

  // Delete existing shots for this project (fresh slate)
  await db.delete(productionShots).where(eq(productionShots.projectId, projectId));

  const sceneScriptMap: Record<number, string> = {};
  for (const scene of pkg.scenes ?? []) {
    if (scene?.sceneNumber != null) sceneScriptMap[scene.sceneNumber] = scene.multiShotScript ?? "";
  }

  // Bulk insert shots
  const toInsert = pkg.shots.map((shot: any, i: number) => ({
    projectId: projectId,
    chapterId: chapterMap[shot.chapterTitle?.toLowerCase()] ?? null,
    sceneNumber: shot.sceneNumber ?? 1,
    shotNumber: shot.shotNumber ?? 1,
    shotType: shot.shotType ?? "Medium shot",
    cameraMovement: shot.cameraMovement ?? "Static",
    lightingMood: shot.lightingMood ?? "Golden hour",
    timeOfDay: shot.timeOfDay ?? "Afternoon",
    subject: shot.subject ?? "",
    action: shot.action ?? "",
    location: shot.location ?? "",
    mood: shot.mood ?? "",
    primaryCharacterId: shot.primaryCharacterName
      ? (charMap[shot.primaryCharacterName.toLowerCase()] ?? null)
      : null,
    soulPrompt: shot.soulPrompt ?? "",
    videoPrompt: shot.videoPrompt ?? "",
    multiShotScript: sceneScriptMap[shot.sceneNumber ?? 1] ?? "",
    dialogue: shot.dialogue ?? "",
    speaker: shot.speaker ?? "",
    sortOrder: i,
  }));

  const inserted = await db.insert(productionShots).values(toInsert).returning();

  // Auto-bootstrap real Soul ID training for primary recurring characters
  // (item 68's Task 2: closes the gap between the Director flow and this
  // codebase's existing-but-manual Soul ID training capability, item 39).
  // Fire-and-forget, deliberately NOT awaited - this involves several real
  // Segmind/Higgsfield calls (a few bootstrap images + training kickoff) and
  // must never add that latency/spend risk to every generate-package call,
  // including ones a user just wants to preview quickly. Shot generation
  // already proceeds using the text-lock soulPrompt regardless; once training
  // completes, getCharacterSoulReference() automatically prefers the real
  // soulId over the text lock for future renders - no other wiring needed.
  const primaryCharacterCounts = new Map<string, number>();
  for (const shot of pkg.shots) {
    const name = shot.primaryCharacterName;
    if (name) primaryCharacterCounts.set(name, (primaryCharacterCounts.get(name) ?? 0) + 1);
  }
  const qualifying = (pkg.characterSheets ?? []).filter((sheet: any) =>
    sheet?.name && (primaryCharacterCounts.get(sheet.name) ?? 0) >= 2
  );
  if (qualifying.length > 0) {
    (async () => {
      const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
      const segmindApiKey = decrypt(user?.segmindApiKey ?? "");
      const higgsfieldApiKey = decrypt(user?.higgsfieldApiKey ?? "");
      const higgsfieldApiSecret = decrypt(user?.higgsfieldApiSecret ?? "");
      if (!segmindApiKey || !higgsfieldApiKey || !higgsfieldApiSecret) return; // no keys configured - skip silently, text-lock remains the fallback

      for (const sheet of qualifying) {
        const characterId = charMap[sheet.name.toLowerCase()];
        if (!characterId) continue;
        const existing = await db.query.characters.findFirst({ where: eq(characters.id, characterId) });
        if (existing?.soulId) continue; // already trained - nothing to do

        const jobId = await bootstrapAndTrainSoulId({
          characterName: sheet.name,
          soulIdPrompt: sheet.soulIdPrompt ?? "",
          segmindApiKey, higgsfieldApiKey, higgsfieldApiSecret,
        });
        if (jobId) {
          await db.update(characters).set({ soulIdTrainingJobId: jobId }).where(eq(characters.id, characterId));
        }
      }
    })().catch(err => console.error("[generate-package] Soul ID bootstrap failed:", err));
  }

  return NextResponse.json({
    brief: pkg.projectBrief,
    characterSheets: pkg.characterSheets,
    locationSheets: pkg.locationSheets,
    shotCount: inserted.length,
  });
}
