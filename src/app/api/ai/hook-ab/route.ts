export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { db } from "@/db";
import { creatorBibles } from "@/db/schema";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/engine";
import { HOOK_STRATEGIST_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";

const anthropic = new Anthropic();

const HOOK_ARCHETYPES = [
  { name: "Curiosity Gap",      principle: "Loewenstein information gap — partial knowledge peaks curiosity more than zero knowledge",        example: "The one thing every [niche expert] gets wrong about [topic]" },
  { name: "Contrarian Claim",   principle: "Cognitive dissonance — challenges the viewer's existing model, demands resolution",               example: "Stop doing [common practice]. Here's why it's killing your results." },
  { name: "Story Open",         principle: "Narrative transportation — opens mid-scene, skips setup, reader is already in motion",            example: "I lost everything in 48 hours. This is what I did next." },
  { name: "Stat Shock",         principle: "Anchoring — specific unexpected number forces model-updating before the viewer can resist",        example: "94% of [audience] make this mistake. Are you one of them?" },
  { name: "Direct Challenge",   principle: "Identity threat — challenges the viewer's self-image as competent in this domain",                example: "If you can't answer this question, you're not as good at [skill] as you think." },
  { name: "Fear Trigger",       principle: "Loss aversion — Kahneman: losses weigh ~2x heavier than equivalent gains",                       example: "You're already losing [X] every month. Here's the proof." },
  { name: "Social Proof",       principle: "Cialdini: humans look to others' behaviour as information under uncertainty",                     example: "[Number] people changed [outcome] using this. Now you can too." },
  { name: "Personal Failure",   principle: "Vulnerability + specificity builds trust faster than expertise claims",                           example: "I failed at [thing] for 3 years. Here's the exact moment I understood why." },
  { name: "Prediction",         principle: "Future pacing — places viewer in a desired future state, creates present-moment tension",         example: "By the end of this video, you'll think about [topic] completely differently." },
  { name: "Tutorial Promise",   principle: "Explicit value contract — viewer knows exactly what they're getting, reduces decision friction",  example: "How to [achieve outcome] in [timeframe] — no [common obstacle] required." },
  { name: "Controversy Bait",   principle: "Opinion polarisation drives comment engagement which drives algorithmic distribution",             example: "[Respected figure/practice] is [strong claim]. I'll prove it." },
  { name: "Transformation",     principle: "Before/after framing — the most primal narrative structure",                                     example: "I went from [undesirable state] to [desirable state]. This is exactly how." },
] as const;

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const gate = await meterAndGate(session.user.id, "hook-ab");
  if (gate) return gate;
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "creator_tools_advanced")) {
    return NextResponse.json({ error: "upgrade_required", feature: "creator_tools_advanced" }, { status: 403 });
  }

  const { contentSummary, format, niche, channelVoice, projectId, mode } = await req.json();
  if (!contentSummary?.trim()) {
    return NextResponse.json({ error: "contentSummary required" }, { status: 400 });
  }

  let hookMemory: string[] = [];
  let bible: any = null;
  if (projectId) {
    bible = await db.query.creatorBibles.findFirst({ where: eq(creatorBibles.projectId, projectId) });
    hookMemory = (bible as any)?.hookMemory || [];
  }

  const recentArchetypes = hookMemory.slice(-10);
  const archetypeCounts: Record<string, number> = {};
  recentArchetypes.forEach(a => { archetypeCounts[a] = (archetypeCounts[a] || 0) + 1; });
  const overused = Object.entries(archetypeCounts)
    .filter(([, count]) => count >= 3)
    .map(([name]) => name);

  const archetypeList = HOOK_ARCHETYPES
    .map(a => `${a.name}: ${a.principle}. Example: "${a.example}"`)
    .join("\n");

  const isABMode = mode === "ab";
  const prompt = isABMode
    ? `Generate TWO hooks for the same content targeting OPPOSITE audience segments:
Hook A: viewer who wants to GAIN something (curiosity, aspiration, transformation)
Hook B: viewer who wants to AVOID something (loss, fear, mistake)

Content: ${contentSummary}
Format: ${format || "YouTube Long-form"}
${niche ? `Niche: ${niche}` : ""}
${channelVoice ? `Voice: ${channelVoice}` : ""}

Return ONLY valid JSON:
{
  "hookA": { "archetype": "archetype name", "hook": "exact text", "targetAudience": "description", "ctrScore": 7.5 },
  "hookB": { "archetype": "archetype name", "hook": "exact text", "targetAudience": "description", "ctrScore": 7.5 }
}`
    : `Generate 5 hooks using 5 DIFFERENT archetypes. Choose the 5 most effective for this content.
${overused.length > 0 ? `AVOID these overused archetypes: ${overused.join(", ")}` : ""}

ARCHETYPES:
${archetypeList}

Content: ${contentSummary}
Format: ${format || "YouTube Long-form"}
${niche ? `Niche: ${niche}` : ""}
${channelVoice ? `Voice: ${channelVoice}` : ""}

Return ONLY valid JSON:
{
  "hooks": [
    {
      "archetype": "archetype name",
      "hook": "exact hook text (under 125 characters)",
      "ctrScore": 7.5,
      "reasoning": "why this works for this specific content and niche",
      "targetEmotion": "curiosity | fear | surprise | desire | validation | ambition"
    }
  ],
  "overusedWarning": ${JSON.stringify(overused.length > 0 ? `You've used ${overused.join(", ")} heavily recently. These results avoid them.` : null)}
}`;

  try {
    const response = await anthropic.messages.create({
      model: MODELS.default,
      max_tokens: 1500,
      system: [{ type: "text", text: HOOK_STRATEGIST_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(raw.replace(/```json\n?|```/g, "").trim());
    } catch {
      await refundCredits(session.user.id, "hook-ab");
      return NextResponse.json({ error: "Failed to parse hook response" }, { status: 500 });
    }

    if (projectId && bible && !isABMode && parsed.hooks) {
      const newArchetypes = (parsed.hooks as any[]).map((h: any) => h.archetype).filter(Boolean);
      const updatedMemory = [...hookMemory, ...newArchetypes].slice(-20);
      await db.update(creatorBibles)
        .set({ hookMemory: updatedMemory } as any)
        .where(eq(creatorBibles.projectId, projectId));
    }

    return NextResponse.json(parsed);
  } catch (e: any) {
    await refundCredits(session.user.id, "hook-ab");
    return NextResponse.json({ error: e.message || "Hook generation failed." }, { status: 500 });
  }
}
