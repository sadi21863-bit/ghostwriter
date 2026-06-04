export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { db } from "@/db";

export async function GET(req: Request) {
  if (!process.env.ADMIN_SECRET) return new Response("Misconfigured", { status: 500 });
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await db.query.semanticCache.findMany({
    columns: { cacheType: true, inputKey: true, hitCount: true, createdAt: true, lastHitAt: true },
    orderBy: (c, { desc }) => [desc(c.hitCount)],
    limit: 50,
  });

  const totalHits = entries.reduce((sum, e) => sum + (e.hitCount ?? 0), 0);
  const byType = entries.reduce((acc, e) => {
    acc[e.cacheType] = (acc[e.cacheType] ?? 0) + (e.hitCount ?? 0);
    return acc;
  }, {} as Record<string, number>);

  return NextResponse.json({ totalHits, byType, topEntries: entries.slice(0, 10) });
}
