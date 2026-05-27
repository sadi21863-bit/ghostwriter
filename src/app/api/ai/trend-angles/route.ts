import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const { topic, format } = await req.json();
  if (!topic?.trim()) return NextResponse.json({ error: "Missing topic" }, { status: 400 });

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      tools: [{ type: "web_search_20250305", name: "web_search" } as any],
      system: `You are a short-form content strategist. Search for what's currently trending around a topic, then identify 5 unique angles for ${format || "short-form"} content. Each angle must:
- Be tied to something actively trending NOW (not generic)
- Have a clear hook that works in the first 3 seconds
- Feel fresh — not something every creator is already making
Return ONLY valid JSON: {"angles":[{"angle":"...","hook":"...","trendScore":8,"why":"..."}],"trendingSources":["..."]}
trendScore is 1-10 based on how hot the trend is right now.`,
      messages: [{
        role: "user",
        content: `Find trending angles for ${format || "short-form video"} content about: "${topic}"\n\nSearch what's trending NOW and return 5 specific angles with hooks. JSON only.`,
      }],
    });

    const textContent = msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
    const clean = textContent.replace(/```json\n?|```/g, "").trim();
    try {
      const data = JSON.parse(clean);
      return NextResponse.json({ trends: data });
    } catch {
      return NextResponse.json({ trends: { angles: [], trendingSources: [], raw: textContent } });
    }
  } catch (e: any) {
    if (e.message?.includes("web_search")) {
      return NextResponse.json({ error: "Web search unavailable on this API tier." }, { status: 503 });
    }
    return NextResponse.json({ error: e.message || "Trend search failed" }, { status: 500 });
  }
}
