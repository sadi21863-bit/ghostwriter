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
//   so no in-image text is added (lettering stays the separate B1 stage). Confirmed
//   via a real call (2026-07-09): it bakes a caption box anyway, but always in a
//   predictable band across the bottom ~25% of EACH panel — croppable, not a dead end.
// - "Four Pannel" renders a clean, uniform 2x2 grid — confirmed via real output and
//   safe to crop with simple arithmetic (see cropFourPanelGrid below). "Classic
//   Comic Style" (8 panels) renders an IRREGULAR manga-style layout with panels of
//   different sizes/shapes, not a uniform grid — confirmed the hard way (a naive
//   grid-slice on this style produced garbled/wrong-aspect-ratio crops that a
//   downstream image-to-video call correctly rejected). Only Four Pannel is safe
//   to auto-crop today; Classic Comic Style would need real layout detection first.
import type { ArtStyle } from "@/lib/ai/panel-prompt-builder";
import { ANATOMY_NEGATIVE_PROMPT } from "@/lib/ai/image-quality";
import sharp from "sharp";

// ART_STYLES.id → StoryDiffusion style_name (the model's fixed 7-option enum,
// confirmed live against segmind.com/models/storydiffusion/api: "(No style)",
// "Japanese Anime", "Cinematic", "Disney Charactor", "Photographic", "Comic book",
// "Line art" — no dedicated manhua option, so it maps to the closest real fit.
export const STORYDIFFUSION_STYLE_BY_ART: Record<string, string> = {
  manga:         "Japanese Anime",
  manhwa:        "Japanese Anime",
  manhua:        "Cinematic", // manhua's painterly, semi-realistic look sits closer to Cinematic than the flatter Japanese Anime line art
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

/**
 * Crop one panel out of a Four Pannel (2x2 grid) StoryDiffusion page, clean of
 * the baked-in caption band that always lands across the bottom of each panel
 * (confirmed via real output, not a guess). `panelIndex` is 0-3, reading
 * left-to-right then top-to-bottom, matching the order panels appear in
 * `comic_description`. Only safe for "Four Pannel" output — "Classic Comic
 * Style"'s irregular layout has no fixed geometry to crop by index.
 *
 * The caption band's HEIGHT is not fixed — it scales with how much text the
 * model bakes in (confirmed the hard way: a fixed ~75%-of-panel crop that
 * worked for short action lines still showed the model's own caption text
 * bleeding through when panel descriptions were longer and wrapped to more
 * lines). Detects the real boundary instead: the caption band is a large
 * flat-color area, so scans rows bottom-up for where per-row pixel variance
 * jumps from "flat" to "photographic," and crops just above that jump.
 */
export async function cropFourPanelGrid(pageBuffer: Buffer, panelIndex: 0 | 1 | 2 | 3): Promise<Buffer> {
  const meta = await sharp(pageBuffer).metadata();
  const panelSize = Math.floor((meta.width ?? 0) / 2);
  const col = panelIndex % 2;
  const row = Math.floor(panelIndex / 2);

  const panelBuf = await sharp(pageBuffer)
    .extract({ left: col * panelSize, top: row * panelSize, width: panelSize, height: panelSize })
    .toBuffer();

  const artHeight = await findCaptionBandTop(panelBuf, panelSize);

  return sharp(panelBuf)
    .extract({ left: 0, top: 0, width: panelSize, height: artHeight })
    .png()
    .toBuffer();
}

/** Scans a square panel top-down (within the bottom 45%, where the caption
 *  band always lands in practice) for a SUDDEN, SUSTAINED jump to a much
 *  brighter region - a real caption box, even a multi-line one.
 *
 *  A strict per-row flat-variance check (the original approach) breaks on
 *  real baked-in caption TEXT: confirmed via a real failing generation
 *  (2026-07-09) where multi-line caption text created high-variance rows
 *  even inside an otherwise near-white caption box (text glyphs against a
 *  white background are high-contrast), so "8 consecutive low-variance
 *  rows" almost never occurred INSIDE the box itself - only a couple of
 *  pixel-thin gaps between text lines ever qualified, so the crop landed
 *  right at the very bottom edge instead of the box's real top, leaving
 *  the whole caption visible. A windowed AVERAGE brightness is robust to
 *  that (text rows still average bright since the white background
 *  dominates the window), and requiring a large jump relative to the
 *  preceding window (not just "bright") avoids false-triggering on
 *  legitimate bright art (snow, sky) that's usually elevated gradually
 *  rather than jumping sharply at one row. Falls back to a 75%-height crop
 *  if no clear jump is found (e.g. a panel with no caption baked in at all). */
async function findCaptionBandTop(panelBuf: Buffer, panelSize: number): Promise<number> {
  const searchTop = Math.round(panelSize * 0.55);
  const { data, info } = await sharp(panelBuf)
    .extract({ left: 0, top: searchTop, width: panelSize, height: panelSize - searchTop })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rowMeans: number[] = [];
  for (let y = 0; y < info.height; y++) {
    const rowStart = y * info.width;
    let sum = 0;
    for (let x = 0; x < info.width; x++) sum += data[rowStart + x];
    rowMeans.push(sum / info.width);
  }

  const WINDOW = 24;
  const JUMP_THRESHOLD = 40;
  const BRIGHTNESS_FLOOR = 170;
  const windowAvg = (start: number) => {
    const end = Math.min(start + WINDOW, rowMeans.length);
    let sum = 0;
    for (let i = start; i < end; i++) sum += rowMeans[i];
    return sum / (end - start);
  };

  // If the search region is ALREADY bright from its very first row, the real
  // jump happened above searchTop (an unusually tall caption band) and there's
  // no "before" baseline left inside the search region to compare against -
  // crop right at searchTop rather than scanning forward and missing it (the
  // conservative choice: guarantees no caption bleeds through, at the cost of
  // trimming a little extra art in this rare case).
  if (rowMeans.length >= WINDOW && windowAvg(0) >= BRIGHTNESS_FLOOR) {
    return searchTop;
  }

  for (let y = WINDOW; y <= rowMeans.length - WINDOW; y++) {
    const before = windowAvg(y - WINDOW);
    const after = windowAvg(y);
    if (after >= BRIGHTNESS_FLOOR && after - before >= JUMP_THRESHOLD) {
      return searchTop + y;
    }
  }
  return Math.round(panelSize * 0.75); // no clear caption-band jump found - fall back to the old safe default
}
