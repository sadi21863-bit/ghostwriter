import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit, freeGenerationLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { GATED_MODES } from "@/types/subscription";
import { generate } from "@/lib/ai/engine";
import { db } from "@/db";
import { generations } from "@/db/schema";

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const { mode, prompt, context, format, projectId, chapterId } = await req.json();

  if (!prompt?.trim()) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  if (!mode) return NextResponse.json({ error: "Mode is required" }, { status: 400 });

  // Tier check: mode-gated features (dialogue, combat, emotional, atmosphere, tension, composition)
  const tier = await getUserTier(session.user.id);
  const gatedFeature = GATED_MODES[mode as string];
  if (gatedFeature && !canAccessFeature(tier, gatedFeature)) {
    return NextResponse.json({ error: "upgrade_required", feature: gatedFeature, tier }, { status: 403 });
  }

  // Daily limit: free tier gets 10 generations/day
  if (tier === "free" && freeGenerationLimit) {
    const { success } = await freeGenerationLimit.limit(session.user.id);
    if (!success) {
      return NextResponse.json({
        error: "upgrade_required",
        feature: "unlimited_generations",
        tier,
        message: "Free tier limit: 10 generations per day. Upgrade for unlimited.",
      }, { status: 429 });
    }
  }

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
