import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const AGENT_MODELS: Record<string, string> = {
  story_architect:   "claude-haiku-4-5-20251001",
  scene_writer:      "claude-sonnet-4-20250514",
  character_voice:   "claude-sonnet-4-20250514",
  continuity_editor: "claude-sonnet-4-20250514",
  hook_writer:       "claude-sonnet-4-20250514",
  seo_optimizer:     "claude-haiku-4-5-20251001",
};

const AGENT_SYSTEM: Record<string, (ctx: string, fmt: string) => string> = {
  story_architect: (ctx, fmt) =>
    `You are a Story Architect. Output a numbered structural outline only — acts, beats, turning points. No prose. Format: ${fmt}.\nContext:\n${ctx}`,

  scene_writer: (ctx, fmt) =>
    `You are a Scene Writer. Turn the outline or prompt into vivid, grounded prose. Show don't tell. Sensory detail in every scene. Match ${fmt} conventions.\nContext:\n${ctx}`,

  character_voice: (ctx, fmt) =>
    `You are a Character Voice Specialist. Rewrite dialogue so each character sounds distinct. Reference character profiles from context. No exposition through dialogue.\nContext:\n${ctx}`,

  continuity_editor: (ctx, fmt) =>
    `You are a Continuity Editor. Find inconsistencies with established facts, character profiles, and timeline. Flag each issue then output the corrected version.\nContext:\n${ctx}`,

  hook_writer: (ctx, fmt) =>
    `You are a Hook Specialist for ${fmt}. YouTube/Podcast: open loop that demands resolution. TikTok/Shorts/Reels: first 3 words stop the scroll, no setup, no intro. Novel/Screenplay: first line makes stopping impossible. Output ONLY the hook.\nContext:\n${ctx}`,

  seo_optimizer: (ctx, _) =>
    `Output a structured SEO package with exactly these sections:\n1. TITLE OPTIONS (3 variants, ranked by CTR)\n2. DESCRIPTION (150 words, keyword-rich but natural)\n3. TAGS (15 tags)\n4. THUMBNAIL CONCEPT (one sentence)\nContext:\n${ctx}`,
};

export async function POST(req: Request) {
  await getRequiredSession();
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
        model: AGENT_MODELS[agentKey] || "claude-sonnet-4-20250514",
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
    if (controller.signal.aborted)
      return NextResponse.json({ error: "Pipeline timed out. Try a shorter prompt or fewer agents." }, { status: 504 });
    return NextResponse.json({ error: "Pipeline failed. Please try again." }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }

  return NextResponse.json({ results, finalOutput: results[results.length - 1]?.output ?? "" });
}
