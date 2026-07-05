export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { anthropic } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/engine";
import { TIKTOK_SCRIPT_SYSTEM_PROMPT } from "@/lib/roles/writer";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";


const TIKTOK_HOOK_PATTERNS = [
  "POV: [situation the viewer is in right now]",
  "Things [audience group] will understand:",
  "Wait until you see [what happens at the end]",
  "The reason [common behavior] is [surprising truth]:",
  "Nobody talks about [uncomfortable truth about niche]",
  "I tried [thing] for [time period]. Here's what happened:",
  "[Number] [things] that changed everything for me:",
  "Hot take: [counter-intuitive claim]",
  "If you [have this problem], watch this:",
  "The [industry/niche] secret they don't want you to know:",
  "This [simple thing] made me [impressive result]:",
  "Unpopular opinion about [topic]:",
];

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const gate = await meterAndGate(session.user.id, "tiktok-native");
  if (gate) return gate;
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "creator_tools_advanced")) {
    return NextResponse.json({ error: "upgrade_required", feature: "creator_tools_advanced" }, { status: 403 });
  }

  const { topic, niche, soundStrategy, mode } = await req.json();
  if (!topic?.trim()) {
    return NextResponse.json({ error: "topic required" }, { status: 400 });
  }

  try {
    if (mode === "hooks") {
      const response = await anthropic.messages.create({
        model: MODELS.default,
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `Generate 5 TikTok hooks for this topic using different hook patterns.
Topic: ${topic}
${niche ? `Niche: ${niche}` : ""}

Hook patterns to use (choose the 5 best fit):
${TIKTOK_HOOK_PATTERNS.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Rules: First 3 words must stop the scroll. Under 15 words total. Speaks to ONE person.
Return ONLY valid JSON: { "hooks": [{ "hook": "string", "pattern": "pattern used", "openLoop": "what question does this create?" }] }`,
        }],
      });
      const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
      try {
        return NextResponse.json(JSON.parse(raw.replace(/```json\n?|```/g, "").trim()));
      } catch {
        await refundCredits(session.user.id, "tiktok-native");
        return NextResponse.json({ error: "Parse failed" }, { status: 500 });
      }
    }

    const response = await anthropic.messages.create({
      model: MODELS.default,
      max_tokens: 1500,
      system: [{ type: "text", text: TIKTOK_SCRIPT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{
        role: "user",
        content: `Write a TikTok script for: ${topic}
${niche ? `Niche: ${niche}` : ""}
Sound strategy: ${soundStrategy || "Voice-only"}

TIKTOK SCRIPT RULES:
- 45-90 seconds total (~120-220 words)
- First 3 words stop the scroll — no greetings, no setup
- If using trending audio: mark [BEAT DROP] where the beat drops
- Pattern interrupt every 15-20 seconds: new angle, cut, or revelation
- Never say "like and follow" — earn it with value
- Speak to ONE person, not "you guys"
- End with: loop hook (last line connects to first) OR strong CTA (one action only)
- Mark timing: [0s], [15s], [30s], [45s] etc.

Return ONLY valid JSON:
{
  "hook": "the opening line",
  "script": "full script with timing markers and [BEAT DROP] if applicable",
  "captionSuggestion": "caption text under 100 chars",
  "hashtagStack": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "soundNote": "specific sound/audio recommendation or 'original audio'",
  "estimatedSeconds": 60
}`,
      }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
    try {
      return NextResponse.json(JSON.parse(raw.replace(/```json\n?|```/g, "").trim()));
    } catch {
      await refundCredits(session.user.id, "tiktok-native");
      return NextResponse.json({ error: "Parse failed" }, { status: 500 });
    }
  } catch (e: any) {
    await refundCredits(session.user.id, "tiktok-native");
    return NextResponse.json({ error: e.message || "TikTok script generation failed." }, { status: 500 });
  }
}
