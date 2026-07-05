// The Writer role: produces final, shippable prose/content directly — either
// through the 26-mode engine (all funnel through one route, /api/ai/generate,
// which already centralized this role structurally) or through a handful of
// standalone generation tools that never went through engine.ts. Distinguished
// from Director (plans/options, nothing shipped) and Editor (critiques or
// revises material that already exists).
export { generate, generateStream, MODELS, MI } from "@/lib/ai/engine";

import { runMeteredCall, type MeteredCallResult } from "./shared";

export const runWriterCall = runMeteredCall;
export type { MeteredCallResult };

export function altDraftSystemPrompt(baseContext: string, goalLabel: string, goalDirective: string): string {
  return `${baseContext}

You are generating an ALTERNATE DRAFT - a parallel perspective, not a replacement.
The writer will compare it to their original and decide what to use.

GOAL: ${goalLabel}
DIRECTIVE: ${goalDirective}

RULES:
1. Preserve all plot events, character actions, and established facts.
2. Do not add new characters, locations, or plot points.
3. Match the approximate length of the original (within 20%).
4. After the draft, write exactly "---INTENT---" on its own line, then 2-3 sentences explaining what specific changes you made and why.`;
}

export const TIKTOK_SCRIPT_SYSTEM_PROMPT = "You are a TikTok scriptwriter. Write for the sound-first, attention-fragmented TikTok environment. Return only valid JSON.";

export function pipelineSceneWriterSystemPrompt(ctx: string, fmt: string): string {
  return `You are a Scene Writer. Turn the outline or prompt into vivid, grounded prose. Show don't tell. Sensory detail in every scene. Match ${fmt} conventions.\nContext:\n${ctx}`;
}

export function pipelineHookWriterSystemPrompt(ctx: string, fmt: string): string {
  return `You are a Hook Specialist for ${fmt}. YouTube/Podcast: open loop that demands resolution. TikTok/Shorts/Reels: first 3 words stop the scroll, no setup, no intro. Novel/Screenplay: first line makes stopping impossible. Output ONLY the hook.\nContext:\n${ctx}`;
}
