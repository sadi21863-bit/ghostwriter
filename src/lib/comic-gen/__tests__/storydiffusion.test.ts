import { describe, it, expect } from "vitest";
import {
  buildComicDescription, buildStoryDiffusionBody, storyDiffusionStyleFor,
  STORYDIFFUSION_STYLE_BY_ART,
} from "../storydiffusion";

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
