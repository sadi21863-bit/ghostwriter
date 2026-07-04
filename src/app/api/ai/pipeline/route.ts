export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { meterAndGate, refundCredits } from "@/lib/metering/meter";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { anthropic as client } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/engine";
import {
  pipelineStoryArchitectSystemPrompt,
  pipelineSceneWriterSystemPrompt,
  pipelineCharacterVoiceSystemPrompt,
  pipelineContinuityEditorSystemPrompt,
  pipelineHookWriterSystemPrompt,
  pipelineSeoOptimizerSystemPrompt,
} from "@/lib/ai/prompts";


const AGENT_MODELS: Record<string, string> = {
  story_architect:   MODELS.fast,
  scene_writer:      MODELS.default,
  character_voice:   MODELS.default,
  continuity_editor: MODELS.default,
  hook_writer:       MODELS.default,
  seo_optimizer:     MODELS.fast,
};

const AGENT_SYSTEM: Record<string, (ctx: string, fmt: string) => string> = {
  story_architect: pipelineStoryArchitectSystemPrompt,

  scene_writer: pipelineSceneWriterSystemPrompt,

  character_voice: pipelineCharacterVoiceSystemPrompt,

  continuity_editor: pipelineContinuityEditorSystemPrompt,

  hook_writer: pipelineHookWriterSystemPrompt,

  seo_optimizer: pipelineSeoOptimizerSystemPrompt,
};

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const gate = await meterAndGate(session.user.id, "pipeline");
  if (gate) return gate;
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, 'story_modes_advanced')) {
    return NextResponse.json({ error: 'upgrade_required', feature: 'pipeline' }, { status: 403 });
  }
  const { agents, prompt, context, format } = await req.json();

  if (!agents?.length || !prompt)
    return NextResponse.json({ error: "agents and prompt required" }, { status: 400 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  const results: { agent: string; output: string }[] = [];
  let currentInput = prompt;
  let accumulatedContext = context || "";

  try {
    for (const agentKey of agents as string[]) {
      const systemFn = AGENT_SYSTEM[agentKey];
      if (!systemFn) continue;

      const msg = await client.messages.create({
        model: AGENT_MODELS[agentKey] || MODELS.default,
        max_tokens: 2000,
        system: systemFn(accumulatedContext, format || ""),
        messages: [{ role: "user", content: currentInput }],
      });

      const output = msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("");
      results.push({ agent: agentKey, output });
      accumulatedContext = accumulatedContext + "\n\nPREVIOUS AGENT OUTPUT (" + agentKey + "):\n" + output;
      currentInput = output;
    }
  } catch (e: any) {
    await refundCredits(session.user.id, "pipeline");
    if (controller.signal.aborted)
      return NextResponse.json({ error: "Pipeline timed out. Try a shorter prompt or fewer agents." }, { status: 504 });
    return NextResponse.json({ error: "Pipeline failed. Please try again." }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }

  return NextResponse.json({ results, finalOutput: results[results.length - 1]?.output ?? "" });
}
