export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { anthropic } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/engine";
import { REPURPOSE_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";


export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const gate = await meterAndGate(session.user.id, "repurpose");
  if (gate) return gate;
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "creator_tools_advanced")) {
    return NextResponse.json({ error: "upgrade_required", feature: "creator_tools_advanced" }, { status: 403 });
  }

  const { script, format, niche, channelVoice, videoTitle, platforms } = await req.json();
  if (!script?.trim()) {
    return NextResponse.json({ error: "script required" }, { status: 400 });
  }

  const targetPlatforms: string[] = platforms || ["youtube_short", "tiktok", "instagram", "twitter_thread", "linkedin", "newsletter", "youtube_description"];

  try {
    const response = await anthropic.messages.create({
      model: MODELS.default,
      max_tokens: 4000,
      system: [{
        type: "text",
        text: REPURPOSE_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      }],
      messages: [{
        role: "user",
        content: `Atomise this ${format || "YouTube"} script into native content for each requested platform.

ORIGINAL SCRIPT:
${script.slice(0, 4000)}

${videoTitle ? `Video title: ${videoTitle}` : ""}
${niche ? `Niche: ${niche}` : ""}
${channelVoice ? `Voice: ${channelVoice}` : ""}

PLATFORM WRITING RULES:
- youtube_short: 60-90 seconds (~150-200 words). First 3 words stop the scroll.
  Conflict or hook before 5 seconds. Loops back to opening at end.
  No intro, no "welcome back". Starts immediately mid-action or with a claim.
- tiktok: 60-90 seconds. Sound-first thinking. Mark beat-drop moments [BEAT].
  Highly personal tone, speaks directly to ONE person. Trending format signals.
- instagram: 150-word caption max. One insight worth saving stated clearly.
  5 carousel slide copy lines (each slide = one idea, first slide = hook).
  3-5 relevant hashtags embedded naturally.
- twitter_thread: 6-10 tweets. Each standalone as insight. Opens with the most
  counter-intuitive claim. 1/ format. Final tweet = summary + soft CTA.
  Max 280 chars per tweet.
- linkedin: 150-200 word post. Professional register but not corporate.
  Opens with a specific story or data point, not with "I". Ends with a question.
  No hashtags. Paragraph breaks every 2 sentences.
- newsletter: Subject line + 100-word preview text + 300-word body.
  Subject: curiosity gap or direct benefit. Body: conversational, story-first,
  one clear CTA at the end.
- youtube_description: 300-400 words. First 2 lines visible before fold.
  Keywords embedded naturally. Section headers for chapters (00:00 format).
  Links and CTAs at the bottom.

Requested platforms: ${targetPlatforms.join(", ")}

Return JSON where keys are platform names from the requested list:
{
  "youtube_short": "the script",
  "tiktok": "the script with [BEAT] markers",
  "instagram": { "caption": "string", "carouselSlides": ["string x5"], "hashtags": ["string"] },
  "twitter_thread": ["tweet 1", "tweet 2"],
  "linkedin": "the post",
  "newsletter": { "subject": "string", "preview": "string", "body": "string" },
  "youtube_description": "the description with timestamps"
}
Include only the platforms that were requested.`,
      }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
    try {
      return NextResponse.json(JSON.parse(raw.replace(/```json\n?|```/g, "").trim()));
    } catch {
      await refundCredits(session.user.id, "repurpose");
      return NextResponse.json({ error: "Parse failed" }, { status: 500 });
    }
  } catch (e: any) {
    await refundCredits(session.user.id, "repurpose");
    return NextResponse.json({ error: e.message || "Repurpose failed." }, { status: 500 });
  }
}
