export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, productionShots, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { pollJob } from "@/lib/higgsfield/client";
import { put } from "@vercel/blob";
import { decrypt } from "@/lib/crypto";
import { concatVideos } from "@/lib/video/concat";
import { writeFile, readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string; sceneNumber: string }> }) {
  const s = await getRequiredSession();
  const { projectId, sceneNumber: sceneNumberRaw } = await params;
  if (!await verifyOwnership(projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sceneNumber = Number(sceneNumberRaw);
  let sceneShots = await db.query.productionShots.findMany({
    where: and(eq(productionShots.projectId, projectId), eq(productionShots.sceneNumber, sceneNumber)),
    orderBy: (sh, { asc }) => [asc(sh.shotNumber)],
  });
  if (sceneShots.length === 0) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

  const alreadyStitched = sceneShots.find(sh => sh.sceneFinalVideoUrl);
  if (alreadyStitched) return NextResponse.json({ status: "final_ready", videoUrl: alreadyStitched.sceneFinalVideoUrl });

  const pending = sceneShots.filter(sh => sh.generationStatus === "generating_final" && sh.higgsfieldJobId);
  if (pending.length > 0) {
    const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
    const segmindKey = decrypt(user?.segmindApiKey ?? "");
    if (!segmindKey)
      return NextResponse.json({ error: "Add your Segmind API key in Settings." }, { status: 400 });

    for (const shot of pending) {
      const [, pollingUrl] = shot.higgsfieldJobId!.split("|");
      const { status, mediaUrl } = await pollJob({ apiKey: segmindKey, pollingUrl });

      if (status === "COMPLETED" && mediaUrl) {
        await db.update(productionShots)
          .set({ finalVideoUrl: mediaUrl, generationStatus: "final_ready", updatedAt: new Date() })
          .where(eq(productionShots.id, shot.id));
      } else if (status === "FAILED" || status === "ERROR") {
        await db.update(productionShots)
          .set({ generationStatus: "error", updatedAt: new Date() })
          .where(eq(productionShots.id, shot.id));
        return NextResponse.json({ status: "error" });
      }
    }

    // Re-read after this round of polling — some shots may have just completed.
    sceneShots = await db.query.productionShots.findMany({
      where: and(eq(productionShots.projectId, projectId), eq(productionShots.sceneNumber, sceneNumber)),
      orderBy: (sh, { asc }) => [asc(sh.shotNumber)],
    });
  }

  const stillPending = sceneShots.some(sh => sh.generationStatus !== "final_ready" || !sh.finalVideoUrl);
  if (stillPending) return NextResponse.json({ status: "generating_final" });

  // Stitching produces a genuinely new file with no provider URL to fall back
  // to (unlike the per-shot routes, which can return the raw Segmind URL when
  // Blob isn't configured) — fail fast here, before downloading/running
  // ffmpeg, rather than failing deep inside put() after that work is done.
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return NextResponse.json({ error: "Blob storage is not configured." }, { status: 500 });

  // Every shot is final_ready — stitch them together in shot-number order.
  const workDir = await mkdtemp(join(tmpdir(), "scene-stitch-"));
  try {
    const localPaths: string[] = [];
    for (const shot of sceneShots) {
      const res = await fetch(shot.finalVideoUrl!);
      const buf = Buffer.from(await res.arrayBuffer());
      const localPath = join(workDir, `${shot.shotNumber}.mp4`);
      await writeFile(localPath, buf);
      localPaths.push(localPath);
    }

    const outputPath = join(workDir, "stitched.mp4");
    await concatVideos(localPaths, outputPath);
    const stitchedBuf = await readFile(outputPath);

    const blob = await put(
      `production/${projectId}/scene-${sceneNumber}/stitched-${Date.now()}.mp4`,
      stitchedBuf,
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
