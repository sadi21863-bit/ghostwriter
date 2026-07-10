// Phase B of docs/2026-06-25-ai-director-editor-production-studio-gap-analysis.md
// — the vision-critique data source that src/lib/production/self-eval.ts's
// scoreShot()/nextLoopAction() have always needed but never had. Popcorn/
// PixelFlow (the alternative considered) has no standalone documented API
// endpoint, so this is built directly on Claude's own multimodal input,
// which GhostWriter already has full access to.
//
// This module only produces scores — it never decides accept/retry/stop
// (that's self-eval.ts) and never spends on regeneration itself.

import Anthropic from "@anthropic-ai/sdk";
import { anthropic as client } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/engine";
import type { EvalDimensions } from "./self-eval";


const CRITIC_SYSTEM_PROMPT = `You are a film/comic-panel quality critic. You are shown a generated image and told what it was supposed to depict. Score it honestly on each dimension below, 0.0 (fails completely) to 1.0 (perfect).

promptAdherence: does the image match the requested subject/action/setting?
characterConsistency: if a reference character image is provided, does the generated character match it (face, hair, build, clothing)? If no reference image is provided, score based on internal consistency only. If the character's face is not legible for any deliberate compositional reason — an intentional close-up/insert on a hand or object, a backlit or shadowed silhouette, deep shadow, obscured by framing — score 1.0. There is nothing to compare against, so an intentionally illegible face is not itself an inconsistency. Only score this down when a face IS visible and it looks inconsistent.
continuity: if a previous-shot image is provided, do lighting, location and time-of-day read as one continuous sequence with it? If no previous shot is provided, score 1.0 (nothing to break continuity with).
technicalQuality: is the rendering free of artifacts, anatomy errors, garbled text?
pacing: does the composition suit its likely shot duration (nothing critical crammed into a corner, nothing static that needed motion)?
coverage: does the image actually depict the intended story beat, not just a generic version of the setting?
aesthetics: overall visual/compositional polish.

Return ONLY valid JSON with these exact keys, each a number 0.0-1.0:
{"promptAdherence": 0.0, "characterConsistency": 0.0, "continuity": 0.0, "technicalQuality": 0.0, "pacing": 0.0, "coverage": 0.0, "aesthetics": 0.0}`;

export interface CritiqueInput {
  imageUrl: string;
  prompt: string;
  referenceImageUrl?: string;
  previousShotImageUrl?: string;
}

function safeParseScores(raw: string): Partial<EvalDimensions> {
  // Extract just the {...} object rather than parsing the whole cleaned
  // string: despite "Return ONLY valid JSON", the model sometimes appends
  // prose after the object (e.g. a "Brief Assessment" section) — a strict
  // whole-string JSON.parse fails on that trailing text and silently
  // returns {} (all-zero scores) with no error, since this is deliberately
  // fail-open. The dims are flat (no nested objects), so a single non-greedy
  // {...} match is safe.
  const match = raw.match(/\{[^{}]*\}/);
  if (!match) {
    console.warn(`[critiqueShot] no JSON object found in response: ${raw.slice(0, 200)}`);
    return {};
  }
  try {
    const parsed = JSON.parse(match[0]);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    console.warn(`[critiqueShot] failed to parse extracted JSON: ${match[0].slice(0, 200)}`);
    return {};
  }
}

/**
 * Score a generated shot/panel image against its prompt and (optionally) its
 * character reference and the previous shot in the sequence. Fails open —
 * returns {} on any parse or API failure rather than throwing, matching this
 * codebase's other RAG/context helpers (buildPromiseLedger, buildVoiceExemplars).
 */
export async function critiqueShot(input: CritiqueInput): Promise<Partial<EvalDimensions>> {
  const imageBlocks: Anthropic.ImageBlockParam[] = [
    { type: "image", source: { type: "url", url: input.imageUrl } },
  ];
  if (input.referenceImageUrl) {
    imageBlocks.push({ type: "image", source: { type: "url", url: input.referenceImageUrl } });
  }
  if (input.previousShotImageUrl) {
    imageBlocks.push({ type: "image", source: { type: "url", url: input.previousShotImageUrl } });
  }

  const labelLines = ["Image 1: the generated shot to score."];
  if (input.referenceImageUrl) labelLines.push("Image 2: the character reference portrait.");
  if (input.previousShotImageUrl) labelLines.push(`Image ${imageBlocks.length}: the previous shot in the sequence.`);

  try {
    const msg = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 300,
      system: CRITIC_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: [
          ...imageBlocks,
          { type: "text", text: `${labelLines.join("\n")}\n\nWhat the shot was supposed to depict: ${input.prompt}` },
        ],
      }],
    });
    const text = msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("");
    return safeParseScores(text);
  } catch (e: any) {
    console.error(`[critiqueShot] ${e?.status ?? ""} ${(e?.message || "").slice(0, 200)}`);
    return {};
  }
}
