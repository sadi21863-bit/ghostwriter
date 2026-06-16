export const dynamic = 'force-dynamic';

// src/app/api/ai/virality-predict/route.ts
// Predicts engagement/virality of a video prompt using Claude analysis.
// Gate: creator_pro or all_access only.

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/engine";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";

const anthropic = new Anthropic();

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const gate = await meterAndGate(session.user.id, "virality-predict");
  if (gate) return gate;

  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "virality_predict")) {
    return NextResponse.json({ error: "upgrade_required", feature: "virality_predict" }, { status: 403 });
  }

  const { videoPrompt, hookText, contentSummary, format, niche } = await req.json();

  if (!videoPrompt && !contentSummary) {
    return NextResponse.json({ error: "Provide a video prompt or content summary." }, { status: 400 });
  }

  const analysisPrompt = `You are a viral content strategist with deep expertise in YouTube, TikTok, and short-form video.

Analyse this video content for engagement and virality potential:

${videoPrompt ? `VIDEO PROMPT:\n${videoPrompt}\n` : ""}
${hookText ? `HOOK/OPENING:\n${hookText}\n` : ""}
${contentSummary ? `CONTENT SUMMARY:\n${contentSummary}\n` : ""}
${format ? `FORMAT: ${format}` : ""}
${niche ? `NICHE: ${niche}` : ""}

Score and analyse this content for virality. Consider:
- Hook strength (first 3 seconds)
- Emotional trigger quality
- Shareability factors
- Retention indicators
- Platform-specific optimization

Return ONLY valid JSON:
{
  "overallScore": 7,
  "hookStrength": 8,
  "retentionRisk": "low",
  "estimatedWatchPercent": 72,
  "strengths": [
    "Strong visual hook in opening",
    "Clear emotional arc"
  ],
  "improvements": [
    "Add a pattern interrupt at 30 seconds",
    "Strengthen the call-to-action"
  ],
  "recommendedModel": "kling"
}

Rules:
- overallScore: 1-10 integer
- hookStrength: 1-10 integer
- retentionRisk: "low" | "medium" | "high"
- estimatedWatchPercent: 0-100 integer
- strengths: 2-4 specific, actionable observations
- improvements: 2-4 specific, actionable suggestions
- recommendedModel: best Higgsfield model for this content type`;

  try {
    const response = await anthropic.messages.create({
      model: MODELS.default,
      max_tokens: 800,
      messages: [{ role: "user", content: analysisPrompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const clean = text.replace(/```json\n?|```/g, "").trim();

    try {
      const result = JSON.parse(clean);
      return NextResponse.json(result);
    } catch {
      await refundCredits(session.user.id, "virality-predict");
      return NextResponse.json({ error: "Failed to parse virality analysis." }, { status: 500 });
    }
  } catch (e: any) {
    await refundCredits(session.user.id, "virality-predict");
    return NextResponse.json({ error: e.message || "Virality prediction failed." }, { status: 500 });
  }
}
