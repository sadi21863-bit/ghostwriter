import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function safeParseJson(raw: string) {
  const clean = raw.replace(/```json\n?|```/g, "").trim();
  try { return JSON.parse(clean); } catch { return null; }
}

const PROSE_PROMPTS: Record<string, (ctx: string) => string> = {
  expand: (ctx) =>
    `You are a prose expansion specialist. Take the given text and expand it into a fuller, richer passage. Add sensory detail, ground the moment physically, deepen the emotional texture. Do not change what happens — only enrich it. Return ONLY the expanded text. No explanation, no preamble.\nWorld context for characters and locations present:\n${ctx}`,

  rewrite: (ctx) =>
    `You are a prose rewriter. Generate EXACTLY 5 different rewrites of the given text. Each rewrite should vary in tone, rhythm, or stylistic approach while preserving the same events and meaning. Return as a JSON array of 5 strings: ["rewrite1","rewrite2","rewrite3","rewrite4","rewrite5"]. No markdown fences, no explanation, only the JSON array.\nWorld context:\n${ctx}`,

  "show-dont-tell": (ctx) =>
    `You are a "show don't tell" specialist. Rewrite the given text to eliminate telling statements and replace them with specific sensory details, physical actions, and concrete images. If a character feels afraid, show their hands. If a location is gloomy, show the peeling paint. Never state an emotion directly. Return ONLY the rewritten text. No explanation.\nCharacter and location context:\n${ctx}`,

  tighten: (ctx) =>
    `You are a line editor specialising in concision. Cut the given text to its essential meaning. Remove redundancy, weak modifiers, and throat-clearing. Every word must earn its place. Do not change the events, tone, or voice — only eliminate what is unnecessary. Target 40-60% of the original length. Return ONLY the tightened text.\nContext:\n${ctx}`,
};

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const { text, mode, projectContext } = await req.json();

  if (!text?.trim() || !mode)
    return NextResponse.json({ error: "text and mode required" }, { status: 400 });

  const systemFn = PROSE_PROMPTS[mode];
  if (!systemFn)
    return NextResponse.json({ error: "invalid mode" }, { status: 400 });

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemFn(projectContext || ""),
      messages: [{ role: "user", content: text }],
    });

    const raw = msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("");

    if (mode === "rewrite") {
      const variants = safeParseJson(raw);
      return NextResponse.json({ variants: Array.isArray(variants) ? variants : [raw] });
    }

    return NextResponse.json({ result: raw });
  } catch (e: any) {
    const msg = e?.message || "";
    if (msg.includes("rate_limit") || msg.includes("529"))
      return NextResponse.json({ error: "Anthropic rate limit hit. Wait a moment and try again." }, { status: 429 });
    return NextResponse.json({ error: "Prose tool failed. Please try again." }, { status: 500 });
  }
}
