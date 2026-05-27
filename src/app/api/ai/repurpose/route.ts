import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const FORMAT_TEMPLATES: Record<string, string> = {
  "YouTube Short": `Reformat this content as a YouTube Short script (max 60 seconds / ~150 words):
- First 3 words must be a scroll-stopping hook — no "hey guys", no intros
- Structure: HOOK → single conflict or insight → payoff → loop ending
- Last line should connect back to the hook to create a loop
- Write for someone who might be watching with sound off`,

  "TikTok Script": `Reformat this content as a TikTok script (max 90 seconds / ~200 words):
- Hook must create an open loop or pattern interrupt in the first 3 seconds
- Add [TEXT ON SCREEN: ...] markers for every key point
- Structure: Hook → Tension → Reveal → Share trigger
- Write for sound-off viewing — key info must work as text overlays`,

  "Instagram Reel": `Reformat this content as an Instagram Reel script (max 60 seconds / ~150 words):
- Start with a visual hook — describe what the viewer sees in the first frame
- Add [VISUAL: description] markers for each scene change
- Every reel needs one insight worth saving — make it clear and quotable
- End with a save/share trigger`,

  "Twitter/X Thread": `Reformat this content as a Twitter/X thread:
- Tweet 1 is the hook — must make someone stop scrolling and click "show more"
- Each tweet should be able to stand alone as its own insight
- Number each tweet: 1/, 2/, 3/ ...
- Final tweet: summary + CTA (follow/retweet)
- Max 280 characters per tweet`,
};

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "creator_tools_advanced")) {
    return NextResponse.json({ error: "upgrade_required", feature: "creator_tools_advanced", tier }, { status: 403 });
  }

  const { content, sourceFormat, targetFormat } = await req.json();
  if (!content?.trim() || !targetFormat) return NextResponse.json({ error: "Missing content or targetFormat" }, { status: 400 });

  try {
    // Agent 1 (Haiku): identify the strongest moment
    const extractMsg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `From this ${sourceFormat} content, identify the single most repurposable moment — the one insight, story beat, or argument that would work best as a short-form video or post. Extract it verbatim or near-verbatim. Return ONLY the extracted passage, nothing else.\n\nCONTENT:\n${content.substring(0, 6000)}`,
      }],
    });
    const bestMoment = extractMsg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();

    // Agent 2 (Sonnet): reformat for target platform
    const template = FORMAT_TEMPLATES[targetFormat] || `Reformat this content for ${targetFormat}.`;
    const reformatMsg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `You are a content repurposing specialist. ${template}`,
      messages: [{
        role: "user",
        content: `Repurpose this extracted moment for ${targetFormat}:\n\n${bestMoment}`,
      }],
    });
    const repurposed = reformatMsg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();

    return NextResponse.json({ repurposed, bestMoment, targetFormat });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Repurpose failed" }, { status: 500 });
  }
}
