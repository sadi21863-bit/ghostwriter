import { describe, it, expect } from "vitest";
import { ARC_PRESETS, getArcPreset, expandArcPreset } from "../arc-presets";
import { encodeStoryBeats } from "@/lib/types/story";

describe("ARC_PRESETS", () => {
  it("every preset has an id, label, description, and non-empty beats", () => {
    for (const p of ARC_PRESETS) {
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.beats.length).toBeGreaterThan(0);
    }
  });

  it("includes the headline structures", () => {
    const ids = ARC_PRESETS.map(p => p.id);
    expect(ids).toEqual(expect.arrayContaining(["three_act", "heros_journey", "save_the_cat", "detective"]));
  });
});

describe("expandArcPreset", () => {
  it("expands a preset into ordered, zero-based beats ready to persist", () => {
    const beats = expandArcPreset("three_act", i => `beat-${i}`);
    expect(beats.length).toBe(getArcPreset("three_act")!.beats.length);
    expect(beats[0]).toMatchObject({ id: "beat-0", order: 0, label: "Setup", purpose: "setup", characterIds: [], threadIds: [] });
    expect(beats.map(b => b.order)).toEqual(beats.map((_, i) => i));
  });

  it("produces beats that pass the StoryBeat strict encoder (schema-valid)", () => {
    const beats = expandArcPreset("heros_journey", i => `b${i}`);
    expect(() => encodeStoryBeats(beats)).not.toThrow();
    expect(encodeStoryBeats(beats).length).toBe(12);
  });

  it("returns [] for an unknown preset", () => {
    expect(expandArcPreset("nope", i => `b${i}`)).toEqual([]);
  });
});
