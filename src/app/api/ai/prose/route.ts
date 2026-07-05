export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { anthropic as client } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/engine";
import {
  proseExpandSystemPrompt,
  PROSE_SHOW_DONT_TELL_SYSTEM_PROMPT,
  PROSE_SUBTEXT_SYSTEM_PROMPT,
  PROSE_TIGHTEN_SYSTEM_PROMPT,
  proseRewriteSystemPrompt,
} from "@/lib/roles/editor";


function safeParseJson(raw: string) {
  const clean = raw.replace(/```json\n?|```/g, "").trim();
  try { return JSON.parse(clean); } catch { return null; }
}

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const gate = await meterAndGate(session.user.id, "prose");
  if (gate) return gate;
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, 'story_modes_advanced')) {
    return NextResponse.json({ error: 'upgrade_required', feature: 'prose_tools' }, { status: 403 });
  }
  const { text, mode, projectContext, activeMode } = await req.json();

  if (!text?.trim() || !mode)
    return NextResponse.json({ error: "text and mode required" }, { status: 400 });

  const validModes = ["expand", "rewrite", "show-dont-tell", "tighten", "subtext"];
  if (!validModes.includes(mode))
    return NextResponse.json({ error: "invalid mode" }, { status: 400 });

  const ctx = projectContext || "";

  let systemPrompt: string;
  if (mode === "expand") {
    systemPrompt = proseExpandSystemPrompt(activeMode) + "\n" + ctx;
  } else if (mode === "show-dont-tell") {
    systemPrompt = PROSE_SHOW_DONT_TELL_SYSTEM_PROMPT + "\n" + ctx;
  } else if (mode === "tighten") {
    systemPrompt = PROSE_TIGHTEN_SYSTEM_PROMPT + "\n" + ctx;
  } else if (mode === "subtext") {
    systemPrompt = PROSE_SUBTEXT_SYSTEM_PROMPT;
  } else {
    systemPrompt = proseRewriteSystemPrompt(ctx);
  }

  try {
    const msg = await client.messages.create({
      model: MODELS.default,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: text }],
    });

    const raw = msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("");

    if (mode === "rewrite") {
      const variants = safeParseJson(raw);
      return NextResponse.json({ variants: Array.isArray(variants) ? variants : [raw] });
    }

    if (mode === "subtext") {
      const parsed = safeParseJson(raw);
      return NextResponse.json(parsed ?? { result: raw });
    }

    return NextResponse.json({ result: raw });
  } catch (e: any) {
    await refundCredits(session.user.id, "prose");
    const msg = e?.message || "";
    if (msg.includes("rate_limit") || msg.includes("529"))
      return NextResponse.json({ error: "Anthropic rate limit hit. Wait a moment and try again." }, { status: 429 });
    return NextResponse.json({ error: "Prose tool failed. Please try again." }, { status: 500 });
  }
}
