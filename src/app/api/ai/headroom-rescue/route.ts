export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { rescueSkippedSections } from "@/lib/ai/headroom-summarize";

// Headroom v3: buildStaticContext() runs client-side (see context-builder.ts),
// so when it drops sections to stay in budget, the client is the only place
// that still has their raw content. This route is the server-side leg the
// client calls to try to compress those dropped sections back in, since the
// actual model call (and its API key) must stay server-side. Not separately
// metered/credited — rides along under the credit already charged for the
// generation this is supporting, same convention as promise-ledger/voice-
// exemplars/scene-blueprint. checkAiRateLimit is the only abuse guard.
export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const { skipped, remainingBudgetTokens } = await req.json();
  if (!Array.isArray(skipped) || skipped.length === 0 || typeof remainingBudgetTokens !== "number") {
    return NextResponse.json({ rescued: "" });
  }

  try {
    const rescued = await rescueSkippedSections(skipped, remainingBudgetTokens);
    return NextResponse.json({ rescued });
  } catch {
    // Fail open: the caller already has a working (trimmed) static context —
    // a rescue failure should never block generation.
    return NextResponse.json({ rescued: "" });
  }
}
