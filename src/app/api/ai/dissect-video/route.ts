import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { checkGeminiKey } from "@/lib/env-check";
import { db } from "@/db";
import { videoAnalysisJobs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const s = await getRequiredSession();
  const rl = await checkAiRateLimit(s.user.id);
  if (rl) return rl;
  const tier = await getUserTier(s.user.id);
  if (!canAccessFeature(tier, "creator_tools_advanced")) {
    return NextResponse.json({ error: "upgrade_required", feature: "creator_tools_advanced", tier }, { status: 403 });
  }

  const geminiError = checkGeminiKey();
  if (geminiError) {
    return NextResponse.json({ error: geminiError }, { status: 503 });
  }

  const { youtubeUrl, creatorBible } = await req.json();

  if (!youtubeUrl?.trim()) {
    return NextResponse.json({ error: "YouTube URL required" }, { status: 400 });
  }

  const isYouTube = /youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\//.test(youtubeUrl);
  if (!isYouTube) {
    return NextResponse.json({ error: "Please provide a valid YouTube URL" }, { status: 400 });
  }

  const githubPat = process.env.GITHUB_PAT;
  const repoOwner = process.env.GITHUB_REPO_OWNER;
  const repoName = process.env.GITHUB_REPO_NAME;

  if (!githubPat || !repoOwner || !repoName) {
    return NextResponse.json({ error: "Video dissection is not configured. Contact support." }, { status: 503 });
  }

  const channelContext = creatorBible
    ? `Channel: ${creatorBible.channelName || ""} | Niche: ${creatorBible.niche || ""} | Voice: ${creatorBible.channelVoice || ""}`
    : "";

  const [job] = await db
    .insert(videoAnalysisJobs)
    .values({ userId: s.user.id, youtubeUrl, status: "pending" })
    .returning();

  try {
    const dispatchRes = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/dispatches`,
      {
        method: "POST",
        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": `Bearer ${githubPat}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_type: "dissect-video",
          client_payload: { jobId: job.id, youtubeUrl, channelContext },
        }),
      }
    );

    if (!dispatchRes.ok) {
      await db
        .update(videoAnalysisJobs)
        .set({ status: "error", errorMessage: "Failed to start analysis workflow", updatedAt: new Date() })
        .where(eq(videoAnalysisJobs.id, job.id));
      return NextResponse.json({ error: "Failed to start video analysis. Please try again." }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: "Failed to start video analysis. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ jobId: job.id, status: "pending" });
}
