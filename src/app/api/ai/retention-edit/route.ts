export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { anthropic } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/engine";
import { RETENTION_EDIT_SYSTEM_PROMPT } from "@/lib/roles/editor";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";


export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const gate = await meterAndGate(session.user.id, "retention-edit");
  if (gate) return gate;
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "creator_tools_advanced")) {
    return NextResponse.json({ error: "upgrade_required", feature: "creator_tools_advanced" }, { status: 403 });
  }

  const { script, format } = await req.json();
  if (!script?.trim() || !format) {
    return NextResponse.json({ error: "script and format required" }, { status: 400 });
  }

  try {
    const response = await anthropic.messages.create({
      model: MODELS.default,
      max_tokens: 2500,
      system: [{
        type: "text",
        text: RETENTION_EDIT_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      }],
      messages: [{
        role: "user",
        content: `Analyse this ${format} script using the 4-mechanic watch-time framework.

THE FOUR MECHANICS:
1. HOOK STRENGTH (first 30 seconds): Does the opening validate the title/thumbnail promise
   within 30 seconds? MrBeast rule: if the title says "1000 orbeez in a pool" — show the
   pool in the first frame. Delayed validation = immediate drop-off.
   Score 1-10: 1 = no validation, 10 = immediate compelling validation.

2. OPEN LOOP DENSITY (unresolved questions per minute that compel staying):
   "But what happened next..." / starting a numbered list and not completing it /
   "I'll show you the answer at the end." Optimal: 1 open loop per 60-90 seconds.
   Score 1-10: 1 = no open loops (nothing pulling forward), 10 = consistent loop creation.

3. PATTERN INTERRUPT FREQUENCY (format/pace/energy shifts every 60-90 seconds):
   Any change that produces novelty response: delivery mode shift, direct address,
   revelation that reframes what just happened, pace change, emotional register change.
   Score 1-10: 1 = unbroken monotone delivery, 10 = consistent rhythm of interrupts.

4. PAYOFF ARCHITECTURE (biggest payoff positioned at 75-85% through):
   The promised payoff should arrive at ~80%, not at the end (people leave before credits)
   and not at 50% (removes reason to stay). Score 1-10: 1 = payoff at end or missing,
   10 = payoff teased early, delivered at 75-85%.

SCRIPT:
${script}

Return JSON:
{
  "scores": {
    "hookStrength": { "score": 7, "reasoning": "string" },
    "openLoopDensity": { "score": 5, "reasoning": "string" },
    "patternInterruptFrequency": { "score": 4, "reasoning": "string" },
    "payoffArchitecture": { "score": 6, "reasoning": "string" },
    "overall": 5.5
  },
  "dropRiskMoments": [
    {
      "location": "quote up to 15 words from the script near the risk",
      "mechanic": "HOOK_STRENGTH | OPEN_LOOP | PATTERN_INTERRUPT | PAYOFF",
      "risk": "specific reason this moment will cause drop-off",
      "fix": "exact line or structural change to add — be specific, not generic"
    }
  ],
  "strongPoints": ["string"],
  "topPriority": "the single most important change to make first"
}`,
      }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
    try {
      return NextResponse.json({ edit: JSON.parse(raw.replace(/```json\n?|```/g, "").trim()) });
    } catch {
      await refundCredits(session.user.id, "retention-edit");
      return NextResponse.json({ error: "Failed to parse analysis" }, { status: 500 });
    }
  } catch (e: any) {
    await refundCredits(session.user.id, "retention-edit");
    return NextResponse.json({ error: e.message || "Retention edit analysis failed." }, { status: 500 });
  }
}
