export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, productionShots, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { pollJob } from "@/lib/higgsfield/client";
import { put } from "@vercel/blob";
import { decrypt } from "@/lib/crypto";

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
  const sceneShots = await db.query.productionShots.findMany({
    where: and(eq(productionShots.projectId, projectId), eq(productionShots.sceneNumber, sceneNumber)),
  });
  if (sceneShots.length === 0) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

  const alreadyFinal = sceneShots.find(sh => sh.generationStatus === "final_ready" && sh.finalVideoUrl);
  if (alreadyFinal) return NextResponse.json({ status: "final_ready", videoUrl: alreadyFinal.finalVideoUrl });

  const jobShot = sceneShots.find(sh => sh.higgsfieldJobId);
  if (!jobShot) return NextResponse.json({ status: sceneShots[0].generationStatus });

  const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
  const segmindKey = decrypt(user?.segmindApiKey ?? "");
  if (!segmindKey)
    return NextResponse.json({ error: "Add your Segmind API key in Settings." }, { status: 400 });

  const [, pollingUrl] = jobShot.higgsfieldJobId!.split("|");
  const { status, mediaUrl } = await pollJob({ apiKey: segmindKey, pollingUrl });

  if (status === "COMPLETED" && mediaUrl) {
    let finalVideoUrl = mediaUrl;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const vidRes = await fetch(mediaUrl);
      const vidBuf = await vidRes.arrayBuffer();
      const blob = await put(
        `production/${projectId}/scene-${sceneNumber}/final-${Date.now()}.mp4`,
        vidBuf,
        { access: "public", contentType: "video/mp4" }
      );
      finalVideoUrl = blob.url;
    }
    await db.update(productionShots)
      .set({ finalVideoUrl, generationStatus: "final_ready", updatedAt: new Date() })
      .where(and(eq(productionShots.projectId, projectId), eq(productionShots.sceneNumber, sceneNumber)));
    return NextResponse.json({ status: "final_ready", videoUrl: finalVideoUrl });
  }

  if (status === "FAILED" || status === "ERROR") {
    await db.update(productionShots)
      .set({ generationStatus: "error", updatedAt: new Date() })
      .where(and(eq(productionShots.projectId, projectId), eq(productionShots.sceneNumber, sceneNumber)));
    return NextResponse.json({ status: "error" });
  }

  return NextResponse.json({ status: "generating_final" });
}
