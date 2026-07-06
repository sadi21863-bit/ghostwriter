export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { db } from "@/db";
import { projects, comicPages, comicPanels } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { put } from "@vercel/blob";
import JSZip from "jszip";
import { compositePage } from "@/lib/comic-gen/compose-page";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getRequiredSession();
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "comic_studio")) {
    return NextResponse.json({ error: "upgrade_required", feature: "comic_studio" }, { status: 403 });
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, (await params).projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pages = await db.query.comicPages.findMany({
    where: eq(comicPages.projectId, (await params).projectId),
    with: { panels: { orderBy: [asc(comicPanels.panelIndex)] } },
    orderBy: [asc(comicPages.pageNumber)],
  });

  if (!pages.length) {
    return NextResponse.json({ error: "No comic pages generated yet." }, { status: 400 });
  }

  const zip = new JSZip();
  const folder = zip.folder("comic")!;
  let composedPages = 0;

  for (const page of pages) {
    const panels = [...((page as any).panels || [])].sort((a: any, b: any) => a.panelIndex - b.panelIndex);
    const panelBuffers: Buffer[] = [];
    for (const panel of panels) {
      // Prefer the lettered composite (bubbles/captions baked in) over raw art.
      const url = panel.letteredImageUrl || panel.imageUrl;
      if (!url) continue;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        panelBuffers.push(Buffer.from(await res.arrayBuffer()));
      } catch {
        // skip failed fetches — a page still exports with whichever panels succeeded
      }
    }
    if (!panelBuffers.length) continue;

    // One composed PAGE image (panels laid out 2×3, matching ComicStudio.tsx's
    // exportPng()) — not one file per panel, so the CBZ is actually readable
    // as a comic in a real reader.
    const pageBuffer = await compositePage(panelBuffers);
    folder.file(`page-${String(page.pageNumber).padStart(3, "0")}.jpg`, pageBuffer);
    composedPages++;
  }

  if (!composedPages) {
    return NextResponse.json({ error: "No panel images generated yet." }, { status: 400 });
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const safeTitle = project.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const filename = `${safeTitle}-comic.cbz`;

  const blob = await put(`exports/${(await params).projectId}/${filename}`, zipBuffer, {
    access: "public",
    contentType: "application/x-cbz",
    addRandomSuffix: true,
  });

  return NextResponse.json({ downloadUrl: blob.url, filename });
}
