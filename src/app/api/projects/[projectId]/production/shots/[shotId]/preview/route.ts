export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, productionShots, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateSoulImage } from "@/lib/higgsfield/client";
import { put } from "@vercel/blob";
import { decrypt } from "@/lib/crypto";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function POST(_: Request, { params }: { params: Promise<{ projectId: string; shotId: string }> }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership((await params).projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
  const higgsfieldKey = decrypt(user?.higgsfieldApiKey ?? "");
  if (!higgsfieldKey)
    return NextResponse.json({ error: "Add your Higgsfield API key in Settings to generate previews." }, { status: 400 });

  const shot = await db.query.productionShots.findFirst({
    where: and(eq(productionShots.id, (await params).shotId), eq(productionShots.projectId, (await params).projectId)),
    with: { primaryCharacter: true },
  });
  if (!shot) return NextResponse.json({ error: "Shot not found" }, { status: 404 });

  await db.update(productionShots)
    .set({ generationStatus: "generating_preview", updatedAt: new Date() })
    .where(eq(productionShots.id, (await params).shotId));

  try {
    const referenceImageUrl = (shot.primaryCharacter as any)?.portraitUrl || undefined;
    const soulUrl = await generateSoulImage({
      apiKey: higgsfieldKey,
      prompt: shot.soulPrompt || `${shot.subject}. ${shot.action}. ${shot.location}. Cinematic, photorealistic.`,
      referenceImageUrl: referenceImageUrl || undefined,
    });

    let previewImageUrl = soulUrl;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const imgRes = await fetch(soulUrl);
      const imgBuf = await imgRes.arrayBuffer();
      const blob = await put(
        `production/${(await params).projectId}/${(await params).shotId}/preview.jpg`,
        imgBuf,
        { access: "public", contentType: "image/jpeg" }
      );
      previewImageUrl = blob.url;
    }

    const [updated] = await db
      .update(productionShots)
      .set({ previewImageUrl, generationStatus: "preview_ready", updatedAt: new Date() })
      .where(eq(productionShots.id, (await params).shotId))
      .returning();

    return NextResponse.json({ shot: updated });
  } catch (err: any) {
    await db.update(productionShots)
      .set({ generationStatus: "error", updatedAt: new Date() })
      .where(eq(productionShots.id, (await params).shotId));
    console.error('[preview] Error:', err);
    return NextResponse.json({ error: "Preview generation failed. Please try again." }, { status: 500 });
  }
}
