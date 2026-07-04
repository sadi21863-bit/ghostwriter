export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { anthropic as client } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/engine";
import { scoreHookSystemPrompt } from "@/lib/ai/prompts";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";


function safeParseJson(raw: string) {
  const clean = raw.replace(/```json\n?|```/g, "").trim();
  try { return JSON.parse(clean); } catch { return null; }
}

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const gate = await meterAndGate(session.user.id, "score-hook");
  if (gate) return gate;
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "creator_tools_advanced")) {
    return NextResponse.json({ error: "upgrade_required", feature: "creator_tools_advanced" }, { status: 403 });
  }
  const { hook, format } = await req.json();

  if (!hook?.trim() || !format)
    return NextResponse.json({ error: "hook and format required" }, { status: 400 });

  try {
    const msg = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 200,
      system: scoreHookSystemPrompt(format),
      messages: [{ role: "user", content: hook }],
    });

    const raw = msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("");
    const parsed = safeParseJson(raw);

    if (!parsed || typeof parsed.score !== "number")
      return NextResponse.json({ error: "failed to parse score" }, { status: 500 });

    return NextResponse.json({ score: parsed.score, feedback: parsed.feedback });
  } catch (e: any) {
    await refundCredits(session.user.id, "score-hook");
    const msg = e?.message || "";
    if (msg.includes("rate_limit") || msg.includes("529"))
      return NextResponse.json({ error: "Anthropic rate limit hit. Wait a moment and try again." }, { status: 429 });
    return NextResponse.json({ error: "Hook scoring failed. Please try again." }, { status: 500 });
  }
}
