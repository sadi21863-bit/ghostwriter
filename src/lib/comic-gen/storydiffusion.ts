// Pure helpers for Segmind's StoryDiffusion model — a sequence-aware comic model
// that keeps ONE character identity consistent across a whole multi-panel
// `comic_description` in a single call (vs N independent generateSoulImage calls).
//
// Contract researched from segmind.com/models/storydiffusion/api + the Segmind
// StoryDiffusion blog (2026-06-30), NOT guessed. Endpoint /v2/storydiffusion.
//
// Research findings that shape this code:
// - `comic_style` sets frame count: "Four Pannel" = 4 frames, "Classic Comic
//   Style" = 8 frames. So it's an ALL-IN-ONE strategy — one call returns a single
//   COMPOSED comic-strip page image (panels + layout together), not N raw panels.
//   That's a different philosophy from the per-panel + our-own-composite path, so
//   StoryDiffusion is wired OPT-IN and its result is stored as a page image.
// - The model CAN bake captions onto frames; we deliberately pass NO `#` captions
//   so no in-image text is added (lettering stays the separate B1 stage). Whether
//   it adds incidental text anyway is the one thing the real validation call must
//   confirm.
import type { ArtStyle } from "@/lib/ai/panel-prompt-builder";
import { ANATOMY_NEGATIVE_PROMPT } from "@/lib/ai/image-quality";

// ART_STYLES.id → StoryDiffusion style_name (the model's fixed option list).
export const STORYDIFFUSION_STYLE_BY_ART: Record<string, string> = {
  manga:         "Japanese Anime",
  manhwa:        "Japanese Anime",
  anime:         "Japanese Anime",
  western:       "Comic book",
  graphic_novel: "Comic book",
  cartoon:       "Comic book",
  noir:          "Line art",
  watercolor:    "(No style)",
};

export function storyDiffusionStyleFor(artStyle: Pick<ArtStyle, "id">): string {
  return STORYDIFFUSION_STYLE_BY_ART[artStyle.id] ?? "Comic book";
}

export interface ComicDescriptionPanel {
  action: string;
  /** False → the panel has no character; the [NC] flag is prepended so the model
   *  renders a character-free establishing/object shot. */
  hasCharacter: boolean;
}

/** Build StoryDiffusion's line-per-panel `comic_description`. Each line is one
 *  panel; `[NC]` marks character-free panels. No `#` captions — lettering is the
 *  separate B1 stage, so we never bake text into the image. */
export function buildComicDescription(panels: ComicDescriptionPanel[]): string {
  return panels
    .map(p => (p.hasCharacter ? p.action.trim() : `[NC] ${p.action.trim()}`))
    .join("\n");
}

export interface StoryDiffusionBodyParams {
  characterDescription: string;
  comicDescription: string;
  styleName?: string;
  comicStyle?: "Classic Comic Style" | "Four Pannel";
  refImage?: string;
  numIds?: number;
  seed?: number;
  negativePrompt?: string;
}

export function buildStoryDiffusionBody(params: StoryDiffusionBodyParams): Record<string, unknown> {
  let characterDescription = params.characterDescription.trim();
  const body: Record<string, unknown> = {
    character_description: characterDescription,
    comic_description: params.comicDescription,
    style_name: params.styleName ?? "Comic book",
    comic_style: params.comicStyle ?? "Classic Comic Style",
    num_ids: params.numIds ?? 3,
    seed: params.seed ?? Math.floor(Math.random() * 999999),
    negative_prompt: params.negativePrompt ?? ANATOMY_NEGATIVE_PROMPT,
    output_format: "png",
  };
  if (params.refImage) {
    body.ref_image = params.refImage;
    // The docs require the 'img' trigger word in character_description when a
    // ref_image is supplied. Append it only if not already present.
    if (!/\bimg\b/.test(characterDescription)) {
      characterDescription = `${characterDescription} img`;
      body.character_description = characterDescription;
    }
  }
  return body;
}
