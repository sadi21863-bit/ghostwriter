import { anthropic } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/engine";

// Real bug this replaces (item 71/72 research, ViMax's NovelCompressor pattern
// adapted): several call sites silently truncated chapter content with plain
// `.slice(0, N)` before sending it to an LLM - content past the cutoff was
// just dropped, with no signal to the model that anything was missing. For
// src/lib/ai/engine.ts's chapter-memory-extraction (`keyEvents`/
// `openPromisesCreated`/`knowledgeShifts`, feeding StoryMemory/Promise
// Tracker) this is a real, quiet correctness bug: a promise made past the
// truncation point in a longer chapter would never get tracked.
//
// Simplified from ViMax's own two-stage compress-then-aggregate: ViMax's
// splitter cuts at arbitrary character boundaries, so it needs a second LLM
// pass to resolve overlapping content reworded differently at each boundary.
// Splitting on paragraph breaks instead (real chapter prose already has them)
// means chunks never overlap, so there's nothing to reconcile - one
// compression pass per chunk, then a plain join. One fewer LLM call for the
// same problem.
export async function compressForContext(
  text: string,
  targetChunkChars = 6000,
): Promise<string> {
  if (text.length <= targetChunkChars) return text;

  const chunks = chunkByParagraphs(text, targetChunkChars);
  const compressed = await Promise.all(chunks.map(compressChunk));
  return compressed.join("\n\n");
}

function chunkByParagraphs(text: string, targetChunkChars: number): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current && (current.length + para.length + 2) > targetChunkChars) {
      chunks.push(current);
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current) chunks.push(current);

  return chunks;
}

const COMPRESS_SYSTEM_PROMPT = `You are an expert text compression assistant specialized in literary content. Condense the provided story excerpt while preserving core narrative elements, key details, character development, and plot coherence.

Guidelines:
- Absolutely preserve all major plot points, twists, revelations, decisions, and the sequence of key events. Do not omit crucial story elements.
- Maintain character actions and development. Dialogue that reveals plot or character can be condensed or paraphrased, but its meaning must be kept intact.
- Reduce lengthy descriptions of settings or objects to their most essential elements.
- Condense extended internal monologue to the key realizations or decisions it leads to.
- Use direct, concise language. Combine sentences, cut redundant adverbs and repetitive phrasing.
- Produce a seamless passage, not a fragmented list of events.
- Reply with ONLY the compressed text — no preamble, no commentary, no markdown fences.`;

async function compressChunk(chunk: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODELS.fast,
    max_tokens: Math.min(4000, Math.ceil(chunk.length / 2)),
    system: COMPRESS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: chunk }],
  });
  const text = response.content.filter(b => b.type === "text").map(b => (b as any).text).join("");
  return text.trim() || chunk;
}
