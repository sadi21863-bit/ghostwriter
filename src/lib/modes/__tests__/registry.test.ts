// src/lib/modes/__tests__/registry.test.ts
import { describe, it, expect } from "vitest";
import { MODE_REGISTRY, type GenerationMode, type ModeConfig } from "../registry";

const EXPECTED_ORDER: GenerationMode[] = [
  "brainstorm", "outline", "write", "dialogue", "combat", "emotional",
  "atmosphere", "tension", "composition", "horror", "comedy", "mystery",
  "romance", "action", "monologue", "voice", "thriller", "sports",
  "setting", "historical", "scitech", "ethics", "endings", "isekai",
  "interrogation", "chase",
];

describe("MODE_REGISTRY", () => {
  it("has exactly 26 modes in the order formats.ts expects", () => {
    expect(Object.keys(MODE_REGISTRY)).toEqual(EXPECTED_ORDER);
  });

  it("marks the 3 universal modes correctly", () => {
    expect(MODE_REGISTRY.brainstorm.visibility).toBe("universal");
    expect(MODE_REGISTRY.outline.visibility).toBe("universal");
    expect(MODE_REGISTRY.write.visibility).toBe("universal");
    expect(MODE_REGISTRY.brainstorm.gate).toBeNull();
    expect(MODE_REGISTRY.outline.gate).toBeNull();
    expect(MODE_REGISTRY.write.gate).toBeNull();
  });

  it("marks the 5 story-only modes correctly", () => {
    for (const mode of ["dialogue", "combat", "horror", "comedy", "isekai"] as const) {
      expect(MODE_REGISTRY[mode].visibility).toBe("story_only");
    }
  });

  it("marks the remaining 18 modes as story_and_creator", () => {
    const storyAndCreator: GenerationMode[] = [
      "emotional", "atmosphere", "tension", "composition", "mystery",
      "romance", "action", "monologue", "voice", "thriller", "sports",
      "setting", "historical", "scitech", "ethics", "endings",
      "interrogation", "chase",
    ];
    for (const mode of storyAndCreator) {
      expect(MODE_REGISTRY[mode].visibility).toBe("story_and_creator");
    }
  });

  it("gates composition under composition_layer and other library modes under story_modes_advanced", () => {
    expect(MODE_REGISTRY.composition.gate).toBe("composition_layer");
    expect(MODE_REGISTRY.dialogue.gate).toBe("story_modes_advanced");
    expect(MODE_REGISTRY.chase.gate).toBe("story_modes_advanced");
    expect(MODE_REGISTRY.interrogation.gate).toBe("story_modes_advanced");
  });

  it("routes brainstorm/outline/write/dialogue to default tier and the 22 library modes to quality tier", () => {
    expect(MODE_REGISTRY.brainstorm.modelTier).toBe("default");
    expect(MODE_REGISTRY.outline.modelTier).toBe("default");
    expect(MODE_REGISTRY.write.modelTier).toBe("default");
    expect(MODE_REGISTRY.dialogue.modelTier).toBe("default");
    expect(MODE_REGISTRY.combat.modelTier).toBe("quality");
    expect(MODE_REGISTRY.composition.modelTier).toBe("quality");
    expect(MODE_REGISTRY.isekai.modelTier).toBe("quality");
    expect(MODE_REGISTRY.chase.modelTier).toBe("quality");
  });

  it("flags the 11 quality-check modes and no others", () => {
    const expected: GenerationMode[] = [
      "write", "emotional", "combat", "atmosphere", "tension",
      "horror", "mystery", "romance", "thriller", "action", "dialogue",
    ];
    for (const mode of expected) {
      expect(MODE_REGISTRY[mode].qualityCheck).toBe(true);
    }
    const notExpected: GenerationMode[] = [
      "brainstorm", "outline", "composition", "comedy", "monologue",
      "voice", "sports", "setting", "historical", "scitech", "ethics",
      "endings", "isekai", "interrogation", "chase",
    ];
    for (const mode of notExpected) {
      expect(MODE_REGISTRY[mode].qualityCheck).toBe(false);
    }
  });

  it("uses the isekai emoji label and sci/tech short label", () => {
    expect(MODE_REGISTRY.isekai.label).toBe("Isekai ⚔️");
    expect(MODE_REGISTRY.scitech.label).toBe("Sci/Tech");
  });

  it("attaches realismDomains only to combat/action/horror/emotional", () => {
    expect(MODE_REGISTRY.combat.realismDomains).toEqual(["combat", "body", "injury"]);
    expect(MODE_REGISTRY.action.realismDomains).toEqual(["chase", "body"]);
    expect(MODE_REGISTRY.horror.realismDomains).toEqual(["body", "injury"]);
    expect(MODE_REGISTRY.emotional.realismDomains).toEqual(["body"]);

    const withRealism: GenerationMode[] = ["combat", "action", "horror", "emotional"];
    for (const mode of Object.keys(MODE_REGISTRY) as GenerationMode[]) {
      if (!withRealism.includes(mode)) {
        const config: ModeConfig = MODE_REGISTRY[mode];
        expect(config.realismDomains).toBeUndefined();
      }
    }
  });

  it("gives every mode a unique slash command and at least one auto-detection keyword", () => {
    const slashCommands = new Set<string>();
    for (const mode of Object.keys(MODE_REGISTRY) as GenerationMode[]) {
      const config = MODE_REGISTRY[mode];
      expect(config.slash.startsWith("/")).toBe(true);
      expect(config.slash.length).toBeGreaterThan(1);
      expect(slashCommands.has(config.slash)).toBe(false);
      slashCommands.add(config.slash);
      expect(config.keywords.length).toBeGreaterThan(0);
    }
    expect(slashCommands.size).toBe(26);
  });
});
