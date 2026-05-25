import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, productionShots, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateSoulImage } from "@/lib/higgsfield/client";
import { put } from "@vercel/blob";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function POST(_: Request, { params }: { params: { projectId: string; shotId: string } }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership(params.projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
  if (!user?.higgsfieldApiKey)
    return NextResponse.json({ error: "Add your Higgsfield API key in Settings to generate previews." }, { status: 400 });

  const shot = await db.query.productionShots.findFirst({
    where: eq(productionShots.id, params.shotId),
    with: { primaryCharacter: true },
  });
  if (!shot) return NextResponse.json({ error: "Shot not found" }, { status: 404 });

  await db.update(productionShots)
    .set({ generationStatus: "generating_preview", updatedAt: new Date() })
    .where(eq(productionShots.id, params.shotId));

  try {
    const referenceImageUrl = (shot.primaryCharacter as any)?.portraitUrl || undefined;
    const soulUrl = await generateSoulImage({
      apiKey: user.higgsfieldApiKey,
      prompt: shot.soulPrompt || `${shot.subject}. ${shot.action}. ${shot.location}. Cinematic, photorealistic.`,
      referenceImageUrl: referenceImageUrl || undefined,
    });

    let previewImageUrl = soulUrl;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const imgRes = await fetch(soulUrl);
      const imgBuf = await imgRes.arrayBuffer();
      const blob = await put(
        `production/${params.projectId}/${params.shotId}/preview.jpg`,
        imgBuf,
        { access: "public", contentType: "image/jpeg" }
      );
      previewImageUrl = blob.url;
    }

    const [updated] = await db
      .update(productionShots)
      .set({ previewImageUrl, generationStatus: "preview_ready", updatedAt: new Date() })
      .where(eq(productionShots.id, params.shotId))
      .returning();

    return NextResponse.json({ shot: updated });
  } catch (err: any) {
    await db.update(productionShots)
      .set({ generationStatus: "error", updatedAt: new Date() })
      .where(eq(productionShots.id, params.shotId));
    return NextResponse.json({ error: err.message ?? "Preview generation failed" }, { status: 500 });
  }
}
