import Anthropic from "@anthropic-ai/sdk";

// A fast "planner" pre-pass (Haiku). Turns the writer's next-scene request +
// story context into a tight, concrete scene blueprint that is injected into the
// Write prompt. Research (eqbench longform, SNAP) shows explicit scene-level
// planning is the single biggest lever against generic, filler-y prose.
// Fail-open: this must NEVER block or slow generation on error.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function buildSceneBlueprint(params: {
  prompt: string;
  staticContext?: string;
  dynamicContext?: string;
  format: string;
}): Promise<string> {
  const { prompt, staticContext = "", dynamicContext = "", format } = params;
  try {
    const ctx = (staticContext + "\n" + dynamicContext).slice(0, 6000);
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 350,
      system: `You are a scene architect for ${format} fiction. Given the story context and the writer's next-scene request, produce a TIGHT scene blueprint. Do NOT write prose. Be concrete and specific to THIS story — use names, places, and facts from the context, never generic placeholders. Output exactly these labeled lines and nothing else:
GOAL: <what the POV character actively wants in this scene>
OBSTACLE: <what concretely blocks them>
TURN: <the reversal or escalation that happens mid-scene>
CHANGE: <how the story state is measurably different by the scene's end>
SENSORY: <three concrete, non-generic sensory anchors specific to this setting, comma-separated>
EXIT: <the kind of beat to end on — a decision, a charged image, or an unanswered question>`,
      messages: [{ role: "user", content: `STORY CONTEXT:\n${ctx}\n\nNEXT SCENE REQUEST:\n${prompt}` }],
    });
    const text = msg.content.filter((b) => b.type === "text").map((b) => (b as any).text).join("").trim();
    if (text.length < 30) return "";
    return `SCENE BLUEPRINT — write the scene to fulfill this. Do NOT print these labels or list them in the prose; embed them dramatically:\n${text}`;
  } catch {
    return "";
  }
}
