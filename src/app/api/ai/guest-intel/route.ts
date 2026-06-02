import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/engine";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
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
      system: `You are a podcast research assistant. Search for information about a guest to help the host prepare intelligent, specific questions. Focus on:
1. Recent work (last 2 years) — books, projects, talks
2. Known strong opinions or contrarian views
3. Audience the guest has already reached (no need to re-explain basics)
4. Specific topics to avoid (controversies, sensitive areas)
5. "Wow" questions — non-obvious angles based on their actual work
Return ONLY valid JSON: {"background":"...","recentWork":["..."],"strongOpinions":["..."],"questions":["..."],"topicsToAvoid":["..."],"audienceKnows":"..."}`,
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
    if (e.message?.includes("web_search")) {
      return NextResponse.json({ error: "Web search unavailable on this API tier." }, { status: 503 });
    }
    return NextResponse.json({ error: e.message || "Guest intel failed" }, { status: 500 });
  }
}
