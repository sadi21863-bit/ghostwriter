export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/engine";
import { checkSemanticCache, writeSemanticCache } from "@/lib/semantic-cache";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const { topic, format, targetAudience } = await req.json();
  if (!topic?.trim()) return NextResponse.json({ error: "topic required" }, { status: 400 });

  const semanticKey = `${format ?? "YouTube"}: ${topic}`;
  const cached = await checkSemanticCache("domain_research", semanticKey);
  if (cached && typeof cached.researchBrief === "string") {
    return NextResponse.json({ researchBrief: cached.researchBrief, fromCache: true });
  }

  try {
    const msg = await client.messages.create({
      model: MODELS.default,
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `Research this topic for a ${format ?? "YouTube"} creator: "${topic}"
${targetAudience ? `Target audience: ${targetAudience}` : ""}

Find and synthesize:
1. What questions audiences actually ask about this topic (common search patterns, Reddit/YouTube comments)
2. What angles competitors are NOT covering (gaps in existing content)
3. Surprising or counterintuitive facts that could make great hooks
4. Why this topic is relevant RIGHT NOW (recent developments, trending angle)

Return a research brief with these sections:
HOOK ANGLES (3-4 specific opening angles that could grab attention)
AUDIENCE QUESTIONS (5-6 real questions people ask about this)
CONTENT GAPS (what existing content misses on this topic)
KEY FACTS (3-4 surprising/specific facts worth including)
TRENDING ANGLE (why this topic is relevant right now)`,
      }],
    });

    const fullText = msg.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");

    if (fullText) { writeSemanticCache("domain_research", semanticKey, { researchBrief: fullText }); }
    return NextResponse.json({ researchBrief: fullText });
  } catch (e: any) {
    const msg = e?.message || "";
    if (msg.includes("rate_limit") || msg.includes("529"))
      return NextResponse.json({ error: "Rate limit hit. Please try again." }, { status: 429 });
    return NextResponse.json({ error: "Research failed." }, { status: 500 });
  }
}
