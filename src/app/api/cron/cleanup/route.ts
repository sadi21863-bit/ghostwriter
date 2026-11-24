export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { db } from "@/db";
import { generations, videoAnalysisJobs } from "@/db/schema";
import { lt } from "drizzle-orm";
import { requireBearer } from "@/lib/auth-secret";

// Called by Vercel Cron — secured by CRON_SECRET header, compared in constant time.
export async function GET(req: Request) {
  const denied = requireBearer(req.headers.get("authorization"), "CRON_SECRET");
  if (denied) return denied;

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  await Promise.all([
    db.delete(generations).where(lt(generations.createdAt, ninetyDaysAgo)),
    db.delete(videoAnalysisJobs).where(lt(videoAnalysisJobs.createdAt, ninetyDaysAgo)),
  ]);

  return NextResponse.json({
    success: true,
    cleaned: { generations: true, videoAnalysisJobs: true },
    cutoff: ninetyDaysAgo.toISOString(),
  });
}
