import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const { topic, angle } = await req.json();
  if (!topic?.trim()) return NextResponse.json({ error: "Missing topic" }, { status: 400 });

  try {
    const searchQuery = angle ? `${topic} ${angle} research statistics arguments` : `${topic} research statistics arguments evidence`;

    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      tools: [{ type: "web_search_20250305", name: "web_search" } as any],
      system: `You are a research assistant for YouTube creators. Search for current, credible information to support long-form video content. Always prioritize:
1. Specific statistics with sources (not vague claims)
2. Counter-arguments the creator should address
3. Expert quotes or positions
4. Recent developments (last 2 years)
Return ONLY valid JSON with this shape: {"claims":[{"claim":"...","source":"...","url":"..."}],"counterArguments":["..."],"quotes":["..."],"angles":["..."],"searchedFor":"..."}`,
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
    if (e.message?.includes("web_search")) {
      return NextResponse.json({ error: "Web search unavailable on this API tier." }, { status: 503 });
    }
    return NextResponse.json({ error: e.message || "Research failed" }, { status: 500 });
  }
}
