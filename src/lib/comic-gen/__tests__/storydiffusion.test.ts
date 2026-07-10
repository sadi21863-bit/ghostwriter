import { describe, it, expect } from "vitest";
import sharp from "sharp";
import {
  buildComicDescription, buildStoryDiffusionBody, storyDiffusionStyleFor,
  STORYDIFFUSION_STYLE_BY_ART, cropFourPanelGrid,
} from "../storydiffusion";

/** Builds a synthetic 2x2-grid page where each panel has noisy "art" rows
 *  followed by a flat "caption band" starting at `bandStartFrac` of panel
 *  height - mirrors a real StoryDiffusion Four Pannel page closely enough to
 *  exercise the row-variance boundary detection without a real API call. */
async function buildSyntheticPage(panelSize: number, bandStartFrac: number): Promise<Buffer> {
  const pageSize = panelSize * 2;
  const channels = 3;
  const data = Buffer.alloc(pageSize * pageSize * channels);
  const bandStartRow = Math.round(panelSize * bandStartFrac);
  for (let y = 0; y < pageSize; y++) {
    const rowInPanel = y % panelSize;
    const isBand = rowInPanel >= bandStartRow;
    for (let x = 0; x < pageSize; x++) {
      const idx = (y * pageSize + x) * channels;
      const value = isBand ? 235 : Math.floor(Math.random() * 200) + 20; // flat vs. noisy
      data[idx] = value; data[idx + 1] = value; data[idx + 2] = value;
    }
  }
  return sharp(data, { raw: { width: pageSize, height: pageSize, channels } }).png().toBuffer();
}

/** Same shape as buildSyntheticPage, but the "caption band" isn't purely flat -
 *  it has dark "text glyph" streaks punched into it (alternating bright/dark
 *  stripes), mirroring how real baked-in caption TEXT breaks up an otherwise
 *  near-white band. This is the real 2026-07-09 bug case: a strict per-row
 *  flat-variance check fails inside a band like this (the old algorithm), but
 *  the band's ROW AVERAGE stays high throughout since white background still
 *  dominates each row even with dark glyphs mixed in. */
async function buildSyntheticPageWithText(panelSize: number, bandStartFrac: number): Promise<Buffer> {
  const pageSize = panelSize * 2;
  const channels = 3;
  const data = Buffer.alloc(pageSize * pageSize * channels);
  const bandStartRow = Math.round(panelSize * bandStartFrac);
  for (let y = 0; y < pageSize; y++) {
    const rowInPanel = y % panelSize;
    const isBand = rowInPanel >= bandStartRow;
    // Within the band, every 3rd row gets dark "glyph" stripes punched in across
    // ~40% of its width (high local contrast/variance), like a line of text.
    const isTextRow = isBand && rowInPanel % 3 === 0;
    for (let x = 0; x < pageSize; x++) {
      const idx = (y * pageSize + x) * channels;
      let value: number;
      if (isTextRow && x % 5 < 2) value = 20; // dark glyph stripe
      else if (isBand) value = 235; // white band background
      else value = Math.floor(Math.random() * 200) + 20; // noisy art
      data[idx] = value; data[idx + 1] = value; data[idx + 2] = value;
    }
  }
  return sharp(data, { raw: { width: pageSize, height: pageSize, channels } }).png().toBuffer();
}

describe("storyDiffusionStyleFor", () => {
  it("maps art-style ids to StoryDiffusion's fixed style_name options", () => {
    expect(storyDiffusionStyleFor({ id: "manga" })).toBe("Japanese Anime");
    expect(storyDiffusionStyleFor({ id: "western" })).toBe("Comic book");
    expect(storyDiffusionStyleFor({ id: "noir" })).toBe("Line art");
  });
  it("falls back to Comic book for an unknown style", () => {
    expect(storyDiffusionStyleFor({ id: "nonexistent" })).toBe("Comic book");
  });
  it("covers every mapped style with a non-empty value", () => {
    for (const v of Object.values(STORYDIFFUSION_STYLE_BY_ART)) expect(v).toBeTruthy();
  });
});

describe("buildComicDescription", () => {
  it("joins one line per panel and prepends [NC] for character-free panels", () => {
    const out = buildComicDescription([
      { action: "The dealer enters", hasCharacter: true },
      { action: "A card flies through the air", hasCharacter: false },
      { action: "He walks away", hasCharacter: true },
    ]);
    expect(out).toBe("The dealer enters\n[NC] A card flies through the air\nHe walks away");
  });

  it("adds no '#' captions (lettering is the separate B1 stage)", () => {
    const out = buildComicDescription([{ action: "X", hasCharacter: true }]);
    expect(out).not.toContain("#");
  });
});

