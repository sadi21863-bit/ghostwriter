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
  const higgsfieldKey = decrypt(user?.higgsfieldApiKey ?? "");
  if (!higgsfieldKey)
    return NextResponse.json({ error: "Add your Higgsfield API key in Settings." }, { status: 400 });

  const { projectId: pid, shotId } = await params;
  const shot = await db.query.productionShots.findFirst({
    where: and(eq(productionShots.id, shotId), eq(productionShots.projectId, pid)),
  });
  if (!shot) return NextResponse.json({ error: "Shot not found" }, { status: 404 });

  const { model } = await req.json();
  const validModels = ACTIVE_VIDEO_MODELS.map(m => m.id);
  if (!validModels.includes(model))
    return NextResponse.json({ error: "Invalid model" }, { status: 400 });

  const { requestId, pollingUrl } = await generateTextVideo({
    apiKey: higgsfieldKey,
    prompt: shot.videoPrompt || shot.soulPrompt || "Cinematic scene",
    model: model as VideoModelId,
    cameraPreset: shot.cameraPreset || undefined,
    viralPreset: shot.viralPreset || undefined,
  });

  const [updated] = await db
    .update(productionShots)
    .set({ generationStatus: "generating_final", higgsfieldJobId: `${requestId}|${pollingUrl}`, updatedAt: new Date() })
    .where(and(eq(productionShots.id, shotId), eq(productionShots.projectId, pid)))
    .returning();

  return NextResponse.json({ shot: updated, jobId: requestId, status: "generating_final" });
}
