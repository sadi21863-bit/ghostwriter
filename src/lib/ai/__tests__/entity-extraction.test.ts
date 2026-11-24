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

  it("diffs a world entity's summary/description fields", () => {
    const existing = { name: "Ember Blade", summary: "a sword", description: "" };
    const proposed = { name: "Ember Blade", summary: "a sword wreathed in cold fire", description: "forged in the north" };
    expect(diffEntity("worldEntities", existing, proposed)).toEqual([
      { field: "summary", label: "Summary", oldValue: "a sword", newValue: "a sword wreathed in cold fire" },
      { field: "description", label: "Description", oldValue: "", newValue: "forged in the north" },
    ]);
  });

  it("emits a name change for every entity type — the §13.1-unblocked field", () => {
    for (const type of ["characters", "locations", "plotThreads", "worldEntities"] as const) {
      const changes = diffEntity(type, { name: "Old" }, { name: "New" });
      expect(changes).toEqual([{ field: "name", label: "Name", oldValue: "Old", newValue: "New" }]);
    }
  });

  it("carries jsonb field values canonically as JSON strings on the wire", () => {
    const existing = { name: "Ava", linkedLocationIds: ["l1", "l2"] };
    const proposed = { name: "Ava", linkedLocationIds: ["l1"] };
    expect(diffEntity("characters", existing, proposed)).toEqual([
      { field: "linkedLocationIds", label: "Linked locations", oldValue: '["l1","l2"]', newValue: '["l1"]' },
    ]);
  });

  it("treats empty arrays and objects as no proposal, like the old String() behavior", () => {
    const existing = { name: "Ava", linkedLocationIds: ["l1"] };
    const proposed = { name: "Ava", linkedLocationIds: [], properties: {} };
    expect(diffEntity("characters", existing, proposed)).toEqual([]);
  });

  it("never diffs production/derived/system fields even when a proposal carries them", () => {
    const existing = { name: "Ava", voiceId: "old", portraitUrl: "old", soulId: "old", id: "c1", updatedAt: "old" };
    const proposed = { name: "Ava", voiceId: "new", portraitUrl: "new", soulId: "new", id: "c2", updatedAt: "new" };
    expect(diffEntity("characters", existing, proposed)).toEqual([]);
  });

  it("diffs a world entity's kind re-classification and jsonb properties blob", () => {
    const existing = { name: "Ember", kind: "object", properties: { origin: "smithing" } };
    const proposed = { name: "Ember", kind: "concept", properties: { origin: "myth" } };
    expect(diffEntity("worldEntities", existing, proposed)).toEqual([
      { field: "kind", label: "Kind", oldValue: "object", newValue: "concept" },
      { field: "properties", label: "Properties", oldValue: '{"origin":"smithing"}', newValue: '{"origin":"myth"}' },
    ]);
  });
});

describe("matchEntities — world entities", () => {
  const project = {
    characters: [{ id: "c1", name: "Ava" }],
    locations: [],
    plotThreads: [],
    worldEntities: [{ id: "w1", name: "Ember Blade" }],
  };

  it("matches a world entity named in the text (after characters/locations/threads)", () => {
    const result = matchEntities("Ava raised the Ember Blade.", project, 3);
    expect(result.map(r => `${r.type}:${r.entity.name}`)).toEqual(["characters:Ava", "worldEntities:Ember Blade"]);
  });
});
