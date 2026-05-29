import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function safeParseJson(raw: string) {
  const clean = raw.replace(/```json\n?|```/g, "").trim();
  try { return JSON.parse(clean); } catch { return null; }
}

const sensoryDirectives: Record<string, string> = {
  horror: "Expand using: olfactory decay (what does wrong smell like?), auditory wrongness (the sound that should not be there), tactile temperature drop.",
  romance: "Expand using: thermal sensation (warmth proximity), tactile awareness (clothing against skin, the nearness of another body), interoceptive signals (pulse, breath rate).",
  action: "Expand using: proprioceptive kinesthesia (where the body is in space, the specific muscle firing), auditory shock (the sound arriving before the pain).",
  atmosphere: "Expand using: olfactory first (smell before sight — smell bypasses cortical analysis), then sound, then the quality of light.",
  setting: "Expand using: the Proust Effect — what does this specific place smell like, and what involuntary memory does that smell trigger?",
};

function buildExpandSystem(activeMode?: string): string {
  const modeDirective = activeMode && sensoryDirectives[activeMode]
    ? `ACTIVE LIBRARY MODE — ${activeMode.toUpperCase()}:\n${sensoryDirectives[activeMode]}\n\n`
    : "";
  return `You are expanding this prose with sensory and physical depth.

${modeDirective}CHRISTENSEN'S CUMULATIVE SENTENCE:
Take the base clause. Add 3-5 free modifiers (participial phrases, absolute phrases, appositives).
Each free modifier must name a specific observable action or sensation. No abstract characterizations.
Example: "She stood at the door" → "She stood at the door, her hand flat against the wood, feeling the grain under her palm, the cold coming through in slow pulses, her breath gone quiet."

Add sensory specificity. Add physical grounding. Every addition must be observable.

Do not change what happens — only enrich it. Return ONLY the expanded text. No explanation, no preamble.
World context for characters and locations present:`;
}

const SHOW_DONT_TELL_SYSTEM = `You are upgrading prose from telling to showing.

THE SIMULATION HIERARCHY (Gallese mirror neuron research):
Ranked from highest to lowest reader simulation response:
1. Physical action + specific sensation — highest (motor + interoceptive systems activate)
2. Physical action alone — high
3. Described emotional state with physical correlate ("her stomach dropped") — moderate
4. Named emotional state ("she was frightened") — low
5. Abstract characterization ("she was a frightened person") — minimal

Your task: move every named emotional state up the hierarchy.
Replace the named state with its embodied specificity.
"She was sad" → what is the body doing when sad? Eyes stay down. Chest contracts. Breath becomes shallow. The fork moves food around the plate.
Never name the emotion. Write the body.

Return ONLY the rewritten text. No explanation.
Character and location context:`;

const SUBTEXT_SYSTEM = `You are a subtext analyser and dialogue coach grounded in Pinter's silence architecture and Hemingway's iceberg principle.

HEMINGWAY'S ICEBERG DIAGNOSTIC:
The most important thing in a scene is what is never directly spoken. Identify:
- The word, name, feeling, or fact that every line is organized around avoiding
- If you cannot identify the centre of gravity — there is no iceberg. The dialogue is surface only.

FIVE SUBTEXT PRODUCTION METHODS (Pinter):
1. Deflection: answers a related but different subject
2. Displacement: the argument is nominally about something trivial but emotionally organized around what cannot be named
3. Excessive precision: the over-specific answer reveals what is really being asked
4. Apparent non-sequitur: emotionally connected, logically disconnected
5. Conspicuous absence: what is not said when it obviously should be

Identify the iceberg centre, the flattest line in the dialogue, then provide three rewrites of that line using three different subtext methods.

Return JSON:
{
  "icebergCentre": "what every line avoids saying directly",
  "flattestLine": "the line with the least subtext",
  "rewrites": [
    { "method": "method name", "rewrite": "the rewritten line" },
    { "method": "method name", "rewrite": "the rewritten line" },
    { "method": "method name", "rewrite": "the rewritten line" }
  ]
}`;

const TIGHTEN_SYSTEM = `You are cutting this prose to its essential meaning.

THE ANGLO-SAXON/LATINATE RULE:
Anglo-Saxon words: short, concrete, bodily, direct — blood, bone, fear, home, die, cry, hard, cold, now.
Latinate words: long, abstract, formal, institutional — emotion, residence, terminate, difficulty, comprehend.
At the emotional peak: use Anglo-Saxon monosyllables. Register shift signals importance.
Elsewhere: cut, don't switch register arbitrarily.

FOUR CUTS in order:
1. Adverbs modifying strong verbs (she ran quickly → she sprinted)
2. Redundant attribution (he thought to himself → he thought)
3. Throat-clearing openers (It was the case that → cut entirely)
4. Latinate abstractions at emotional moments (she experienced profound sadness → she couldn't breathe)

Cut to the bone. Every word must earn its place.
Do not change the events, tone, or voice — only eliminate what is unnecessary. Target 40-60% of the original length. Return ONLY the tightened text.
Context:`;

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;
  const { text, mode, projectContext, activeMode } = await req.json();

  if (!text?.trim() || !mode)
    return NextResponse.json({ error: "text and mode required" }, { status: 400 });

  const validModes = ["expand", "rewrite", "show-dont-tell", "tighten", "subtext"];
  if (!validModes.includes(mode))
    return NextResponse.json({ error: "invalid mode" }, { status: 400 });

  const ctx = projectContext || "";

  let systemPrompt: string;
  if (mode === "expand") {
    systemPrompt = buildExpandSystem(activeMode) + "\n" + ctx;
  } else if (mode === "show-dont-tell") {
    systemPrompt = SHOW_DONT_TELL_SYSTEM + "\n" + ctx;
  } else if (mode === "tighten") {
    systemPrompt = TIGHTEN_SYSTEM + "\n" + ctx;
  } else if (mode === "subtext") {
    systemPrompt = SUBTEXT_SYSTEM;
  } else {
    systemPrompt = `You are a prose rewriter. Generate EXACTLY 5 different rewrites of the given text. Each rewrite should vary in tone, rhythm, or stylistic approach while preserving the same events and meaning. Return as a JSON array of 5 strings: ["rewrite1","rewrite2","rewrite3","rewrite4","rewrite5"]. No markdown fences, no explanation, only the JSON array.\nWorld context:\n${ctx}`;
  }

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: text }],
    });

    const raw = msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("");

    if (mode === "rewrite") {
      const variants = safeParseJson(raw);
      return NextResponse.json({ variants: Array.isArray(variants) ? variants : [raw] });
    }

    if (mode === "subtext") {
      const parsed = safeParseJson(raw);
      return NextResponse.json(parsed ?? { result: raw });
    }

    return NextResponse.json({ result: raw });
  } catch (e: any) {
    const msg = e?.message || "";
    if (msg.includes("rate_limit") || msg.includes("529"))
      return NextResponse.json({ error: "Anthropic rate limit hit. Wait a moment and try again." }, { status: 429 });
    return NextResponse.json({ error: "Prose tool failed. Please try again." }, { status: 500 });
  }
}
