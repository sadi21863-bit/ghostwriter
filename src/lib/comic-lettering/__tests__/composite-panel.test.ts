import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { compositeLettering } from "../composite-panel";

async function makeRedBaseImage(width = 800, height = 800): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 0, b: 0 } },
  }).png().toBuffer();
}

async function pixelAt(buf: Buffer, x: number, y: number): Promise<number[]> {
  const { data, info } = await sharp(buf)
    .extract({ left: x, top: y, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Array.from(data.slice(0, info.channels));
}

describe("compositeLettering", () => {
  it("returns the original buffer unchanged when there is no dialogue or caption", async () => {
    const base = await makeRedBaseImage();
    const result = await compositeLettering({ imageBuffer: base });
    expect(result.equals(base)).toBe(true);
  });

  it("draws a white speech bubble fill in the bottom zone when dialogue is present", async () => {
    const base = await makeRedBaseImage(800, 800);
    const result = await compositeLettering({ imageBuffer: base, dialogue: "We meet again.", bubbleType: "speech" });

    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(800);

    // Inside the bubble ellipse but to the right of the centered black dialogue text,
    // so we sample white bubble fill (high green/blue), not a glyph or the red bg.
    const bubbleBandTop = 800 - Math.round(800 * 0.32);
    const cy = bubbleBandTop + Math.round(800 * 0.32 * 0.58); // ellipse vertical centre (widest)
    const cx = 620; // right of the centred text, still well inside the ellipse
    const pixel = await pixelAt(result, cx, cy);
    expect(pixel[1]).toBeGreaterThan(200); // green channel now bright (white fill)
  });

  it("draws a dark caption box across the top when caption is present", async () => {
    const base = await makeRedBaseImage(800, 800);
    const result = await compositeLettering({ imageBuffer: base, caption: "Three days earlier." });

    const pixel = await pixelAt(result, 400, 10);
    expect(pixel[0]).toBeLessThan(100); // red channel now dark (caption box fill)
  });
});
