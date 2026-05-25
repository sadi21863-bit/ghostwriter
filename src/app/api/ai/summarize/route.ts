import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { summarizeChapter } from "@/lib/ai/engine";

export async function POST(req: Request) {
  await getRequiredSession();
  const { content } = await req.json();
  try {
    const summary = await summarizeChapter(content);
    return NextResponse.json({ summary });
  } catch (e: any) {
    const msg = e?.message || "";
    if (msg.includes("rate_limit") || msg.includes("529"))
      return NextResponse.json({ error: "Anthropic rate limit hit. Wait a moment and try again." }, { status: 429 });
    return NextResponse.json({ error: "Summarization failed. Please try again." }, { status: 500 });
  }
}
