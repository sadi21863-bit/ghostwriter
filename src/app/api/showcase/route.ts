export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { db } from "@/db";
import { showcases, projects } from "@/db/schema";
import { eq, and, desc, isNotNull } from "drizzle-orm";
import { generateEmbedding, cosineSimilarity } from "@/lib/ai/embeddings";

const PAGE_SIZE = 20;

function toFeedItem(sc: any) {
  return {
    slug: sc.slug,
    title: sc.title || sc.project?.name || "Untitled",
    blurb: sc.blurb,
    format: sc.project?.format ?? "",
  };
}

// PUBLIC discovery feed — no auth. visibility="public" AND not flagged.
// Two modes: default is most-recent-first with offset pagination (?cursor=);
// ?q= switches to semantic search (embed the query, cosine-similarity rank
// against each showcase's title+blurb embedding) — a real gap the feed had
// at launch (createdAt-only sort, no way to find something like what you
// write). No pagination in search mode — top 20 matches, no ranking
// algorithm beyond raw similarity (see the showcase plan's explicitly-out-
// of-scope list for why this stays simple). Deliberately omits cover images
// in BOTH modes: computing buildShowcasePreview's full cover-selection logic
// needs each project's chapters/comicPages/panels/productionShots, which
// would be a real N+1-shaped query across up to 20 projects per page. The
// individual showcase page (GET /api/showcase/[slug]) computes the full
// preview for just the one project being viewed.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (q) {
    const queryEmbedding = await generateEmbedding(q).catch(() => null);
    if (!queryEmbedding) return NextResponse.json({ showcases: [], nextCursor: null });

    const rows = await db.query.showcases.findMany({
      where: and(eq(showcases.visibility, "public"), eq(showcases.flagged, false), isNotNull(showcases.embedding)),
      with: { project: { columns: { name: true, format: true } } },
    });

    const ranked = rows
      .map((sc: any) => ({ sc, similarity: cosineSimilarity(queryEmbedding, sc.embedding) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, PAGE_SIZE);

    return NextResponse.json({ showcases: ranked.map(r => toFeedItem(r.sc)), nextCursor: null });
  }

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
    showcases: page.map(toFeedItem),
    nextCursor: hasMore ? cursor + PAGE_SIZE : null,
  });
}
