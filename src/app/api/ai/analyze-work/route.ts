export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { analyzeWork } from "@/lib/ai/engine";
export async function POST(req: NextRequest){
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const gate = await meterAndGate(session.user.id, "analyze-work");
  if (gate) return gate;
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "style_dna")) {
    return NextResponse.json({ error: "upgrade_required", feature: "style_dna" }, { status: 403 });
  }
  const { title } = await req.json();
  try {
    return NextResponse.json({ attributes: await analyzeWork(title) });
  } catch (e: any) {
    await refundCredits(session.user.id, "analyze-work");
    return NextResponse.json({ error: "Work analysis failed. Please try again." }, { status: 500 });
  }
}