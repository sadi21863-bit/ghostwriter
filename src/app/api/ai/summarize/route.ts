export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { summarizeChapter } from "@/lib/ai/engine";

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const gate = await meterAndGate(session.user.id, "summarize");
  if (gate) return gate;
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, 'story_memories')) {
    return NextResponse.json({ error: 'upgrade_required', feature: 'story_memories' }, { status: 403 });
  }
  const { content, chapterTitle, arcPosition, characters, previousMemories } = await req.json();
  try {
    const result = await summarizeChapter(content, chapterTitle, arcPosition, characters, previousMemories);
    return NextResponse.json({ summary: result.fact, structuredData: result.structuredData });
  } catch (e: any) {
    await refundCredits(session.user.id, "summarize");
    const msg = e?.message || "";
    if (msg.includes("rate_limit") || msg.includes("529"))
      return NextResponse.json({ error: "Anthropic rate limit hit. Wait a moment and try again." }, { status: 429 });
    return NextResponse.json({ error: "Summarization failed. Please try again." }, { status: 500 });
  }
}
