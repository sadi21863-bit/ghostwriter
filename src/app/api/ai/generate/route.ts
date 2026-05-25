import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { generate } from "@/lib/ai/engine";
import { db } from "@/db";
import { generations } from "@/db/schema";

export async function POST(req: Request) {
  await getRequiredSession();
  const { mode, prompt, context, format, projectId, chapterId } = await req.json();

  if (!prompt?.trim()) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  if (!mode) return NextResponse.json({ error: "Mode is required" }, { status: 400 });

  const totalLength = (context || "").length + (prompt || "").length;
  if (totalLength > 150000) {
    return NextResponse.json({ error: "Context too large. Try reducing your World Bible or clearing old memories." }, { status: 400 });
  }

  try {
    const r = await generate({ mode, prompt, context, format });
    await db.insert(generations).values({
      projectId, chapterId: chapterId || null, mode, prompt,
      output: r.text, model: r.model, tokensUsed: r.tokensUsed,
    });
    return NextResponse.json(r);
  } catch (e: any) {
    const msg = e?.message || "";
    if (msg.includes("rate_limit") || msg.includes("529"))
      return NextResponse.json({ error: "Anthropic rate limit hit. Wait a moment and try again." }, { status: 429 });
    if (msg.includes("context_length") || msg.includes("too long"))
      return NextResponse.json({ error: "Context too long. Reduce World Bible detail or clear old memories." }, { status: 400 });
    return NextResponse.json({ error: "Generation failed. Please try again." }, { status: 500 });
  }
}
