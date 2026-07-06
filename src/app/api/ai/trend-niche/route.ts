export const dynamic = 'force-dynamic';

// src/app/api/ai/trend-niche/route.ts
// Niche-specific trend intelligence.
// Filters trending content through the Creator Bible niche, audience, and
// content pillars. Also analyses creator's past video performance patterns.

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { db } from "@/db";
import { projects, creatorBibles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { anthropic } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/engine";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";


interface PastVideo {
  title: string;
  views?: number;
  likes?: number;
}

interface NicheTrend {
  topic: string;
  angle: string;
  audienceResonance: "high" | "medium" | "low";
  exampleHook: string;
  whyItFits: string;
}

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const gate = await meterAndGate(session.user.id, "trend-niche");
  if (gate) return gate;

  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "creator_tools_advanced")) {
    return NextResponse.json(
      { error: "upgrade_required", feature: "creator_tools_advanced" },
      { status: 403 }
    );
  }

  const { projectId, pastVideoData } = await req.json() as {
    projectId: string;
    pastVideoData?: PastVideo[];
  };

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bible = await db.query.creatorBibles.findFirst({
    where: eq(creatorBibles.projectId, projectId),
  });

  if (!bible?.niche) {
    return NextResponse.json({
      error: "No niche set in your Creator Bible. Add your niche first.",
    }, { status: 400 });
  }

  const nicheContext = [
    `Niche: ${bible.niche}`,
    bible.audienceAge        ? `Audience age: ${bible.audienceAge}`               : null,
    bible.audienceInterests  ? `Audience interests: ${bible.audienceInterests}`   : null,
    bible.audiencePainPoints ? `Audience pain points: ${bible.audiencePainPoints}`: null,
    bible.channelVoice       ? `Channel voice: ${bible.channelVoice}`             : null,
    bible.contentPillars && Array.isArray(bible.contentPillars) && bible.contentPillars.length > 0
      ? `Content pillars: ${bible.contentPillars.join(", ")}`
      : null,
  ].filter(Boolean).join("\n");

  const trendPrompt = `You are a niche content strategist. Find specific trends for this creator's exact niche — not generic YouTube trends.

${nicheContext}

Identify 6 specific trending topics or angles that would resonate with this creator's exact audience right now (${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}).

Each trend must be:
- Specific to this niche (not applicable to a different niche)
- Currently gaining traction (not evergreen basics)
- Aligned with the audience's interests and pain points

Return ONLY valid JSON:
{
  "trends": [
    {
      "topic": "Specific trend topic",
      "angle": "How this creator should approach it given their niche and voice",
      "audienceResonance": "high" | "medium" | "low",
      "exampleHook": "One specific hook under 125 characters",
      "whyItFits": "One sentence: why this matches this creator's niche and audience specifically"
    }
  ],
  "nicheInsight": "One paragraph: what makes this specific niche's audience different from a general YouTube audience, and what they consistently respond to"
}`;

  try {
    const trendResponse = await anthropic.messages.create({
      model: MODELS.default,
      max_tokens: 2000,
      messages: [{ role: "user", content: trendPrompt }],
    });

    const trendText = trendResponse.content.filter(b => b.type === "text").map(b => (b as any).text).join("") || "{}";
    const trendClean = trendText.replace(/```json\n?|```/g, "").trim();

    let trendResult: { trends: NicheTrend[]; nicheInsight: string };
    try {
      trendResult = JSON.parse(trendClean);
    } catch {
      await refundCredits(session.user.id, "trend-niche");
      return NextResponse.json({ error: "Failed to parse trend analysis" }, { status: 500 });
    }

    let performancePatterns: string[] = [];

    if (pastVideoData && pastVideoData.length >= 5) {
      const perfPrompt = `Analyse the performance patterns in these past videos for a ${bible.niche} creator.

Past videos (title, views):
${pastVideoData.map((v: PastVideo) => `- "${v.title}" — ${v.views ?? "?"} views`).join("\n")}

Identify 3-5 specific patterns:
- Which topics, formats, or angles consistently outperform
- Which consistently underperform
- What the audience responds to that may not be obvious

Return ONLY valid JSON:
{
  "patterns": [
    "Pattern description with specific evidence from the video data"
  ]
}`;

      const perfResponse = await anthropic.messages.create({
        model: MODELS.default,
        max_tokens: 2000,
        messages: [{ role: "user", content: perfPrompt }],
      });

      const perfText = perfResponse.content.filter(b => b.type === "text").map(b => (b as any).text).join("") || "{}";
      const perfClean = perfText.replace(/```json\n?|```/g, "").trim();

      try {
        const perfResult = JSON.parse(perfClean);
        performancePatterns = perfResult.patterns ?? [];
      } catch {
        // Non-fatal — trends still returned
      }
    }

    return NextResponse.json({
      trends: trendResult.trends,
      nicheInsight: trendResult.nicheInsight,
      performancePatterns,
      niche: bible.niche,
    });
  } catch (error) {
    await refundCredits(session.user.id, "trend-niche");
    return NextResponse.json({ error: "Trend analysis failed. Please try again." }, { status: 500 });
  }
}
