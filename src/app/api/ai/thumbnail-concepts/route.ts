// src/app/api/ai/thumbnail-concepts/route.ts
// Generates 3 thumbnail concept descriptions per video.
// Creator Pro feature.

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/engine";

const anthropic = new Anthropic();

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "creator_tools_advanced")) {
    return NextResponse.json({ error: "upgrade_required", feature: "creator_tools_advanced" }, { status: 403 });
  }

  const { videoTitle, contentSummary, niche, channelVoice } = await req.json();

  const prompt = `You are a YouTube thumbnail strategist. Generate 3 distinct thumbnail concepts for this video.

Video title: ${videoTitle}
${contentSummary ? `Content: ${contentSummary}` : ""}
${niche ? `Niche: ${niche}` : ""}
${channelVoice ? `Channel style: ${channelVoice}` : ""}

Each concept must be visually distinct — different emotional approach, different layout, different text strategy.

Return ONLY valid JSON:
{
  "concepts": [
    {
      "conceptName": "Short name for this concept (e.g. 'Before/After', 'Reaction Face', 'Bold Statement')",
      "emotionalHook": "What makes someone stop scrolling — the psychological trigger this thumbnail exploits",
      "foreground": "What is in the foreground and how it is positioned",
      "background": "Background description — colour, scene, or environment",
      "textOverlay": "Exact text to display on the thumbnail (keep under 4 words for maximum impact)",
      "textPosition": "Where the text sits (top-left, center, bottom-right, etc.)",
      "colourPalette": "3-4 specific colours that work for this concept (e.g. 'deep red, white, black')",
      "facialExpression": "If a face is shown: what expression and why it works for this concept, or 'No face' if better without",
      "whyItWorks": "One sentence: the specific psychological or visual reason this thumbnail would perform"
    }
  ]
}`;

  const response = await anthropic.messages.create({
    model: MODELS.default,
    max_tokens: 1400,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  const clean = text.replace(/```json\n?|```/g, "").trim();

  try {
    return NextResponse.json(JSON.parse(clean));
  } catch {
    return NextResponse.json({ concepts: [] });
  }
}
