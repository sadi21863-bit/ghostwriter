export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { db } from "@/db";
import { showcases } from "@/db/schema";
import { eq } from "drizzle-orm";
import { buildShowcasePreview } from "@/lib/showcase/preview";

// PUBLIC — no auth, keyed purely by slug (mirrors /api/reader/[token]'s
// exact pattern). Never returns raw project internals — only the safe DTO
// fields a showcase visitor should see.
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const showcase = await db.query.showcases.findFirst({
    where: eq(showcases.slug, slug),
    with: {
      project: {
        with: { chapters: true, characters: true, comicPages: { with: { panels: true } }, productionShots: true },
      },
    },
  });

  if (!showcase || showcase.visibility === "private") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const project = (showcase as any).project;
  const comicPanels = (project?.comicPages ?? []).flatMap((p: any) => p.panels ?? []);
  const preview = buildShowcasePreview({
    chapters: project?.chapters,
    characters: project?.characters,
    comicPanels,
    productionShots: project?.productionShots,
  });

  return NextResponse.json({
    title: showcase.title,
    blurb: showcase.blurb,
    format: project?.format ?? "",
    genres: project?.genres ?? [],
    ...preview,
  });
}
