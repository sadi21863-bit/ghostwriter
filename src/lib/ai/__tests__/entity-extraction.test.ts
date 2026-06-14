import { describe, it, expect } from "vitest";
import { matchEntities, diffEntity } from "../entity-extraction";

describe("matchEntities", () => {
  const project = {
    characters: [{ id: "c1", name: "Ava" }, { id: "c2", name: "Lin Mercer" }],
    locations: [{ id: "l1", name: "The Hollow" }],
    plotThreads: [{ id: "p1", name: "Stolen Ledger" }],
  };

  it("matches a character name appearing in the text", () => {
    const result = matchEntities("Ava walked into the room.", project);
    expect(result).toEqual([{ type: "characters", entity: project.characters[0] }]);
  });

  it("is case-insensitive and matches whole words only", () => {
    const result = matchEntities("ava nodded, but Avalanche was unrelated.", project);
    expect(result).toHaveLength(1);
    expect(result[0].entity.name).toBe("Ava");
  });

  it("prioritizes characters over locations over plot threads, in array order, up to maxMatches", () => {
    const text = "Ava and Lin Mercer stood at The Hollow, thinking about the Stolen Ledger.";
    const result = matchEntities(text, project, 3);
    expect(result.map(r => r.entity.name)).toEqual(["Ava", "Lin Mercer", "The Hollow"]);
  });

  it("skips entities with names shorter than 2 characters", () => {
    const p = { characters: [{ id: "c1", name: "A" }], locations: [], plotThreads: [] };
    expect(matchEntities("A is here.", p)).toEqual([]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(matchEntities("Nothing relevant happens here.", project)).toEqual([]);
  });
});

describe("diffEntity", () => {
  it("returns changed fields where the proposal differs and is non-empty", () => {
    const existing = { name: "Ava", desires: "Find her sister", arc: "", fears: "Heights" };
    const proposed = { name: "Ava", desires: "Find her sister and clear her name", arc: "Learns to trust again", fears: "Heights" };
    const changes = diffEntity("characters", existing, proposed);
    expect(changes).toEqual([
      { field: "desires", label: "Want", oldValue: "Find her sister", newValue: "Find her sister and clear her name" },
      { field: "arc", label: "Need", oldValue: "", newValue: "Learns to trust again" },
    ]);
  });

  it("ignores empty proposal values and unchanged values", () => {
    const existing = { description: "A quiet harbor town.", stakes: "" };
    const proposed = { description: "A quiet harbor town.", stakes: "" };
    expect(diffEntity("locations", existing, proposed)).toEqual([]);
  });

  it("returns an empty array for a non-object proposal", () => {
    expect(diffEntity("plotThreads", { description: "x" }, {})).toEqual([]);
    expect(diffEntity("plotThreads", { description: "x" }, null)).toEqual([]);
  });
});
