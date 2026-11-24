export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { db } from "@/db";
import { requireBearer } from "@/lib/auth-secret";

export async function GET(req: Request) {
  const denied = requireBearer(req.headers.get("authorization"), "ADMIN_SECRET");
  if (denied) return denied;

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
