export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, productionShots, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateTextVideo } from "@/lib/higgsfield/client";
import { decrypt } from "@/lib/crypto";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

// Multi-shot reference_images is only confirmed for Seedance 2.0 (see
// docs/superpowers/plans/2026-06-25-anti-slop-multishot-remediation.md) — every
// other model keeps using the existing per-shot generate-video route unchanged.
export async function POST(_: Request, { params }: { params: Promise<{ projectId: string; sceneNumber: string }> }) {
  const s = await getRequiredSession();
  const { projectId, sceneNumber: sceneNumberRaw } = await params;
  if (!await verifyOwnership(projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sceneNumber = Number(sceneNumberRaw);

  const sceneShots = await db.query.productionShots.findMany({
    where: and(eq(productionShots.projectId, projectId), eq(productionShots.sceneNumber, sceneNumber)),
    with: { primaryCharacter: true },
    orderBy: (sh, { asc }) => [asc(sh.shotNumber)],
  });
  if (sceneShots.length === 0) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

  const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
  const segmindKey = decrypt(user?.segmindApiKey ?? "");
  if (!segmindKey)
    return NextResponse.json({ error: "Add your Segmind API key in Settings." }, { status: 400 });

  const storedScript = sceneShots.find(sh => sh.multiShotScript)?.multiShotScript;
  const multiShotPrompt = storedScript
    || sceneShots.map(sh => `Shot ${sh.shotNumber}: ${sh.videoPrompt || sh.soulPrompt || ""}`).join(" ");

  // Only character.portraitUrl (AI-generated via generateSoulImage, this feature's
  // own portrait pipeline) is ever used as a reference — never a user-supplied photo.
  const referenceImages = Array.from(new Set(
    sceneShots.map(sh => (sh as any).primaryCharacter?.portraitUrl).filter((u: any): u is string => !!u)
  )).slice(0, 9);

  const { requestId, pollingUrl, mediaUrl } = await generateTextVideo({
    apiKey: segmindKey,
    model: "seedance",
    multiShotPrompt,
    referenceImages,
  });

  if (mediaUrl) {
    await db.update(productionShots)
      .set({ finalVideoUrl: mediaUrl, generationStatus: "final_ready", updatedAt: new Date() })
      .where(and(eq(productionShots.projectId, projectId), eq(productionShots.sceneNumber, sceneNumber)));
    return NextResponse.json({ status: "final_ready", videoUrl: mediaUrl });
  }

  await db.update(productionShots)
    .set({ generationStatus: "generating_final", higgsfieldJobId: `${requestId}|${pollingUrl}`, updatedAt: new Date() })
    .where(and(eq(productionShots.projectId, projectId), eq(productionShots.sceneNumber, sceneNumber)));

  return NextResponse.json({ jobId: requestId, status: "generating_final" });
}
