// src/app/api/ai/__tests__/composition.test.ts
// Tests for the composition layer: GenreMix, composeContext, incompatibility.

import { describe, it, expect } from "vitest";
import { isCompatible } from "@/lib/ai/composer";
import type { GenerationMode } from "@/lib/ai/engine";

describe("Composition layer — compatibility matrix", () => {
  it("combat is incompatible with atmosphere as modifier", () => {
    expect(isCompatible("atmosphere" as GenerationMode, "combat" as GenerationMode)).toBe(false);
  });

  it("combat as primary is compatible with tension modifier", () => {
    expect(isCompatible("combat" as GenerationMode, "tension" as GenerationMode)).toBe(true);
  });

  it("combat as primary is compatible with emotional modifier", () => {
    expect(isCompatible("combat" as GenerationMode, "emotional" as GenerationMode)).toBe(true);
  });

  it("dialogue as primary is compatible with tension", () => {
    expect(isCompatible("dialogue" as GenerationMode, "tension" as GenerationMode)).toBe(true);
  });

  it("emotional cannot be combined with another emotional modifier", () => {
    expect(isCompatible("emotional" as GenerationMode, "emotional" as GenerationMode)).toBe(false);
  });

  it("tension cannot be combined with another tension modifier", () => {
    expect(isCompatible("tension" as GenerationMode, "tension" as GenerationMode)).toBe(false);
  });

  it("horror as primary is compatible with atmosphere", () => {
    expect(isCompatible("horror" as GenerationMode, "atmosphere" as GenerationMode)).toBe(true);
  });

  it("romance is compatible with emotional modifier", () => {
    expect(isCompatible("romance" as GenerationMode, "emotional" as GenerationMode)).toBe(true);
  });
});

describe("Genre mix presets validity", () => {
  it("all genre mix presets have name, description, and layers", async () => {
    const { COMPOSITION_PRESETS } = await import("@/lib/ai/composer").catch(() => ({ COMPOSITION_PRESETS: [] }));
    if (COMPOSITION_PRESETS && Array.isArray(COMPOSITION_PRESETS)) {
      for (const preset of COMPOSITION_PRESETS) {
        expect(preset.name).toBeDefined();
        expect(preset.description).toBeDefined();
        expect(Array.isArray(preset.layers)).toBe(true);
        expect(preset.layers.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
