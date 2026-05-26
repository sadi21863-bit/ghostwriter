import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { videoAnalysisJobs } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _: Request,
  { params }: { params: { jobId: string } }
) {
  const s = await getRequiredSession();

  const job = await db.query.videoAnalysisJobs.findFirst({
    where: and(
      eq(videoAnalysisJobs.id, params.jobId),
      eq(videoAnalysisJobs.userId, s.user.id)
    ),
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.status === "complete" && job.result) {
    return NextResponse.json({ status: "complete", analysis: job.result });
  }

  if (job.status === "error") {
    return NextResponse.json({
      status: "error",
      error: job.errorMessage || "Video analysis failed. Please try again.",
    });
  }

  return NextResponse.json({ status: job.status });
}
