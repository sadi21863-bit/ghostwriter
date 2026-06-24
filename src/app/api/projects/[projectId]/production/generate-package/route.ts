export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { db } from "@/db";
import { projects, productionShots, characters, locations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/engine";
import { PRODUCTION_PACKAGE_SYSTEM_PROMPT } from "@/lib/ai/prompts";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

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

  const systemPrompt = PRODUCTION_PACKAGE_SYSTEM_PROMPT;

  const userPrompt = `Project: "${project.name}" | Format: ${project.format} | Genres: ${(project.genres as string[]).join(", ")}

CHARACTERS:
${charsText || "None defined"}

LOCATIONS:
${locsText || "None defined"}

CHAPTERS:
${chaptersText || "(no chapters written yet)"}

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
      "soulIdPrompt": "Soul 2.0 optimised: face, hair, eyes, build, clothing. 3-4 sentences.",
      "voiceNotes": "string"
    }
  ],
  "locationSheets": [
    {
      "name": "string",
      "visualDescription": "string",
      "moodKeywords": ["string"]
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
      "lightingMood": "Golden hour",
      "timeOfDay": "Afternoon",
      "subject": "string",
      "action": "string",
      "location": "string",
      "mood": "string",
      "primaryCharacterName": "string or empty",
      "soulPrompt": "ready-to-use Soul 2.0 image prompt",
      "videoPrompt": "motion-oriented video prompt",
      "dialogue": "string or empty",
      "speaker": "string or empty"
    }
  ]
}

Generate 3-6 shots per chapter. Focus on visually interesting moments. Make prompts Higgsfield-ready.`;

  const msg = await client.messages.create({
    model: MODELS.default,
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const raw = msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  const pkg = safeParseJson(raw);
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
    dialogue: shot.dialogue ?? "",
    speaker: shot.speaker ?? "",
    sortOrder: i,
  }));

  const inserted = await db.insert(productionShots).values(toInsert).returning();

  return NextResponse.json({
    brief: pkg.projectBrief,
    characterSheets: pkg.characterSheets,
    locationSheets: pkg.locationSheets,
    shotCount: inserted.length,
  });
}
