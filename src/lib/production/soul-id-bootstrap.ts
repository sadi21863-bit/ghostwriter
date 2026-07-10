// Bootstraps real Soul ID training for a character generate-package just
// created, closing the gap between the Director flow and this codebase's
// already-existing (but manual, WorldBiblePanel-only) Soul ID training
// capability (item 39). Real Soul ID training needs >=3 reference PHOTOS
// (src/app/api/projects/[projectId]/characters/[characterId]/soul-id/route.ts),
// which a freshly-created character has none of - only a text soulIdPrompt.
// This generates a small number of quick Soul images from that text first,
// to use as the training references, mirroring how Higgsfield's own real
// production teams bootstrap a new character (per live research into their
// "Arena Zero" pipeline: "run the same base prompt across multiple
// generations until the right bone structure, eyes, and presence are
// found," then lock via Soul ID/Soul Cast).
//
// Deliberately fails open at every step (matches this codebase's other
// fire-and-forget helpers, e.g. buildPromiseLedger, updateChapterEmbedding)
// — a bootstrap failure never blocks or errors the caller; the character
// simply falls back to the existing text-lock consistency mechanism via
// getCharacterSoulReference().
import { generateSoulImage, trainSoulId } from "@/lib/higgsfield/client";

const BOOTSTRAP_IMAGE_COUNT = 3;

export interface SoulIdBootstrapParams {
  characterName: string;
  soulIdPrompt: string;
  segmindApiKey: string;
  higgsfieldApiKey: string;
  higgsfieldApiSecret: string;
}

/** Generates a handful of quick reference images from a character's text
 *  description, then kicks off real Soul ID training on them. Returns the
 *  pending job id, or null if any prerequisite is missing or any step fails. */
export async function bootstrapAndTrainSoulId(params: SoulIdBootstrapParams): Promise<string | null> {
  if (!params.segmindApiKey || !params.higgsfieldApiKey || !params.higgsfieldApiSecret) return null;
  if (!params.soulIdPrompt?.trim()) return null;

  try {
    const imageUrls: string[] = [];
    for (let i = 0; i < BOOTSTRAP_IMAGE_COUNT; i++) {
      try {
        const url = await generateSoulImage({
          apiKey: params.segmindApiKey,
          prompt: params.soulIdPrompt,
          seed: Math.floor(Math.random() * 999_999),
        });
        imageUrls.push(url);
      } catch (e: any) {
        console.warn(`[soul-id-bootstrap] reference image ${i + 1}/${BOOTSTRAP_IMAGE_COUNT} failed for ${params.characterName}: ${e?.message}`);
      }
    }
    if (imageUrls.length < 3) {
      console.warn(`[soul-id-bootstrap] only ${imageUrls.length}/3 reference images succeeded for ${params.characterName} - skipping training`);
      return null;
    }

    const { jobId } = await trainSoulId({
      apiKey: params.higgsfieldApiKey,
      apiSecret: params.higgsfieldApiSecret,
      characterName: params.characterName,
      referenceImageUrls: imageUrls,
    });
    return jobId;
  } catch (e: any) {
    console.warn(`[soul-id-bootstrap] training kickoff failed for ${params.characterName}: ${e?.message}`);
    return null;
  }
}
