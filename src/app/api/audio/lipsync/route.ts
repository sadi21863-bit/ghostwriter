import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { getUserTier } from "@/lib/subscription";
import { db } from "@/db";
import { audioExports, characters, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateLipsync, pollJob } from "@/lib/higgsfield/client";
import { decrypt } from "@/lib/crypto";

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const tier = await getUserTier(session.user.id);
  if (!["story_pro", "all_access"].includes(tier)) {
    return NextResponse.json({ error: "upgrade_required", feature: "audio_novel" }, { status: 403 });
  }

  const { audioExportId, characterId, projectId } = await req.json();
  if (!audioExportId || !characterId) {
    return NextResponse.json({ error: "audioExportId and characterId required" }, { status: 400 });
  }

  const audioExport = await db.query.audioExports.findFirst({
    where: and(eq(audioExports.id, audioExportId), eq(audioExports.projectId, projectId)),
  });
  if (!audioExport?.audioUrl) {
    return NextResponse.json({ error: "Audio export not found or not ready" }, { status: 404 });
  }

  const character = await db.query.characters.findFirst({
    where: and(eq(characters.id, characterId), eq(characters.projectId, projectId)),
  });
  if (!character?.portraitUrl) {
    return NextResponse.json({
      error: "Character needs a portrait image. Generate one first in the World Bible.",
    }, { status: 400 });
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  const apiKey = decrypt(user?.higgsfieldApiKey ?? "");
  if (!apiKey) {
    return NextResponse.json({ error: "Add your Higgsfield API key in Settings." }, { status: 400 });
  }

  const { requestId, pollingUrl } = await generateLipsync({
    apiKey,
    prompt: `${character.name}. ${character.appearance || ""}. Realistic talking head.`,
    audioUrl: audioExport.audioUrl!,
    characterImageUrl: character.portraitUrl,
    soulId: character.soulId && !character.soulId.startsWith("training:") ? character.soulId : undefined,
  });

  await db.update(audioExports)
    .set({ lipsyncJobId: requestId, lipsyncStatus: "processing" })
    .where(eq(audioExports.id, audioExportId));

  return NextResponse.json({ requestId, pollingUrl, status: "processing" });
}

export async function GET(req: Request) {
  const session = await getRequiredSession();
  const { searchParams } = new URL(req.url);
  const audioExportId = searchParams.get("audioExportId");
  if (!audioExportId) return NextResponse.json({ error: "audioExportId required" }, { status: 400 });

  const audioExport = await db.query.audioExports.findFirst({
    where: eq(audioExports.id, audioExportId),
  });
  if (!audioExport) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (audioExport.lipsyncStatus === "completed") {
    return NextResponse.json({ status: "completed", videoUrl: audioExport.lipsyncVideoUrl });
  }
  if (!audioExport.lipsyncJobId) {
    return NextResponse.json({ status: "not_started" });
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  const apiKey = decrypt(user?.higgsfieldApiKey ?? "");

  const result = await pollJob({ apiKey, pollingUrl: `https://api.segmind.com/v1/requests/${audioExport.lipsyncJobId}` });

  if (result.status === "COMPLETED" && result.mediaUrl) {
    await db.update(audioExports)
      .set({ lipsyncVideoUrl: result.mediaUrl, lipsyncStatus: "completed" })
      .where(eq(audioExports.id, audioExportId));
    return NextResponse.json({ status: "completed", videoUrl: result.mediaUrl });
  }
  if (result.status === "FAILED" || result.status === "ERROR") {
    await db.update(audioExports)
      .set({ lipsyncStatus: "failed" })
      .where(eq(audioExports.id, audioExportId));
    return NextResponse.json({ status: "failed" });
  }

  return NextResponse.json({ status: "processing" });
}
