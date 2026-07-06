export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { anthropic as client } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/engine";
import { surgicalEditSystemPrompt } from "@/lib/roles/editor";
import { isValidTipTapJson, tiptapToPlainText, plainTextToTipTap } from "@/lib/editor/content-migration";
import { extractVoiceFingerprint, fingerprintToConstraints } from "@/lib/ai/voice-fingerprint";
import { buildPromiseLedger } from "@/lib/ai/promise-ledger";


export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const gate = await meterAndGate(session.user.id, "prose");
  if (gate) return gate;
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, 'story_modes_advanced')) {
    return NextResponse.json({ error: 'upgrade_required', feature: 'surgical_edit' }, { status: 403 });
  }

  const { chapterContent, instruction, projectId } = await req.json();

  if (!chapterContent?.trim() || !instruction?.trim()) {
    return NextResponse.json({ error: "chapterContent and instruction are required" }, { status: 400 });
  }

  let plainText: string;
  if (isValidTipTapJson(chapterContent)) {
    plainText = tiptapToPlainText(JSON.parse(chapterContent));
  } else {
    plainText = chapterContent;
  }

  const cappedText = plainText.length > 8000 ? plainText.slice(0, 8000) + "\n\n[...chapter continues...]" : plainText;

  const fp = extractVoiceFingerprint([cappedText]);
  const voiceConstraints = fp ? fingerprintToConstraints(fp) : "";
  const promiseLedger = projectId ? await buildPromiseLedger(projectId, "preserve") : "";
  const extra = [voiceConstraints, promiseLedger].filter(Boolean).join("\n\n");
  const system = surgicalEditSystemPrompt() + (extra ? `\n\n${extra}` : "");

  try {
    const msg = await client.messages.create({
      model: MODELS.default,
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: `Chapter:\n\n${cappedText}\n\nInstruction: ${instruction}` }],
    });

    const rawResult = msg.content
      .filter(b => b.type === "text")
      .map(b => (b as any).text)
      .join("");

    let parsed: { found: string; replacement: string; explanation: string };
    try {
      parsed = JSON.parse(rawResult);
    } catch {
      return NextResponse.json({ error: "Edit generation failed. Please try again." }, { status: 500 });
    }

    const { found, replacement, explanation } = parsed;

    if (!found) {
      return NextResponse.json({ error: "Could not locate the described passage." }, { status: 422 });
    }

    // Verify the found text is actually in the passage
    if (!plainText.includes(found)) {
      return NextResponse.json({ error: "Could not locate the described passage." }, { status: 422 });
    }

    // Replace first occurrence only
    const updatedPlainText = plainText.replace(found, replacement);
    const updatedJson = plainTextToTipTap(updatedPlainText);

    return NextResponse.json({ original: found, replacement, explanation, updatedJson });
  } catch (e: any) {
    await refundCredits(session.user.id, "prose");
    const msg = e?.message || "";
    if (msg.includes("rate_limit") || msg.includes("529"))
      return NextResponse.json({ error: "Anthropic rate limit hit. Wait a moment and try again." }, { status: 429 });
    return NextResponse.json({ error: "Edit generation failed. Please try again." }, { status: 500 });
  }
}
