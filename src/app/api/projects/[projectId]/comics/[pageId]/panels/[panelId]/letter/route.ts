export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession, verifyChildOwnership } from "@/lib/auth-helpers";
import { db } from "@/db";
import { comicPages, comicPanels, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { put } from "@vercel/blob";
import { compositeLettering, type BubbleType } from "@/lib/comic-lettering/composite-panel";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

// Zero-spend: composites speech/caption lettering onto the panel's ALREADY-
// generated art (no AI/Segmind call). Writes a separate letteredImageUrl so the
// raw imageUrl is never overwritten — re-lettering after a text edit never
// re-runs (or re-pays for) image generation.
export async function POST(_: Request, { params }: { params: Promise<{ projectId: string; pageId: string; panelId: string }> }) {
  const s = await getRequiredSession();
  const { projectId, pageId, panelId } = await params;
  if (!await verifyOwnership(projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const panel = await db.query.comicPanels.findFirst({
    where: and(eq(comicPanels.id, panelId), eq(comicPanels.projectId, projectId)),
  });
  if (!panel) return NextResponse.json({ error: "Panel not found" }, { status: 404 });

  const pageOwned = await verifyChildOwnership(comicPages, pageId, projectId);
  if (!pageOwned) return NextResponse.json({ error: "Page not found" }, { status: 404 });

  if (!panel.dialogue?.trim() && !panel.caption?.trim())
    return NextResponse.json({ error: "Add dialogue or a caption before lettering this panel." }, { status: 400 });

  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return NextResponse.json({ error: "Blob storage is not configured." }, { status: 500 });

  const imgRes = await fetch(panel.imageUrl);
  if (!imgRes.ok)
    return NextResponse.json({ error: "Could not fetch the panel's source image." }, { status: 502 });
  const imageBuffer = Buffer.from(await imgRes.arrayBuffer());

  const lettered = await compositeLettering({
    imageBuffer,
    dialogue: panel.dialogue ?? "",
    caption: panel.caption ?? "",
    speakerName: panel.speakerName ?? "",
    bubbleType: (panel.bubbleType as BubbleType) ?? "speech",
  });

  const blob = await put(
    `comics/${projectId}/${pageId}/panel-${panel.panelIndex}-lettered-${Date.now()}.png`,
    lettered,
    { access: "public", contentType: "image/png" }
  );

  const [updated] = await db
    .update(comicPanels)
    .set({ letteredImageUrl: blob.url })
    .where(eq(comicPanels.id, panelId))
    .returning();

  return NextResponse.json({ panel: updated });
}
