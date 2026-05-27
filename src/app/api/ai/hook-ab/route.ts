// src/app/api/ai/hook-ab/route.ts
// Generates 5 hook variants then scores all 5 with CTR prediction.
// Creator Pro feature. Single route handles generate + score in one call.

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "creator_tools_advanced")) {
    return NextResponse.json({ error: "upgrade_required", feature: "creator_tools_advanced" }, { status: 403 });
  }

  const { contentSummary, format, niche, channelVoice } = await req.json();

  const prompt = `You are a YouTube content strategist specialising in hook optimisation.

Content: ${contentSummary}
Format: ${format ?? "YouTube Long-form"}
${niche ? `Niche: ${niche}` : ""}
${channelVoice ? `Channel voice: ${channelVoice}` : ""}

Generate 5 distinct hooks for this content, using different hook types:
1. Curiosity gap hook (creates information gap the viewer needs to close)
2. Counter-intuitive statement hook (challenges assumption)
3. Story hook (opens mid-scene or mid-crisis)
4. Direct value hook (states exactly what the viewer will get)
5. Fear/stakes hook (what happens if they don't watch)

For each hook, score it 1-10 for CTR potential and explain why.

Return ONLY valid JSON:
{
  "hooks": [
    {
      "type": "hook type name",
      "hook": "The exact hook text (under 125 characters for YouTube)",
      "ctrScore": 7.5,
      "reasoning": "One sentence explaining why this will or won't perform well",
      "targetEmotion": "curiosity | fear | surprise | desire | validation"
    }
  ]
}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  const clean = text.replace(/```json\n?|```/g, "").trim();

  try {
    return NextResponse.json(JSON.parse(clean));
  } catch {
    return NextResponse.json({ hooks: [] });
  }
}
