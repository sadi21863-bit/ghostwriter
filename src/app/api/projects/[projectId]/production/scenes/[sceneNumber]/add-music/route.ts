export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, productionShots } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { put } from "@vercel/blob";
import { mixAudioIntoVideo } from "@/lib/video/concat";
import { writeFile, readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

// Mixes the scene's already-uploaded sceneAudioTrackUrl (upload-audio route)
// into its already-stitched sceneFinalVideoUrl, replacing it with the mixed
// result — a separate, explicit step from stitching itself, since a music
// file can't be known at "Generate Scene Video" time.
export async function POST(_: Request, { params }: { params: Promise<{ projectId: string; sceneNumber: string }> }) {
  const s = await getRequiredSession();
  const { projectId, sceneNumber: sceneNumberRaw } = await params;
  if (!await verifyOwnership(projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sceneNumber = Number(sceneNumberRaw);
  const sceneShots = await db.query.productionShots.findMany({
    where: and(eq(productionShots.projectId, projectId), eq(productionShots.sceneNumber, sceneNumber)),
  });
  if (sceneShots.length === 0) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

  const videoUrl = sceneShots.find(sh => sh.sceneFinalVideoUrl)?.sceneFinalVideoUrl;
  const audioUrl = sceneShots.find((sh: any) => sh.sceneAudioTrackUrl)?.sceneAudioTrackUrl;
  if (!videoUrl) return NextResponse.json({ error: "Stitch the scene video before adding music." }, { status: 400 });
  if (!audioUrl) return NextResponse.json({ error: "Upload a music track before adding music." }, { status: 400 });

  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return NextResponse.json({ error: "Blob storage is not configured." }, { status: 500 });

  const workDir = await mkdtemp(join(tmpdir(), "scene-music-"));
  try {
    const videoRes = await fetch(videoUrl);
    const videoPath = join(workDir, "video.mp4");
    await writeFile(videoPath, Buffer.from(await videoRes.arrayBuffer()));

    const audioRes = await fetch(audioUrl);
    const audioPath = join(workDir, "audio.mp3");
    await writeFile(audioPath, Buffer.from(await audioRes.arrayBuffer()));

    const outputPath = join(workDir, "mixed.mp4");
    await mixAudioIntoVideo(videoPath, audioPath, outputPath);
    const mixedBuf = await readFile(outputPath);

    const blob = await put(
      `production/${projectId}/scene-${sceneNumber}/mixed-${Date.now()}.mp4`,
      mixedBuf,
      { access: "public", contentType: "video/mp4" }
    );

    await db.update(productionShots)
      .set({ sceneFinalVideoUrl: blob.url, updatedAt: new Date() })
      .where(and(eq(productionShots.projectId, projectId), eq(productionShots.sceneNumber, sceneNumber)));

    return NextResponse.json({ status: "final_ready", videoUrl: blob.url });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
