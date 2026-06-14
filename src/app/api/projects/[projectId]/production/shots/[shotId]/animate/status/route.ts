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

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string; shotId: string }> }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership((await params).projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const shot = await db.query.productionShots.findFirst({
    where: and(eq(productionShots.id, (await params).shotId), eq(productionShots.projectId, (await params).projectId)),
  });
  if (!shot) return NextResponse.json({ error: "Shot not found" }, { status: 404 });

  if (shot.generationStatus === "animated")
    return NextResponse.json({ status: "animated", videoUrl: shot.animatedVideoUrl });

  if (!shot.higgsfieldJobId)
    return NextResponse.json({ status: shot.generationStatus });

  const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
  const higgsfieldKey = decrypt(user?.higgsfieldApiKey ?? "");
  if (!higgsfieldKey)
    return NextResponse.json({ error: "API key missing" }, { status: 400 });

  const [, pollingUrl] = shot.higgsfieldJobId.split("|");
  const { status, mediaUrl } = await pollJob({ apiKey: higgsfieldKey, pollingUrl });

  if (status === "COMPLETED" && mediaUrl) {
    let animatedVideoUrl = mediaUrl;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const vidRes = await fetch(mediaUrl);
      const vidBuf = await vidRes.arrayBuffer();
      const blob = await put(
        `production/${(await params).projectId}/${(await params).shotId}/animated-${Date.now()}.mp4`,
        vidBuf,
        { access: "public", contentType: "video/mp4" }
      );
      animatedVideoUrl = blob.url;
    }
    await db.update(productionShots)
      .set({ animatedVideoUrl, generationStatus: "animated", updatedAt: new Date() })
      .where(eq(productionShots.id, (await params).shotId));
    return NextResponse.json({ status: "animated", videoUrl: animatedVideoUrl });
  }

  if (status === "FAILED" || status === "ERROR") {
    await db.update(productionShots)
      .set({ generationStatus: "error", updatedAt: new Date() })
      .where(eq(productionShots.id, (await params).shotId));
    return NextResponse.json({ status: "error" });
  }

  return NextResponse.json({ status: "animating" });
}
