export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { db } from "@/db";
import { showcases, projects } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

const PAGE_SIZE = 20;

// PUBLIC discovery feed — no auth. visibility="public" AND not flagged, most
// recent first. No ranking algorithm for v1 (see the showcase plan's
// explicitly-out-of-scope list) — simple offset pagination via ?cursor=.
// Deliberately omits cover images here: computing buildShowcasePreview's
// full cover-selection logic needs each project's chapters/comicPages/
// panels/productionShots, which would be a real N+1-shaped query across up
// to 20 projects per page. The individual showcase page (GET /api/showcase/
// [slug]) computes the full preview for just the one project being viewed.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cursor = Number(searchParams.get("cursor") ?? "0") || 0;

  const rows = await db.query.showcases.findMany({
    where: and(eq(showcases.visibility, "public"), eq(showcases.flagged, false)),
    orderBy: [desc(showcases.createdAt)],
    limit: PAGE_SIZE + 1,
    offset: cursor,
    with: { project: { columns: { name: true, format: true } } },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE);

  return NextResponse.json({
    showcases: page.map((sc: any) => ({
      slug: sc.slug,
      title: sc.title || sc.project?.name || "Untitled",
      blurb: sc.blurb,
      format: sc.project?.format ?? "",
    })),
    nextCursor: hasMore ? cursor + PAGE_SIZE : null,
  });
}
