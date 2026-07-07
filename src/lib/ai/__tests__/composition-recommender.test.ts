import { describe, it, expect } from "vitest";
import { suggestComposition } from "../composition-recommender";

describe("suggestComposition", () => {
  it("returns null for empty or whitespace-only text", () => {
    expect(suggestComposition("")).toBeNull();
    expect(suggestComposition("   ")).toBeNull();
  });

  it("returns null when only a single layer type is detected", () => {
    expect(suggestComposition("She threw a punch at him.")).toBeNull();
  });

  it("returns null when zero layer types are detected", () => {
    expect(suggestComposition("They discussed the quarterly budget over coffee.")).toBeNull();
  });

  it("detects combat + emotional together and suggests both layers", () => {
    const result = suggestComposition("He threw a furious punch, rage boiling in his chest as they brawled.");
    expect(result).not.toBeNull();
    const types = result!.layers.map((l) => l.type).sort();
    expect(types).toEqual(["combat", "emotional"]);
  });

  it("guesses the specific emotion param from targeted keywords", () => {
    const result = suggestComposition("He threw a punch, rage boiling in his chest as they brawled.");
    const emotional = result!.layers.find((l) => l.type === "emotional");
    expect(emotional?.param).toBe("Rage");
  });

  it("only names a combat style when it's explicitly mentioned in the text", () => {
    const withStyle = suggestComposition("She grieved as she sparred using Krav Maga, tears on her face.");
    const combat = withStyle!.layers.find((l) => l.type === "combat");
    expect(combat?.param).toBe("Krav Maga");

    const withoutStyle = suggestComposition("She grieved as she threw a punch, tears on her face.");
    const combatNoName = withoutStyle!.layers.find((l) => l.type === "combat");
    expect(combatNoName?.param).toBe("Muay Thai"); // falls back to LAYER_OPTIONS.combat[0]
  });

  it("detects tension + atmosphere together", () => {
    const result = suggestComposition("The abandoned building felt wrong, and she was certain someone was following her.");
    const types = result!.layers.map((l) => l.type).sort();
    expect(types).toContain("atmosphere");
    expect(types).toContain("tension");
  });

  it("caps at 4 layers even if all 4 types are detected", () => {
    const result = suggestComposition(
      "In the abandoned, foggy alley, she threw a punch, rage in her chest, certain someone was following her."
    );
    expect(result!.layers.length).toBeLessThanOrEqual(4);
  });

  it("includes a human-readable reason naming the detected combination", () => {
    const result = suggestComposition("He threw a punch, rage boiling in his chest as they brawled.");
    expect(result!.reason).toContain("combat");
    expect(result!.reason).toContain("emotional");
  });
});
