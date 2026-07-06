export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { anthropic } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/engine";
import { CREATOR_SEO_SYSTEM_PROMPT } from "@/lib/roles/director";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";


export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const gate = await meterAndGate(session.user.id, "creator-seo");
  if (gate) return gate;
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "creator_tools_advanced")) {
    return NextResponse.json({ error: "upgrade_required", feature: "creator_tools_advanced" }, { status: 403 });
  }

  const { script, videoTitle, niche, channelName, chapterBreaks } = await req.json();
  if (!script?.trim()) return NextResponse.json({ error: "script required" }, { status: 400 });

  try {
    const response = await anthropic.messages.create({
      model: MODELS.default,
      max_tokens: 3000,
      system: [{
        type: "text",
        text: CREATOR_SEO_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      }],
      messages: [{
        role: "user",
        content: `Generate complete YouTube SEO metadata for this video.

Script excerpt (first 2000 chars):
${script.slice(0, 2000)}

${videoTitle ? `Working title: ${videoTitle}` : ""}
${niche ? `Niche: ${niche}` : ""}
${channelName ? `Channel: ${channelName}` : ""}
${chapterBreaks ? `Chapter markers provided: ${JSON.stringify(chapterBreaks)}` : "Generate chapter timestamps from the script structure."}

Return ONLY valid JSON:
{
  "titleVariants": [
    { "title": "string", "ctrPrediction": "high|medium|low", "psychologicalTrigger": "curiosity|fear|desire|surprise|validation", "characterCount": 60 }
  ],
  "description": {
    "aboveFold": "First 2 lines (visible before 'Show more' — include the hook and the value promise)",
    "fullDescription": "300-400 word description with keywords embedded naturally",
    "chapters": ["00:00 Intro", "01:30 First section"]
  },
  "tags": ["tag1", "tag2"],
  "thumbnailTextSuggestion": "3-5 words max for thumbnail text overlay",
  "keywordAnalysis": {
    "primaryKeyword": "string",
    "secondaryKeywords": ["string"],
    "longTailOpportunity": "string"
  }
}`,
      }],
    });

    const raw = response.content.filter(b => b.type === "text").map(b => (b as any).text).join("") || "{}";
    try {
      return NextResponse.json(JSON.parse(raw.replace(/```json\n?|```/g, "").trim()));
    } catch {
      await refundCredits(session.user.id, "creator-seo");
      return NextResponse.json({ error: "Parse failed" }, { status: 500 });
    }
  } catch (e: any) {
    await refundCredits(session.user.id, "creator-seo");
    return NextResponse.json({ error: e.message || "Creator SEO generation failed." }, { status: 500 });
  }
}
