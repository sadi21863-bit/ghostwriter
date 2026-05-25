import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function safeParseJson(raw: string) {
  const clean = raw.replace(/```json\n?|```/g, "").trim();
  try { return JSON.parse(clean); } catch { return null; }
}

export async function POST(req: Request) {
  await getRequiredSession();
  const { hook, format } = await req.json();

  if (!hook?.trim() || !format)
    return NextResponse.json({ error: "hook and format required" }, { status: 400 });

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: `You are a viral content expert specializing in ${format}. Rate the given hook 1-10 on scroll-stopping power for that platform. Explain in exactly 2 sentences why it works or doesn't. Return ONLY JSON with no markdown: {"score":N,"feedback":"string"}`,
      messages: [{ role: "user", content: hook }],
    });

    const raw = msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("");
    const parsed = safeParseJson(raw);

    if (!parsed || typeof parsed.score !== "number")
      return NextResponse.json({ error: "failed to parse score" }, { status: 500 });

    return NextResponse.json({ score: parsed.score, feedback: parsed.feedback });
  } catch (e: any) {
    const msg = e?.message || "";
    if (msg.includes("rate_limit") || msg.includes("529"))
      return NextResponse.json({ error: "Anthropic rate limit hit. Wait a moment and try again." }, { status: 429 });
    return NextResponse.json({ error: "Hook scoring failed. Please try again." }, { status: 500 });
  }
}
