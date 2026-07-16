import { anthropic } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/engine";

export interface PodcastTurn {
  speaker: "A" | "B";
  text: string;
}

// Real NotebookLM Audio Overview research (item 71): the "long, natural
// two-host discussion" effect doesn't come from a single long-context audio
// model call (that part — SoundStorm — genuinely isn't reachable via any
// TTS API this app has) — it comes from an LLM writing many SHORT
// conversational turns with backchannel interjections baked into the text
// itself, each turn synthesized independently. Confirmed against the
// open-source podcastfy project's actual <Person1>/<Person2> script format,
// which does exactly this with plain single-speaker TTS providers (including
// OpenAI TTS-1, the same provider this app already uses).
const SYSTEM_PROMPT = `You are writing a two-host discussion podcast script — think NotebookLM's "Audio Overview" — where Host A and Host B discuss a piece of fiction together, in a natural, engaged, conversational tone.

Rules:
- Alternate speakers naturally. Real conversation isn't strictly back-and-forth one line each — sometimes a host asks a short follow-up, sometimes the other host runs longer.
- Bake natural backchannel interjections INTO the text itself ("Right—", "Oh, interesting.", "Wait, really?", "Huh.") since these must be spoken by the TTS voice, not layered on separately.
- Keep each individual turn SHORT (1-3 sentences) — many short turns read far more naturally through TTS than a few long ones.
- Host A is curious and asks questions; Host B has read the material closely and explains, but neither is a narrator reciting the text — they're discussing it.
- Do not read the source text verbatim. Discuss and react to it.
- Open with a brief, natural cold-open (no "Welcome to the show" boilerplate) and close with a short, natural wrap-up line.
- Reply ONLY with valid JSON, no markdown fences, no commentary.`;

export async function generatePodcastScript(
  chapterContent: string,
  projectName: string
): Promise<PodcastTurn[]> {
  const userPrompt = `Project: ${projectName}

Source material for this episode:
${chapterContent.slice(0, 12000)}

Return a JSON array like this: Array<{ "speaker": "A" | "B", "text": string }>. Aim for a natural discussion covering the key beats — roughly 20-40 turns depending on the material's length.`;

  const response = await anthropic.messages.create({
    model: MODELS.default,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content.filter(b => b.type === "text").map(b => (b as any).text).join("") || "[]";
  const clean = text.replace(/```json\n?|```/g, "").trim();

  let turns: any;
  try {
    turns = JSON.parse(clean);
  } catch {
    throw new Error("Failed to parse podcast script response");
  }

  if (!Array.isArray(turns)) throw new Error("Podcast script response was not a JSON array");

  return turns
    .filter((t: any) => t && typeof t.text === "string" && t.text.trim() && (t.speaker === "A" || t.speaker === "B"))
    .map((t: any) => ({ speaker: t.speaker, text: t.text.trim() }));
}
