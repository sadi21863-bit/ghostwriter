import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/engine";
import { decrypt } from "@/lib/crypto";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
  const s = await getRequiredSession();
  const rl = await checkAiRateLimit(s.user.id);
  if (rl) return rl;
  const tier = await getUserTier(s.user.id);
  if (!canAccessFeature(tier, "creator_tools_advanced")) {
    return NextResponse.json({ error: "upgrade_required", feature: "creator_tools_advanced", tier }, { status: 403 });
  }
  const { keyword, format, creatorBible } = await req.json();

  if (!keyword?.trim()) {
    return NextResponse.json({ error: "keyword required" }, { status: 400 });
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
  const trendKey = decrypt(user?.trendIntelligenceKey ?? "");

  if (!trendKey) {
    return NextResponse.json({ error: "TREND_INTELLIGENCE_NOT_CONNECTED" }, { status: 403 });
  }

  try {
    const apifyRes = await fetch(
      "https://api.apify.com/v2/acts/patient_discovery~instagram-search-reels/run-sync-get-dataset-items",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${trendKey}`,
        },
        body: JSON.stringify({
          keyword: keyword,
          maxResults: 20,
          sortBy: "recent",
        }),
      }
    );

    if (!apifyRes.ok) {
      if (apifyRes.status === 401 || apifyRes.status === 403) {
        return NextResponse.json({ error: "TREND_INTELLIGENCE_KEY_INVALID" }, { status: 403 });
      }
      if (apifyRes.status === 429) {
        return NextResponse.json({ error: "TREND_INTELLIGENCE_QUOTA_EXCEEDED" }, { status: 429 });
      }
      return NextResponse.json({ error: "Trend data unavailable. Try again shortly." }, { status: 502 });
    }

    const reels = await apifyRes.json();

    if (!reels?.length) {
      return NextResponse.json({
        error: "No results found for this keyword. Try a broader search term."
      }, { status: 404 });
    }

    const reelSummary = reels.slice(0, 15).map((r: any) => ({
      caption: (r.caption || r.text || "").substring(0, 200),
      hashtags: (r.hashtags || []).slice(0, 8),
      plays: r.videoPlayCount || r.playCount || r.viewCount || 0,
      likes: r.likesCount || r.likes || 0,
      audio: r.musicInfo?.songName || r.audioName || null,
    }));

    const channelContext = creatorBible
      ? `\nChannel: ${creatorBible.channelName || ""}\nNiche: ${creatorBible.niche || ""}\nVoice: ${creatorBible.channelVoice || ""}\nAudience: ${creatorBible.audienceInterests || ""}`
      : "";

    const msg = await client.messages.create({
      model: MODELS.default,
      max_tokens: 1200,
      system: `You are a content strategist specialising in Instagram Reels for Indian creators. Analyse real reel data and identify what's saturated vs what angles nobody has taken yet. Return ONLY valid JSON.`,
      messages: [{
        role: "user",
        content: `Keyword: "${keyword}"
Format: ${format || "Instagram Reel"}
${channelContext}

Recent reels on this topic (last 20):
${reelSummary.map((r: any, i: number) => `${i + 1}. Caption: "${r.caption}" | Plays: ${r.plays.toLocaleString()} | Hashtags: ${r.hashtags.join(", ")} | Audio: ${r.audio || "none"}`).join("\n")}

Analyse this data and return JSON:
{
  "saturatedAngles": ["angle that every creator is doing"],
  "freshAngles": [
    {
      "angle": "specific unused angle",
      "hook": "exact opening line for a Reel using this angle",
      "why": "why this is unsaturated based on the data",
      "trendingAudio": "audio track name that fits this angle (if visible in data, else null)"
    }
  ],
  "topAudio": ["most used audio tracks in the data"],
  "fitScore": 8,
  "fitReason": "why this topic fits or doesn't fit this specific channel"
}`,
      }],
    });

    const raw = msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    try {
      const analysis = JSON.parse(raw.replace(/```json\n?|```/g, "").trim());
      return NextResponse.json({ analysis, reelCount: reels.length });
    } catch {
      return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 500 });
    }

  } catch {
    return NextResponse.json({ error: "Trend analysis failed. Please try again." }, { status: 500 });
  }
}
