export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { db } from "@/db";
import { videoAnalysisJobs } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/engine";
import { CHANNEL_AUTOPSY_SYSTEM_PROMPT } from "@/lib/ai/prompts";

const anthropic = new Anthropic();

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "creator_tools_advanced")) {
    return NextResponse.json({ error: "upgrade_required", feature: "creator_tools_advanced" }, { status: 403 });
  }

  const { jobIds, niche, channelName } = await req.json();
  if (!jobIds?.length || jobIds.length < 2) {
    return NextResponse.json({ error: "Provide at least 2 completed video analysis job IDs" }, { status: 400 });
  }
  if (jobIds.length > 10) {
    return NextResponse.json({ error: "Maximum 10 videos per autopsy" }, { status: 400 });
  }

  const jobs = await db.query.videoAnalysisJobs.findMany({
    where: and(
      eq(videoAnalysisJobs.userId, session.user.id),
      inArray(videoAnalysisJobs.id, jobIds)
    ),
  });

  const completed = jobs.filter((j: any) => j.status === "completed" && j.result);
  if (completed.length < 2) {
    return NextResponse.json({
      error: "Need at least 2 completed video analyses. Run Video Dissection on each video first.",
    }, { status: 400 });
  }

  const videoSummaries = completed.map((j: any, i: number) => {
    let result: any = j.result;
    if (typeof result === "string") {
      try { result = JSON.parse(result); } catch { result = {}; }
    }
    return `VIDEO ${i + 1} (${j.youtubeUrl}):\n${JSON.stringify(result, null, 2).slice(0, 1500)}`;
  }).join("\n\n---\n\n");

  const response = await anthropic.messages.create({
    model: MODELS.default,
    max_tokens: 3000,
    system: [{
      type: "text",
      text: CHANNEL_AUTOPSY_SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    }],
    messages: [{
      role: "user",
      content: `Analyse these ${completed.length} video analyses for ${channelName || "this channel"}${niche ? ` in the ${niche} niche` : ""}.

Find:
1. Structural DNA: what patterns repeat across all/most videos (hook types, pacing, length, format)
2. Content gaps: topics the audience clearly wants that this channel hasn't covered
3. What's working: consistent strengths across videos
4. What's not working: consistent weaknesses
5. The one format/structure they keep using that's producing the best results

VIDEO ANALYSES:
${videoSummaries}

Return JSON:
{
  "channelDNA": {
    "dominantHookTypes": ["string"],
    "typicalStructure": "string",
    "averageLength": "string",
    "contentPatterns": ["string"],
    "voiceSignature": "string"
  },
  "contentGaps": [
    { "gap": "string", "evidence": "why the audience wants this", "suggestedAngle": "string" }
  ],
  "strengths": ["string"],
  "weaknesses": ["string"],
  "bestPerformingPattern": "string",
  "nextVideoRecommendation": { "title": "string", "hook": "string", "rationale": "string" }
}`,
    }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
  try {
    return NextResponse.json(JSON.parse(raw.replace(/```json\n?|```/g, "").trim()));
  } catch {
    return NextResponse.json({ error: "Parse failed" }, { status: 500 });
  }
}
