// Best-of-N candidate selection (item 71/72 research, adapted from ViMax's
// best_image_selector.py) — an alternative consistency mechanism to the
// existing generate-then-score-then-maybe-retry loop in self-eval.ts, which
// item 70 found has zero real callers (built, tested, never wired up).
// Deliberately does NOT touch that machinery: this is a separate, opt-in
// path a caller reaches for explicitly, not a replacement.
//
// The tradeoff, stated plainly: N parallel generations cost more upfront
// than one generation + a maybe-retry, but guarantee a real side-by-side
// comparison against the reference image rather than a single shot's own
// isolated self-score. Never auto-selected — a caller must explicitly ask
// for this.

import Anthropic from "@anthropic-ai/sdk";
import { anthropic as client } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/engine";
import { generateSoulImage } from "@/lib/higgsfield/client";

export interface BestOfNParams {
  apiKey: string;
  prompt: string;
  referenceImageUrl?: string;
  soulId?: string;
  /** How many candidates to generate in parallel. Default 3, matching
   *  ViMax's own real-world convention. */
  n?: number;
}

export interface BestOfNResult {
  bestImageUrl: string;
  candidateUrls: string[];
  reason: string;
}

/**
 * Generates N candidate images in parallel, then picks the best one via a
 * single comparative vision call (all candidates shown side-by-side against
 * the reference, not scored independently). Fails open at every stage:
 * a candidate generation failure just shrinks the field (as long as at
 * least one succeeds); a selection-call failure defaults to the first
 * successful candidate rather than losing the whole batch.
 */
export async function generateBestOfN(params: BestOfNParams): Promise<BestOfNResult> {
  const n = Math.max(1, params.n ?? 3);

  const settled = await Promise.allSettled(
    Array.from({ length: n }, () => generateSoulImage({
      apiKey: params.apiKey,
      prompt: params.prompt,
      referenceImageUrl: params.referenceImageUrl,
      soulId: params.soulId,
    }))
  );
  const candidateUrls = settled
    .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
    .map(r => r.value);

  if (candidateUrls.length === 0) {
    throw new Error("Best-of-N generation failed: all candidate generations failed.");
  }
  if (candidateUrls.length === 1) {
    return { bestImageUrl: candidateUrls[0], candidateUrls, reason: "Only one candidate generated successfully — nothing to compare." };
  }

  const { index, reason } = await selectBestCandidate({
    referenceImageUrl: params.referenceImageUrl,
    targetDescription: params.prompt,
    candidateUrls,
  });
  return { bestImageUrl: candidateUrls[index] ?? candidateUrls[0], candidateUrls, reason };
}

const SELECT_SYSTEM_PROMPT = `You are a professional visual assessment expert. You are shown a reference image (if provided) and several candidate images, plus a text description of what the candidates were meant to depict. Identify which candidate performs best on:

- Character consistency: if a reference image is provided, do the character's features (gender, ethnicity, age, facial features, build, hairstyle, clothing) match it? If no reference is provided, judge internal plausibility only.
- Description accuracy: does the candidate actually depict what the target description asks for?
- Technical quality: free of artifacts, anatomy errors, garbled text, stray borders.

If multiple candidates are close, pick the one with the highest overall quality. If none are ideal, pick the least-bad one and say why in the reason.

Return ONLY valid JSON: {"best_index": 0, "reason": "one sentence"}`;

async function selectBestCandidate(params: {
  referenceImageUrl?: string;
  targetDescription: string;
  candidateUrls: string[];
}): Promise<{ index: number; reason: string }> {
  const imageBlocks: Anthropic.ImageBlockParam[] = [];
  const labelLines: string[] = [];

  if (params.referenceImageUrl) {
    imageBlocks.push({ type: "image", source: { type: "url", url: params.referenceImageUrl } });
    labelLines.push("Image 1: reference image.");
  }
  params.candidateUrls.forEach((url, i) => {
    imageBlocks.push({ type: "image", source: { type: "url", url } });
    labelLines.push(`Image ${imageBlocks.length}: candidate ${i} (best_index ${i}).`);
  });

  try {
    const msg = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 300,
      system: SELECT_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: [
          ...imageBlocks,
          { type: "text", text: `${labelLines.join("\n")}\n\nTarget description: ${params.targetDescription}` },
        ],
      }],
    });
    const text = msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("");
    const match = text.match(/\{[^{}]*\}/);
    if (!match) return { index: 0, reason: "Selection response had no parseable JSON — defaulted to the first candidate." };

    const parsed = JSON.parse(match[0]);
    const idx = parsed?.best_index;
    if (typeof idx !== "number" || idx < 0 || idx >= params.candidateUrls.length) {
      return { index: 0, reason: "Selection response had an invalid best_index — defaulted to the first candidate." };
    }
    return { index: idx, reason: typeof parsed?.reason === "string" ? parsed.reason : "" };
  } catch (e: any) {
    console.error(`[selectBestCandidate] ${e?.status ?? ""} ${(e?.message || "").slice(0, 200)}`);
    return { index: 0, reason: "Selection call failed — defaulted to the first candidate." };
  }
}
