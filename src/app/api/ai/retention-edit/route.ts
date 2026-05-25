import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const FORMAT_RETENTION_RULES: Record<string, string> = {
  "YouTube Long-form": "Hook creates open loop in first 30s. Re-hook every 2-3 minutes. Mid-point raises stakes. Final 20% pays off opening promise. No dead zones.",
  "YouTube Short": "First 3 words stop the scroll. Conflict lands before 30s. Last line loops back to opening.",
  "TikTok Script": "Hook creates open loop in 3s. New tension every 15-20s. Share trigger earned not requested.",
  "Instagram Reel": "Visual hook in 3s. One insight worth saving stated clearly. Ending drives save or share.",
  "Podcast Episode": "Cold open hooks before intro. Each segment has its own mini-arc. Callbacks reward long listeners.",
};

export async function POST(req: Request) {
  await getRequiredSession();
  const { script, format } = await req.json();
  if (!script?.trim() || !format) return NextResponse.json({ error: "script and format required" }, { status: 400 });
  const rules = FORMAT_RETENTION_RULES[format] || FORMAT_RETENTION_RULES["YouTube Long-form"];
  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514", max_tokens: 1500,
      system: "You are a retention editor. Return specific line-level edits. Never give a score. Return ONLY JSON.",
      messages: [{ role: "user", content: `Retention rules for ${format}: ${rules}\n\nScript:\n${script}\n\nReturn JSON: { "issues": [{ "location": "quote max 20 words", "problem": "string", "fix": "string" }], "missingElements": ["string"], "strongPoints": ["string"] }` }],
    });
    const raw = msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("");
    try { return NextResponse.json({ edit: JSON.parse(raw.replace(/```json\n?|```/g, "").trim()) }); }
    catch { return NextResponse.json({ error: "Failed to parse edit" }, { status: 500 }); }
  } catch (e: any) {
    const msg = e?.message || "";
    if (msg.includes("rate_limit") || msg.includes("529"))
      return NextResponse.json({ error: "Anthropic rate limit hit. Wait a moment and try again." }, { status: 429 });
    return NextResponse.json({ error: "Retention edit failed. Please try again." }, { status: 500 });
  }
}