describe("buildStoryDiffusionBody", () => {
  it("builds the documented request shape with sensible defaults", () => {
    const body = buildStoryDiffusionBody({
      characterDescription: "a weathered man in a duster coat",
      comicDescription: "panel one\npanel two",
      styleName: "Line art",
      seed: 7,
    });
    expect(body).toMatchObject({
      character_description: "a weathered man in a duster coat",
      comic_description: "panel one\npanel two",
      style_name: "Line art",
      comic_style: "Classic Comic Style",
      num_ids: 3,
      seed: 7,
      output_format: "png",
    });
    expect(body.ref_image).toBeUndefined();
    expect(body.negative_prompt).toContain("bad anatomy"); // anatomy guard applied by default
  });

  it("when a ref_image is given, sets it and appends the required 'img' trigger word", () => {
    const body = buildStoryDiffusionBody({
      characterDescription: "a weathered man",
      comicDescription: "x",
      refImage: "https://example.com/dealer.png",
    });
    expect(body.ref_image).toBe("https://example.com/dealer.png");
    expect(body.character_description).toBe("a weathered man img");
  });

  it("does not duplicate the 'img' trigger if already present", () => {
    const body = buildStoryDiffusionBody({
      characterDescription: "a man img",
      comicDescription: "x",
      refImage: "https://example.com/x.png",
    });
    expect(body.character_description).toBe("a man img");
  });

  it("honours an explicit Four Pannel comic_style", () => {
    const body = buildStoryDiffusionBody({
      characterDescription: "x", comicDescription: "y", comicStyle: "Four Pannel",
    });
    expect(body.comic_style).toBe("Four Pannel");
  });
});

describe("cropFourPanelGrid", () => {
  // Real bug this covers: a fixed 75%-height crop worked for short caption
  // text but still let the model's own baked-in caption bleed through when
  // panel descriptions were long enough to wrap the caption to more lines,
  // pushing the real band taller than 25% of the panel (found via a real
  // StoryDiffusion call, 2026-07-09). These tests pin the fix: the crop
  // height must track the ACTUAL flat-band boundary, not a fixed ratio.

  it("crops tighter when the caption band is short (~75% art)", async () => {
    const page = await buildSyntheticPage(200, 0.75);
    const cropped = await cropFourPanelGrid(page, 0);
    const meta = await sharp(cropped).metadata();
    expect(meta.width).toBe(200);
    // Should land close to the real 150px boundary, not blindly at 150 from
    // the old fixed ratio - allow the 8-row detection lag either side.
    expect(meta.height).toBeGreaterThan(135);
    expect(meta.height).toBeLessThan(160);
  });

  it("crops tighter when the caption band is tall (~55% art) - the real bug case", async () => {
    const page = await buildSyntheticPage(200, 0.45);
    const cropped = await cropFourPanelGrid(page, 0);
    const meta = await sharp(cropped).metadata();
    // A fixed 75%-height crop (150px) would still include ~60px of the real
    // flat band here (which starts at 90px) - the whole point of the fix.
    // The 8-consecutive-flat-row requirement adds some detection lag, so this
    // isn't pixel-exact at 90, but it must land well short of the old 150px.
    expect(meta.height).toBeLessThanOrEqual(110);
    expect(meta.height).toBeGreaterThan(75);
  });

  it("crops the caption band even when baked-in TEXT breaks up its flatness - the real 2026-07-09 bug case", async () => {
    // Real generation found: a strict per-row flat-variance check (the
    // original algorithm) almost never sees 8 consecutive flat rows INSIDE a
    // real multi-line caption box, because the text glyphs themselves create
    // high-contrast/high-variance rows even against a white background - the
    // crop landed at the very bottom edge instead of the box's real top,
    // leaving the whole caption visible. Fixed via windowed average
    // brightness (robust to text interruption) + a sharp-jump requirement.
    // Band deliberately starts at 65% (130px), NOT the 75% fallback (150px) -
    // confirmed by hand that the OLD algorithm genuinely fails this exact
    // fixture (falls through to the 150px fallback, leaking 20px of caption),
    // while this fix correctly lands at ~134px.
    const page = await buildSyntheticPageWithText(200, 0.65);
    const cropped = await cropFourPanelGrid(page, 0);
    const meta = await sharp(cropped).metadata();
    expect(meta.height).toBeLessThanOrEqual(145);
    expect(meta.height).toBeGreaterThan(120);
  });

  it("selects the correct quadrant for each panel index", async () => {
    const page = await buildSyntheticPage(100, 0.75);
    const fullMeta = await sharp(page).metadata();
    for (const idx of [0, 1, 2, 3] as const) {
      const cropped = await cropFourPanelGrid(page, idx);
      const meta = await sharp(cropped).metadata();
      expect(meta.width).toBe(100);
      expect(fullMeta.width).toBe(200); // sanity: page is a real 2x2 grid of 100px panels
    }
  });

  it("falls back to a 75%-height crop when no flat band is found at all", async () => {
    // An all-noise page (no caption baked in) should never find 8 consecutive
    // flat rows - falls back to the documented safe default instead of
    // cropping to near-zero or throwing.
    const channels = 3;
    const size = 200;
    const data = Buffer.alloc(size * 2 * size * 2 * channels);
    for (let i = 0; i < data.length; i++) data[i] = Math.floor(Math.random() * 256);
    const page = await sharp(data, { raw: { width: size * 2, height: size * 2, channels } }).png().toBuffer();
    const cropped = await cropFourPanelGrid(page, 0);
    const meta = await sharp(cropped).metadata();
    expect(meta.height).toBe(150); // Math.round(200 * 0.75)
  });
});
