import { describe, it, expect } from "vitest";
import { suggestCombatStyleForCharacter } from "../character-combat-style";

describe("suggestCombatStyleForCharacter", () => {
  it("returns null for a null/undefined character", () => {
    expect(suggestCombatStyleForCharacter(null)).toBeNull();
    expect(suggestCombatStyleForCharacter(undefined)).toBeNull();
  });

  it("returns null when the character has no skills", () => {
    expect(suggestCombatStyleForCharacter({ skills: [] })).toBeNull();
    expect(suggestCombatStyleForCharacter({})).toBeNull();
  });

  it("matches an exact combat-style name in the skills array", () => {
    const character = { skills: [{ name: "Krav Maga", category: "physical", level: 3, acquisitionPath: "deliberate_practice", traumaLinked: false }] };
    expect(suggestCombatStyleForCharacter(character)).toBe("Krav Maga");
  });

  it("matches case-insensitively", () => {
    const character = { skills: [{ name: "muay thai", category: "physical", level: 2, acquisitionPath: "deliberate_practice", traumaLinked: false }] };
    expect(suggestCombatStyleForCharacter(character)).toBe("Muay Thai");
  });

  it("does not guess from a vague, non-matching skill name", () => {
    const character = { skills: [{ name: "self-defense", category: "physical", level: 1, acquisitionPath: "deliberate_practice", traumaLinked: false }] };
    expect(suggestCombatStyleForCharacter(character)).toBeNull();
  });

  it("finds the matching skill even when other unrelated skills are listed first", () => {
    const character = {
      skills: [
        { name: "Accounting", category: "mental", level: 4, acquisitionPath: "deliberate_practice", traumaLinked: false },
        { name: "Judo", category: "physical", level: 3, acquisitionPath: "deliberate_practice", traumaLinked: false },
      ],
    };
    expect(suggestCombatStyleForCharacter(character)).toBe("Judo");
  });
});
