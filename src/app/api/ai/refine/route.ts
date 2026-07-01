export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
import { refinePassage } from "@/lib/ai/engine";
import { extractVoiceFingerprint, fingerprintToConstraints } from "@/lib/ai/voice-fingerprint";
import { buildPromiseLedger } from "@/lib/ai/promise-ledger";
import { db } from "@/db";
import { generations } from "@/db/schema";
import { track } from "@/lib/analytics";

// Polish-pass Critic-Editor endpoint. Gated like /generate but metered at the
// cheaper "refine" weight (0.5 credits) since it revises existing prose
// rather than generating new content from scratch.
export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const { text, format, projectId, chapterId } = await req.json();
  if (!text?.trim() || text.trim().length < 40) {
    return NextResponse.json({ error: "Write a bit more before polishing." }, { status: 400 });
  }

  const gate = await meterAndGate(session.user.id, "refine");
  if (gate) return gate;

  const fp = extractVoiceFingerprint([text]);
  const voiceConstraints = fp ? fingerprintToConstraints(fp) : "";
  const promiseLedger = projectId ? await buildPromiseLedger(projectId, "preserve") : "";
  const extraContext = [voiceConstraints, promiseLedger].filter(Boolean).join("\n\n");

  try {
    const r = await refinePassage(text, format || "Novel", extraContext);
    await db.insert(generations).values({
      projectId: projectId || null, chapterId: chapterId || null,
      mode: "refine", prompt: "polish", output: r.text, model: r.model, tokensUsed: r.tokensUsed,
    });
    await track(session.user.id, 'ai_generation', { mode: 'refine', format: format ?? '' });
    return NextResponse.json(r);
  } catch (e: any) {
    await refundCredits(session.user.id, "refine");
    console.error(`[refine] ${e?.status} ${(e?.message || '').slice(0, 200)}`);
    return NextResponse.json({ error: "Polish failed. Please try again." }, { status: 500 });
  }
}
