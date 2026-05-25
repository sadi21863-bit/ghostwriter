import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { comicPages, comicPanels, projects, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateSoulImage } from "@/lib/higgsfield/client";
import { put } from "@vercel/blob";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function POST(_: Request, { params }: { params: { projectId: string; pageId: string; panelId: string } }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership(params.projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
  if (!user?.higgsfieldApiKey)
    return NextResponse.json({ error: "Add your Higgsfield API key in Settings to regenerate panels." }, { status: 400 });

  const panel = await db.query.comicPanels.findFirst({ where: eq(comicPanels.id, params.panelId) });
  if (!panel) return NextResponse.json({ error: "Panel not found" }, { status: 404 });

  const page = await db.query.comicPages.findFirst({ where: eq(comicPages.id, params.pageId) });
  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

  const soulUrl = await generateSoulImage({
    apiKey: user.higgsfieldApiKey,
    prompt: panel.panelPrompt,
    stylePreset: panel.artStylePreset || undefined,
    referenceImageUrl: panel.referenceImageUrl || undefined,
  });

  let imageUrl = soulUrl;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const imgRes = await fetch(soulUrl);
    const imgBuffer = await imgRes.arrayBuffer();
    const blob = await put(
      `comics/${params.projectId}/${params.pageId}/panel-${panel.panelIndex}-regen-${Date.now()}.png`,
      imgBuffer,
      { access: "public", contentType: "image/png" }
    );
    imageUrl = blob.url;
  }

  const [updated] = await db
    .update(comicPanels)
    .set({ imageUrl })
    .where(eq(comicPanels.id, params.panelId))
    .returning();

  return NextResponse.json({ panel: updated });
}
