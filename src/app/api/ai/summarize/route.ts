import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { summarizeChapter } from "@/lib/ai/engine";

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, 'story_memories')) {
    return NextResponse.json({ error: 'upgrade_required', feature: 'story_memories' }, { status: 403 });
  }
  const { content } = await req.json();
  try {
    const summary = await summarizeChapter(content);
    return NextResponse.json({ summary });
  } catch (e: any) {
    const msg = e?.message || "";
    if (msg.includes("rate_limit") || msg.includes("529"))
      return NextResponse.json({ error: "Anthropic rate limit hit. Wait a moment and try again." }, { status: 429 });
    return NextResponse.json({ error: "Summarization failed. Please try again." }, { status: 500 });
  }
}
