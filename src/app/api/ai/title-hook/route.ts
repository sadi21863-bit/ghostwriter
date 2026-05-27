import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const { hook, format, topic } = await req.json();
  if (!hook?.trim()) return NextResponse.json({ error: "hook required" }, { status: 400 });
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001", max_tokens: 600,
      system: `You are a title strategist for ${format || "YouTube"} content. Return ONLY JSON.`,
      messages: [{ role: "user", content: `Hook: "${hook}"\nTopic: "${topic || ""}"\n\nGenerate 5 title variants. For each, state how it sets up the hook.\nReturn JSON: { "titles": [{ "title": "string", "alignment": "string", "ctrScore": 1 }] }` }],
    });
    const raw = msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("");
    try { return NextResponse.json(JSON.parse(raw.replace(/```json\n?|```/g, "").trim())); }
    catch { return NextResponse.json({ error: "Failed to parse titles" }, { status: 500 }); }
  } catch (e: any) {
    const msg = e?.message || "";
    if (msg.includes("rate_limit") || msg.includes("529"))
      return NextResponse.json({ error: "Rate limit hit. Try again in a moment." }, { status: 429 });
    return NextResponse.json({ error: "Title generation failed." }, { status: 500 });
  }
}
