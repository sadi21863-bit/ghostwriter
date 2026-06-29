import { describe, it, expect } from "vitest";
import { ART_STYLES, buildPanelPrompt, type PanelSpec, type ArtStyle } from "../panel-prompt-builder";

const spec: PanelSpec = {
  beatIndex: 0, action: "The dealer fans his cards", characters: ["Mara"],
  location: "The factory", shotType: "medium shot", mood: "tense",
};
const characters = [{ name: "Mara", appearance: "weathered, grey coat" }];

describe("ART_STYLES", () => {
  it("every style has id/label/higgsfieldPreset, concrete styleModifiers, and a color flag", () => {
    for (const s of ART_STYLES) {
      expect(s.id).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.higgsfieldPreset).toBeTruthy();
      expect((s as any).styleModifiers, s.id).toBeTruthy();
      expect(["bw", "color"]).toContain((s as any).color);
    }
  });

  it("includes a manhwa/webtoon style (the format the research flagged as missing)", () => {
    expect(ART_STYLES.find(s => s.id === "manhwa")).toBeTruthy();
  });
});

describe("buildPanelPrompt", () => {
  const manga = ART_STYLES.find(s => s.id === "manga")! as ArtStyle;

  it("bakes the rich style modifiers into the prompt (not just the preset label)", () => {
    const p = buildPanelPrompt(spec, characters, manga, "The Dealer");
    expect(p).toContain("screentone"); // a manga-specific modifier
    expect(p).toContain("medium shot");
    expect(p).toContain("The dealer fans his cards");
    expect(p).toContain("Mara: weathered, grey coat");
  });

  it("always forbids in-image text/lettering (lettering is the separate B1 stage)", () => {
    const p = buildPanelPrompt(spec, characters, manga, "X");
    expect(p.toLowerCase()).toContain("no text");
    expect(p.toLowerCase()).toContain("no speech bubbles");
  });

  it("falls back to the preset label for a style with no modifiers", () => {
    const legacy = { id: "x", label: "X", higgsfieldPreset: "LegacyPreset" } as unknown as ArtStyle;
    const p = buildPanelPrompt(spec, characters, legacy, "X");
    expect(p).toContain("LegacyPreset style");
  });

  it("handles panels with no recognised characters", () => {
    const p = buildPanelPrompt({ ...spec, characters: ["Unknown"] }, characters, manga, "X");
    expect(p).not.toContain("Characters —");
  });
});
