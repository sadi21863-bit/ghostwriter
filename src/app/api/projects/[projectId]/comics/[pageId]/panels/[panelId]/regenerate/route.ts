export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession, verifyChildOwnership } from "@/lib/auth-helpers";
import { db } from "@/db";
import { comicPages, comicPanels, projects, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getImageProvider } from "@/lib/media/registry";
import { decrypt } from "@/lib/crypto";
import { put } from "@vercel/blob";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function POST(_: Request, { params }: { params: Promise<{ projectId: string; pageId: string; panelId: string }> }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership((await params).projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const panel = await db.query.comicPanels.findFirst({
    where: and(eq(comicPanels.id, (await params).panelId), eq(comicPanels.projectId, (await params).projectId)),
  });
  if (!panel) return NextResponse.json({ error: "Panel not found" }, { status: 404 });

  const pageOwned = await verifyChildOwnership(comicPages, (await params).pageId, (await params).projectId);
  if (!pageOwned) return NextResponse.json({ error: "Page not found" }, { status: 404 });

  const imageProviderId = user.imageProviderId || "segmind_soul";
  const provider = getImageProvider(imageProviderId);
  const rawKey = imageProviderId === "openai_gpt_image" ? user.openaiApiKey : user.segmindApiKey;
  const apiKey = decrypt(rawKey ?? "");

  if (!apiKey) {
    return NextResponse.json({ error: `Add your ${provider.name} API key in Settings to generate panels.` }, { status: 400 });
  }

  const result = await provider.generate({
    prompt: panel.panelPrompt,
    stylePreset: panel.artStylePreset || undefined,
    referenceImageUrl: panel.referenceImageUrl || undefined,
  }, apiKey);

  const rawUrl = result.url!;
  let imageUrl = rawUrl;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const imgRes = await fetch(rawUrl);
    const imgBuffer = await imgRes.arrayBuffer();
    const blob = await put(
      `comics/${(await params).projectId}/${(await params).pageId}/panel-${panel.panelIndex}-regen-${Date.now()}.png`,
      imgBuffer,
      { access: "public", contentType: "image/png" }
    );
    imageUrl = blob.url;
  }

  const [updated] = await db
    .update(comicPanels)
    .set({ imageUrl })
    .where(eq(comicPanels.id, (await params).panelId))
    .returning();

  return NextResponse.json({ panel: updated });
}
