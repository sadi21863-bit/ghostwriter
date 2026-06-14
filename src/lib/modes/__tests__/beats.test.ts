// src/lib/modes/__tests__/beats.test.ts
import { describe, it, expect } from "vitest";
import { parseBeatList } from "../beats";

describe("parseBeatList", () => {
  it("returns null when there are fewer than 3 BEAT: lines", () => {
    expect(parseBeatList("BEAT: One\nBEAT: Two")).toBeNull();
  });

  it("returns null for text with no BEAT: lines", () => {
    expect(parseBeatList("Just some prose.\nNo beats here.")).toBeNull();
  });

  it("parses three or more BEAT: lines, stripping the prefix and surrounding text", () => {
    const text = [
      "Here is your outline:",
      "BEAT: The hero leaves home.",
      "BEAT: A storm hits the ship.",
      "BEAT: Landfall on a strange island.",
      "Let me know if you'd like changes.",
    ].join("\n");
    expect(parseBeatList(text)).toEqual([
      "The hero leaves home.",
      "A storm hits the ship.",
      "Landfall on a strange island.",
    ]);
  });

  it("trims whitespace around beat text regardless of spacing after the colon", () => {
    const text = "BEAT:   Beat one  \nBEAT:Beat two\nBEAT: Beat three";
    expect(parseBeatList(text)).toEqual(["Beat one", "Beat two", "Beat three"]);
  });
});
