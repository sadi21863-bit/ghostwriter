export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { anthropic as client } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/engine";
import { BETA_READER_PERSONAS } from "@/lib/roles/editor";
import { summarizeBetaPanel } from "@/lib/editor/beta-reader-summary";

interface BetaReaderResult {
  persona: string;
  reaction: string;
  highlights: string[];
  concerns: string[];
  verdict: string;
  dnfPoint?: string;
}

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const gate = await meterAndGate(session.user.id, "beta-read");
  if (gate) return gate;
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "story_modes_advanced")) {
    return NextResponse.json({ error: "upgrade_required", feature: "beta_reader_panel" }, { status: 403 });
  }

  const { text, format } = await req.json();

  if (!text?.trim() || text.trim().length < 200) {
    return NextResponse.json({ error: "This passage is too short to meaningfully review." }, { status: 400 });
  }

  const cappedText = text.length > 8000 ? text.slice(0, 8000) + "\n\n[...chapter continues...]" : text;
  const formatLine = format ? `\n\nThis passage is from a ${format}.` : "";

  const settled = await Promise.allSettled(
    BETA_READER_PERSONAS.map(async persona => {
      const msg = await client.messages.create({
        model: MODELS.default,
        max_tokens: 800,
        system: persona.systemPrompt + formatLine,
        messages: [{ role: "user", content: cappedText }],
      });
      const raw = msg.content.filter(b => b.type === "text").map((b: any) => b.text).join("");
      const clean = raw.replace(/```json\n?|```/g, "").trim();
      const parsed = JSON.parse(clean);
      return { persona: persona.name, ...parsed } as BetaReaderResult;
    })
  );

  const results = settled
    .filter((r): r is PromiseFulfilledResult<BetaReaderResult> => r.status === "fulfilled")
    .map(r => r.value);

  if (results.length === 0) {
    await refundCredits(session.user.id, "beta-read");
    return NextResponse.json({ error: "Beta reader panel failed. Please try again." }, { status: 500 });
  }

  const summary = summarizeBetaPanel(results.map(r => ({ persona: r.persona, verdict: r.verdict })));
  return NextResponse.json({ results, summary });
}
