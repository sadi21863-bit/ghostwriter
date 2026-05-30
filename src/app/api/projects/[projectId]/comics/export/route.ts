import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { db } from "@/db";
import { projects, comicPages, comicPanels } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { put } from "@vercel/blob";
import JSZip from "jszip";

export async function GET(
  _req: Request,
  { params }: { params: { projectId: string } }
) {
  const session = await getRequiredSession();
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "comic_studio")) {
    return NextResponse.json({ error: "upgrade_required", feature: "comic_studio" }, { status: 403 });
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pages = await db.query.comicPages.findMany({
    where: eq(comicPages.projectId, params.projectId),
    with: { panels: { orderBy: [asc(comicPanels.panelIndex)] } },
    orderBy: [asc(comicPages.pageNumber)],
  });

  if (!pages.length) {
    return NextResponse.json({ error: "No comic pages generated yet." }, { status: 400 });
  }

  const allPanels: { page: number; panel: number; url: string }[] = [];
  for (const page of pages) {
    for (const panel of (page as any).panels || []) {
      if (panel.imageUrl) {
        allPanels.push({ page: page.pageNumber, panel: panel.panelIndex, url: panel.imageUrl });
      }
    }
  }

  if (!allPanels.length) {
    return NextResponse.json({ error: "No panel images generated yet." }, { status: 400 });
  }

  const zip = new JSZip();
  const folder = zip.folder("comic")!;

  for (const p of allPanels) {
    try {
      const res = await fetch(p.url);
      if (!res.ok) continue;
      const buffer = await res.arrayBuffer();
      const filename = `page-${String(p.page).padStart(3, "0")}-panel-${String(p.panel).padStart(2, "0")}.jpg`;
      folder.file(filename, buffer);
    } catch {
      // skip failed fetches
    }
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const safeTitle = project.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const filename = `${safeTitle}-comic.cbz`;

  const blob = await put(`exports/${params.projectId}/${filename}`, zipBuffer, {
    access: "public",
    contentType: "application/x-cbz",
    addRandomSuffix: true,
  });

  return NextResponse.json({ downloadUrl: blob.url, filename });
}
