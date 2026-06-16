export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/engine";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const { passage } = await req.json();

  if (!passage || passage.length < 30) {
    return NextResponse.json({ directives: "" });
  }

  const gate = await meterAndGate(session.user.id, "analyze-passage");
  if (gate) return gate;

  try {
    const msg = await client.messages.create({
      model: MODELS.default,
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `Analyze this passage and extract its specific craft techniques as a set of generation directives. Be concrete and technical, not generic.

PASSAGE:
${passage.slice(0, 2000)}

Return ONLY a brief set of directives (5-7 lines max) that describe HOW this passage achieves its effect — sentence rhythm, subtext mechanisms, what the narrator notices, physical vs emotional register, pacing technique, specific structural moves. Do not describe WHAT it contains. Describe HOW it works.
Start each line with a verb. Be specific enough that an AI could apply these techniques to completely different content.`,
      }],
    });

    const text = msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("").trim();

    return NextResponse.json({ directives: text ? `REFERENCE PASSAGE TECHNIQUE:\n${text}` : "" });
  } catch {
    await refundCredits(session.user.id, "analyze-passage");
    return NextResponse.json({ directives: "" });
  }
}
