export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/engine";
import { proseTargetedFixSystemPrompt } from "@/lib/ai/prompts";
import { extractVoiceFingerprint, fingerprintToConstraints } from "@/lib/ai/voice-fingerprint";
import { buildPromiseLedger } from "@/lib/ai/promise-ledger";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const gate = await meterAndGate(session.user.id, "prose");
  if (gate) return gate;
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, 'story_modes_advanced')) {
    return NextResponse.json({ error: 'upgrade_required', feature: 'prose_fix' }, { status: 403 });
  }

  const { text, fixInstruction, projectId } = await req.json();

  if (!text?.trim() || !fixInstruction?.trim()) {
    return NextResponse.json({ error: "text and fixInstruction are required" }, { status: 400 });
  }

  const cappedText = text.length > 6000 ? text.slice(0, 6000) + "\n\n[...chapter continues...]" : text;

  const fp = extractVoiceFingerprint([cappedText]);
  const voiceConstraints = fp ? fingerprintToConstraints(fp) : "";
  const promiseLedger = projectId ? await buildPromiseLedger(projectId, "preserve") : "";
  const extra = [voiceConstraints, promiseLedger].filter(Boolean).join("\n\n");
  const system = proseTargetedFixSystemPrompt(fixInstruction) + (extra ? `\n\n${extra}` : "");

  try {
    const msg = await client.messages.create({
      model: MODELS.default,
      max_tokens: 3000,
      system,
      messages: [{ role: "user", content: cappedText }],
    });

    const result = msg.content
      .filter(b => b.type === "text")
      .map(b => (b as any).text)
      .join("");

    return NextResponse.json({ result });
  } catch (e: any) {
    await refundCredits(session.user.id, "prose");
    const msg = e?.message || "";
    if (msg.includes("rate_limit") || msg.includes("529"))
      return NextResponse.json({ error: "Anthropic rate limit hit. Wait a moment and try again." }, { status: 429 });
    return NextResponse.json({ error: "Fix generation failed. Please try again." }, { status: 500 });
  }
}
