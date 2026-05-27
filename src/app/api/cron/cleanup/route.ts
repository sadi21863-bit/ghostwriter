import { NextResponse } from "next/server";
import { db } from "@/db";
import { generations, videoAnalysisJobs } from "@/db/schema";
import { lt } from "drizzle-orm";

// Called by Vercel Cron — secured by CRON_SECRET header
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
