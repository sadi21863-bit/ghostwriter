export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, productionShots, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateTextVideo } from "@/lib/higgsfield/client";
import { ACTIVE_VIDEO_MODELS, type VideoModelId } from "@/lib/higgsfield/models";
import { decrypt } from "@/lib/crypto";
import { scheduleCallback } from "@/lib/queue/qstash";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string; shotId: string }> }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership((await params).projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
  // Video generation routes through Segmind (api.segmind.com), not Higgsfield's native API.
  const segmindKey = decrypt(user?.segmindApiKey ?? "");
  if (!segmindKey)
    return NextResponse.json({ error: "Add your Segmind API key in Settings." }, { status: 400 });

  const { projectId: pid, shotId } = await params;
  const shot = await db.query.productionShots.findFirst({
    where: and(eq(productionShots.id, shotId), eq(productionShots.projectId, pid)),
  });
  if (!shot) return NextResponse.json({ error: "Shot not found" }, { status: 404 });

  const { model, duration, resolution } = await req.json();
  const validModels = ACTIVE_VIDEO_MODELS.map(m => m.id);
  if (!validModels.includes(model))
    return NextResponse.json({ error: "Invalid model" }, { status: 400 });

  // Segmind's real per-model duration ranges vary (seedance 4-15s, veo 4/6/8, etc.) and
  // buildVideoRequestBody already snaps to each model's own allowed set — this route only
  // needs a sane outer clamp so a client can't request something wildly invalid.
  const clampedDuration = typeof duration === "number" ? Math.min(15, Math.max(4, duration)) : undefined;
  const validResolutions = ["480p", "720p", "1080p", "4k"];
  const requestedResolution = validResolutions.includes(resolution) ? resolution : undefined;

  let requestId: string | undefined, pollingUrl: string | undefined, mediaUrl: string | undefined;
  try {
    ({ requestId, pollingUrl, mediaUrl } = await generateTextVideo({
      apiKey: segmindKey,
      prompt: shot.videoPrompt || shot.soulPrompt || "Cinematic scene",
      model: model as VideoModelId,
      duration: clampedDuration,
      resolution: requestedResolution,
      cameraPreset: shot.cameraPreset || undefined,
      viralPreset: shot.viralPreset || undefined,
      // Hailuo requires a starting image; harmless extra context for models that don't use it.
      imageUrl: shot.previewImageUrl || undefined,
    }));
  } catch (err) {
    console.error("generate-video submit failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Video generation failed" }, { status: 502 });
  }

  // This endpoint returns the finished video synchronously (raw binary, already
  // uploaded to Blob by generateTextVideo) rather than a job to poll for.
  if (mediaUrl) {
    const [updated] = await db
      .update(productionShots)
      .set({ generationStatus: "final_ready", finalVideoUrl: mediaUrl, updatedAt: new Date() })
      .where(and(eq(productionShots.id, shotId), eq(productionShots.projectId, pid)))
      .returning();
    return NextResponse.json({ shot: updated, status: "final_ready", videoUrl: mediaUrl });
  }

  const [updated] = await db
    .update(productionShots)
    .set({ generationStatus: "generating_final", higgsfieldJobId: `${requestId}|${pollingUrl}`, updatedAt: new Date() })
    .where(and(eq(productionShots.id, shotId), eq(productionShots.projectId, pid)))
    .returning();

  // Server-scheduled poll (see src/lib/queue/qstash.ts) — keeps the job progressing
  // even if the user closes the tab, instead of relying only on the client's own
  // status-route polling. A no-op when QSTASH_TOKEN isn't set: the existing
  // client-driven polling is completely unaffected either way.
  const origin = new URL(req.url).origin;
  await scheduleCallback({
    url: `${origin}/api/queue/segmind-video-poll`,
    body: { userId: s.user.id, projectId: pid, shotId, attempt: 0 },
    delaySeconds: 15,
  });

  return NextResponse.json({ shot: updated, jobId: requestId, status: "generating_final" });
}
