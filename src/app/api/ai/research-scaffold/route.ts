export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/engine";
import { RESEARCH_SCAFFOLD_SYSTEM_PROMPT } from "@/lib/ai/prompts";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const gate = await meterAndGate(session.user.id, "research-scaffold");
  if (gate) return gate;
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "creator_tools_advanced")) {
    return NextResponse.json({ error: "upgrade_required", feature: "creator_tools_advanced", tier }, { status: 403 });
  }

  const { topic, angle } = await req.json();
  if (!topic?.trim()) return NextResponse.json({ error: "Missing topic" }, { status: 400 });

  try {
    const searchQuery = angle ? `${topic} ${angle} research statistics arguments` : `${topic} research statistics arguments evidence`;

    const msg = await client.messages.create({
      model: MODELS.default,
      max_tokens: 2000,
      tools: [{ type: "web_search_20250305", name: "web_search" } as any],
      system: RESEARCH_SCAFFOLD_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Research this YouTube video topic: "${topic}"${angle ? `\nSpecific angle: "${angle}"` : ""}\n\nSearch for supporting evidence, statistics, counter-arguments, and expert perspectives. Return JSON only.`,
      }],
    });

    const textContent = msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
    const clean = textContent.replace(/```json\n?|```/g, "").trim();
    try {
      const data = JSON.parse(clean);
      return NextResponse.json({ scaffold: data });
    } catch {
      return NextResponse.json({ scaffold: { claims: [], counterArguments: [], quotes: [], angles: [], searchedFor: topic, raw: textContent } });
    }
  } catch (e: any) {
    await refundCredits(session.user.id, "research-scaffold");
    if (e.message?.includes("web_search")) {
      return NextResponse.json({ error: "Web search unavailable on this API tier." }, { status: 503 });
    }
    return NextResponse.json({ error: e.message || "Research failed" }, { status: 500 });
  }
}
