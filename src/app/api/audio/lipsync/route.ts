export const dynamic = 'force-dynamic';
// Vercel Hobby plan caps Serverless Function maxDuration at 300s (hard limit,
// not just a default) — values above it fail the entire deployment, not just
// this route. generateLipsync's own internal timeout may still exceed this;
// long lipsync jobs will hit this route's timeout first on Hobby.
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { getUserTier } from "@/lib/subscription";
import { db } from "@/db";
import { audioExports, characters, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateLipsync } from "@/lib/higgsfield/client";
import { decrypt } from "@/lib/crypto";
import { scheduleCallback } from "@/lib/queue/qstash";
import { pollAndUpdateLipsync } from "@/lib/audio/poll-lipsync";

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
  // Lipsync routes through Segmind (api.segmind.com), not Higgsfield's native API.
  const apiKey = decrypt(user?.segmindApiKey ?? "");
  if (!apiKey) {
    return NextResponse.json({ error: "Add your Segmind API key in Settings." }, { status: 400 });
  }

  const { requestId, pollingUrl, mediaUrl } = await generateLipsync({
    apiKey,
    audioUrl: audioExport.audioUrl!,
    characterImageUrl: character.portraitUrl,
  });

  // This endpoint returns the finished video synchronously (raw binary, already
  // uploaded to Blob by generateLipsync) rather than a job to poll for.
  if (mediaUrl) {
    await db.update(audioExports)
      .set({ lipsyncVideoUrl: mediaUrl, lipsyncStatus: "completed" })
      .where(eq(audioExports.id, audioExportId));
    return NextResponse.json({ status: "completed", videoUrl: mediaUrl });
  }

  // Stored as "requestId|pollingUrl" (same convention as productionShots.
  // higgsfieldJobId) so the poll side reuses the real URL generateLipsync
  // returned instead of guessing the endpoint shape.
  await db.update(audioExports)
    .set({ lipsyncJobId: `${requestId}|${pollingUrl}`, lipsyncStatus: "processing" })
    .where(eq(audioExports.id, audioExportId));

  // Server-scheduled poll (see src/lib/queue/qstash.ts) — keeps the job
  // progressing even if the user closes the tab, same pattern as production
  // shot video generation. A no-op when QSTASH_TOKEN isn't set: the existing
  // client-driven GET polling below is completely unaffected either way.
  const origin = new URL(req.url).origin;
  await scheduleCallback({
    url: `${origin}/api/queue/segmind-lipsync-poll`,
    body: { userId: session.user.id, audioExportId, attempt: 0 },
    delaySeconds: 15,
  });

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
  const apiKey = decrypt(user?.segmindApiKey ?? "");

  const result = await pollAndUpdateLipsync({ audioExportId, segmindApiKey: apiKey });

  if (result.outcome === "completed") {
    return NextResponse.json({ status: "completed", videoUrl: result.videoUrl });
  }
  if (result.outcome === "failed") {
    return NextResponse.json({ status: "failed" });
  }

  return NextResponse.json({ status: "processing" });
}
