export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { db } from "@/db";
import { creatorBibles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { anthropic as client } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/engine";
import { TREND_YOUTUBE_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";


export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const gate = await meterAndGate(session.user.id, "trend-youtube");
  if (gate) return gate;
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "creator_tools_advanced")) {
    return NextResponse.json({ error: "upgrade_required", feature: "creator_tools_advanced", tier }, { status: 403 });
  }
  const { keyword, format, creatorBible, projectId } = await req.json();

  // Server-side niche lookup — augments client-supplied creatorBible if projectId provided
  let serverNiche = "";
  if (projectId) {
    const bible = await db.query.creatorBibles.findFirst({
      where: eq(creatorBibles.projectId, projectId),
    });
    if (bible?.niche) serverNiche = bible.niche;
  }

  if (!keyword?.trim()) {
    return NextResponse.json({ error: "keyword required" }, { status: 400 });
  }

  const ytKey = process.env.YOUTUBE_DATA_API_KEY;
  if (!ytKey) {
    return NextResponse.json({ error: "YouTube search unavailable" }, { status: 503 });
  }

  try {
    const isShort = format === "YouTube Short";
    const ytRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&videoDuration=${isShort ? "short" : "medium"}&order=viewCount&maxResults=10&key=${ytKey}`
    );

    if (!ytRes.ok) {
      return NextResponse.json({ error: "YouTube search failed. Try again." }, { status: 502 });
    }

    const ytData = await ytRes.json();
    const videos = ytData.items || [];

    if (!videos.length) {
      return NextResponse.json({ error: "No videos found for this topic." }, { status: 404 });
    }

    const videoIds = videos.map((v: any) => v.id.videoId).join(",");
    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${videoIds}&key=${ytKey}`
    );
    const statsData = await statsRes.json();
    const statsMap: Record<string, any> = {};
    (statsData.items || []).forEach((v: any) => { statsMap[v.id] = v.statistics; });

    const videoSummary = videos.map((v: any) => {
      const stats = statsMap[v.id.videoId] || {};
      return {
        title: v.snippet.title,
        description: (v.snippet.description || "").substring(0, 150),
        views: parseInt(stats.viewCount || "0"),
        likes: parseInt(stats.likeCount || "0"),
        url: `https://youtube.com/watch?v=${v.id.videoId}`,
      };
    });

    const niche = serverNiche || creatorBible?.niche || "";
    const channelContext = (creatorBible || serverNiche)
      ? `\nChannel: ${creatorBible?.channelName || ""} | Niche: ${niche} | Voice: ${creatorBible?.channelVoice || ""} | Audience: ${creatorBible?.audienceInterests || ""}${niche ? `\nFocus specifically on trends in this niche: ${niche}` : ""}`
      : "";

    const msg = await client.messages.create({
      model: MODELS.default,
      max_tokens: 1200,
      system: TREND_YOUTUBE_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Topic: "${keyword}"
Format: ${format || "YouTube"}
${channelContext}

Top performing videos on this topic:
${videoSummary.map((v: any, i: number) => `${i + 1}. "${v.title}" — ${v.views.toLocaleString()} views\n   ${v.description}`).join("\n\n")}

Return JSON:
{
  "saturatedAngles": ["angle every creator is taking"],
  "freshAngles": [
    {
      "angle": "specific unused angle",
      "hook": "exact opening line for a video using this angle",
      "why": "why this is unsaturated based on the titles/descriptions",
      "estimatedDemand": "high | medium | low"
    }
  ],
  "topVideos": [
    { "title": "string", "views": 0, "url": "string", "whatWorked": "string" }
  ],
  "fitScore": 8,
  "fitReason": "why this topic fits or doesn't fit this specific channel"
}`,
      }],
    });

    const raw = msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    try {
      const analysis = JSON.parse(raw.replace(/```json\n?|```/g, "").trim());
      return NextResponse.json({ analysis, videoCount: videos.length });
    } catch {
      return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 500 });
    }

  } catch (e: any) {
    await refundCredits(session.user.id, "trend-youtube");
    const msg = e?.message || "";
    if (msg.includes("401") || msg.includes("authentication") || msg.includes("api_key")) {
      return NextResponse.json({ error: "AI service authentication failed. Contact support." }, { status: 500 });
    }
    if (msg.includes("quota") || msg.includes("429")) {
      return NextResponse.json({ error: "YouTube API quota exceeded. Try again tomorrow." }, { status: 429 });
    }
    return NextResponse.json({ error: "YouTube trend analysis failed. Please try again." }, { status: 500 });
  }
}
