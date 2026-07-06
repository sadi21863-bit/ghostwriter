export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, productionShots } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { put } from "@vercel/blob";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

// First file-upload route in this codebase (see docs/superpowers/plans for
// post-production slice 2c) — the client sends the raw file as
// multipart/form-data rather than talking to Blob directly, so every Blob
// upload in this app keeps going through one server-side put() pattern.
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string; sceneNumber: string }> }) {
  const s = await getRequiredSession();
  const { projectId, sceneNumber: sceneNumberRaw } = await params;
  if (!await verifyOwnership(projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sceneNumber = Number(sceneNumberRaw);

  const formData = await req.formData();
  const file = formData.get("audio");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No audio file provided." }, { status: 400 });
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "audio";
  const buf = Buffer.from(await file.arrayBuffer());
  const blob = await put(
    `production/${projectId}/scene-${sceneNumber}/audio-${Date.now()}.${ext}`,
    buf,
    { access: "public", contentType: file.type || "audio/mpeg" }
  );

  await db.update(productionShots)
    .set({ sceneAudioTrackUrl: blob.url, updatedAt: new Date() })
    .where(and(eq(productionShots.projectId, projectId), eq(productionShots.sceneNumber, sceneNumber)));

  return NextResponse.json({ url: blob.url });
}
