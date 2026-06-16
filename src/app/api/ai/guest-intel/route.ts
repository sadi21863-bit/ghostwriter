export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/engine";
import { GUEST_INTEL_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const gate = await meterAndGate(session.user.id, "guest-intel");
  if (gate) return gate;
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "creator_tools_advanced")) {
    return NextResponse.json({ error: "upgrade_required", feature: "creator_tools_advanced", tier }, { status: 403 });
  }

  const { guestName, topic } = await req.json();
  if (!guestName?.trim()) return NextResponse.json({ error: "Missing guestName" }, { status: 400 });

  try {
    const msg = await client.messages.create({
      model: MODELS.default,
      max_tokens: 2000,
      tools: [{ type: "web_search_20250305", name: "web_search" } as any],
      system: GUEST_INTEL_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Research podcast guest: "${guestName}"${topic ? `\nEpisode topic: "${topic}"` : ""}\n\nFind background, recent work, and generate 5-7 specific interview questions the audience hasn't heard before. Return JSON only.`,
      }],
    });

    const textContent = msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
    const clean = textContent.replace(/```json\n?|```/g, "").trim();
    try {
      const data = JSON.parse(clean);
      return NextResponse.json({ intel: data });
    } catch {
      return NextResponse.json({ intel: { background: textContent, recentWork: [], strongOpinions: [], questions: [], topicsToAvoid: [], audienceKnows: "" } });
    }
  } catch (e: any) {
    await refundCredits(session.user.id, "guest-intel");
    if (e.message?.includes("web_search")) {
      return NextResponse.json({ error: "Web search unavailable on this API tier." }, { status: 503 });
    }
    return NextResponse.json({ error: e.message || "Guest intel failed" }, { status: 500 });
  }
}
