import { describe, it, expect } from "vitest";
import { getCharacterSoulReference } from "@/lib/production/character-reference";

describe("getCharacterSoulReference", () => {
  const characters = [
    { name: "Mara", soulId: "soul-uuid-123", portraitUrl: "https://example.com/mara.jpg" },
    { name: "Kessler", soulId: undefined, portraitUrl: "https://example.com/kessler.jpg" },
    { name: "The Dealer", soulId: null, portraitUrl: "" },
  ];

  it("prefers a trained Soul ID over the portrait URL when both exist", () => {
    expect(getCharacterSoulReference("Mara", characters)).toEqual({
      soulId: "soul-uuid-123",
      referenceStrength: 0.95,
    });
  });

  it("falls back to the portrait URL when there's no Soul ID", () => {
    expect(getCharacterSoulReference("Kessler", characters)).toEqual({
      referenceImageUrl: "https://example.com/kessler.jpg",
      referenceStrength: 0.85,
    });
  });

  it("falls back to a bare strength when neither exists", () => {
    expect(getCharacterSoulReference("The Dealer", characters)).toEqual({ referenceStrength: 0.85 });
  });

  it("falls back to a bare strength for an unknown character name", () => {
    expect(getCharacterSoulReference("Nobody", characters)).toEqual({ referenceStrength: 0.85 });
  });

  it("falls back to a bare strength when no character name is given", () => {
    expect(getCharacterSoulReference(undefined, characters)).toEqual({ referenceStrength: 0.85 });
    expect(getCharacterSoulReference(null, characters)).toEqual({ referenceStrength: 0.85 });
    expect(getCharacterSoulReference("", characters)).toEqual({ referenceStrength: 0.85 });
  });
});
