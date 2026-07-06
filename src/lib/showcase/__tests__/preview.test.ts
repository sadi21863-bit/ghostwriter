import { describe, it, expect } from "vitest";
import { buildShowcasePreview } from "../preview";

describe("buildShowcasePreview", () => {
  it("returns all-empty defaults for a project with no content", () => {
    expect(buildShowcasePreview({})).toEqual({
      coverImageUrl: null, excerpt: "", previewImages: [], previewVideoUrl: null,
    });
  });

  it("prefers a comic panel image for the cover over a character portrait or shot preview", () => {
    const preview = buildShowcasePreview({
      comicPanels: [{ imageUrl: "https://example.com/panel.png" }],
      characters: [{ portraitUrl: "https://example.com/portrait.png" }],
      productionShots: [{ previewImageUrl: "https://example.com/shot.png" }],
    });
    expect(preview.coverImageUrl).toBe("https://example.com/panel.png");
  });

  it("prefers a comic panel's letteredImageUrl over its raw imageUrl", () => {
    const preview = buildShowcasePreview({
      comicPanels: [{ imageUrl: "https://example.com/raw.png", letteredImageUrl: "https://example.com/lettered.png" }],
    });
    expect(preview.coverImageUrl).toBe("https://example.com/lettered.png");
  });

  it("falls back to a character portrait when there are no comic panels", () => {
    const preview = buildShowcasePreview({
      characters: [{ portraitUrl: "https://example.com/portrait.png" }],
      productionShots: [{ previewImageUrl: "https://example.com/shot.png" }],
    });
    expect(preview.coverImageUrl).toBe("https://example.com/portrait.png");
  });

  it("falls back to a production shot preview when there are no panels or portraits", () => {
    const preview = buildShowcasePreview({
      productionShots: [{ previewImageUrl: "https://example.com/shot.png" }],
    });
    expect(preview.coverImageUrl).toBe("https://example.com/shot.png");
  });

  it("collects up to 3 preview images, preferring comic panels over shot previews as a group", () => {
    const preview = buildShowcasePreview({
      comicPanels: [{ imageUrl: "p1" }, { imageUrl: "p2" }, { imageUrl: "p3" }, { imageUrl: "p4" }],
      productionShots: [{ previewImageUrl: "s1" }],
    });
    expect(preview.previewImages).toEqual(["p1", "p2", "p3"]);
  });

  it("uses shot previews for the preview-image group when there are no comic panels at all", () => {
    const preview = buildShowcasePreview({
      productionShots: [{ previewImageUrl: "s1" }, { previewImageUrl: "s2" }],
    });
    expect(preview.previewImages).toEqual(["s1", "s2"]);
  });

  it("extracts and truncates the first chapter (by sortOrder) with real content as the excerpt", () => {
    const preview = buildShowcasePreview({
      chapters: [
        { content: "", sortOrder: 0 },
        { content: "A".repeat(500), sortOrder: 1 },
      ],
    });
    expect(preview.excerpt.length).toBe(401); // 400 chars + ellipsis
    expect(preview.excerpt.endsWith("…")).toBe(true);
  });

  it("does not truncate a short chapter", () => {
    const preview = buildShowcasePreview({ chapters: [{ content: "Short opening line.", sortOrder: 0 }] });
    expect(preview.excerpt).toBe("Short opening line.");
  });

  it("finds the first shot with a sceneFinalVideoUrl for the preview video", () => {
    const preview = buildShowcasePreview({
      productionShots: [{ previewImageUrl: "s1" }, { previewImageUrl: "s2", sceneFinalVideoUrl: "https://example.com/scene.mp4" }],
    });
    expect(preview.previewVideoUrl).toBe("https://example.com/scene.mp4");
  });
});
