import { describe, it, expect } from "vitest";
import { buildStoryGraph, type StoryGraphInput } from "../story-graph";

const baseInput: StoryGraphInput = {
  characters: [
    { id: "c1", name: "Mara", role: "Protagonist", linkedLocationIds: ["l1"], linkedPlotThreadIds: ["t1"] },
    { id: "c2", name: "Kessler", role: "Antagonist", linkedLocationIds: [], linkedPlotThreadIds: ["t1"] },
    { id: "c3", name: "Ghost", role: "Side", linkedLocationIds: [], linkedPlotThreadIds: [] },
  ],
  locations: [{ id: "l1", name: "The Factory", linkedCharacterIds: ["c2"] }],
  plotThreads: [{ id: "t1", name: "The Heist" }],
  chapters: [{ content: "Mara met Kessler at dawn." }],
  storedRels: [{ characterAId: "c1", characterBId: "c2", trustLevel: 20, relationshipType: "enemy" }],
};

describe("buildStoryGraph", () => {
  const g = buildStoryGraph(baseInput);

  it("emits typed nodes for characters, locations, and threads", () => {
    const byType = (t: string) => g.nodes.filter(n => n.type === t).map(n => n.id).sort();
    expect(byType("character")).toEqual(["c1", "c2", "c3"]);
    expect(byType("location")).toEqual(["l1"]);
    expect(byType("thread")).toEqual(["t1"]);
  });

  it("creates a character relationship edge from co-occurrence + stored data", () => {
    const rel = g.edges.find(e => e.kind === "relationship");
    expect(rel).toMatchObject({ source: "c1", target: "c2", relationshipType: "enemy", trustLevel: 20 });
    expect(rel!.sharedChapters).toBe(1);
  });

  it("creates appears_at edges from BOTH character.linkedLocationIds and location.linkedCharacterIds, deduped", () => {
    const appears = g.edges.filter(e => e.kind === "appears_at");
    // c1→l1 (from character side) and c2→l1 (from location side) — two distinct, no dupes.
    expect(appears.map(e => `${e.source}->${e.target}`).sort()).toEqual(["c1->l1", "c2->l1"]);
  });

  it("creates drives edges from character.linkedPlotThreadIds", () => {
    const drives = g.edges.filter(e => e.kind === "drives").map(e => `${e.source}->${e.target}`).sort();
    expect(drives).toEqual(["c1->t1", "c2->t1"]);
  });

  it("ignores links that point at non-existent entities", () => {
    const g2 = buildStoryGraph({
      ...baseInput,
      characters: [{ id: "c1", name: "Mara", linkedLocationIds: ["ghost-loc"], linkedPlotThreadIds: ["ghost-thread"] }],
      locations: [], plotThreads: [], storedRels: [], chapters: [],
    });
    expect(g2.edges).toHaveLength(0);
  });

  it("reports characters with no edges at all as isolated", () => {
    // c3 (Ghost) has no co-occurrence, no location, no thread.
    expect(g.isolated.map(i => i.id)).toEqual(["c3"]);
  });

  it("gives every edge a unique id", () => {
    const ids = g.edges.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("buildStoryGraph — world entities", () => {
  const g = buildStoryGraph({
    ...baseInput,
    worldEntities: [
      { id: "w1", name: "The Ember Blade", kind: "weapon", linkedCharacterIds: ["c1"], linkedLocationIds: ["l1"], linkedPlotThreadIds: ["t1"], linkedEntityIds: [] },
      { id: "w2", name: "The Syndicate", kind: "organization", linkedCharacterIds: ["c2"], linkedLocationIds: [], linkedPlotThreadIds: [], linkedEntityIds: ["w1"] },
    ],
  });

  it("emits a world_entity node per entity carrying its kind", () => {
    const w = g.nodes.filter(n => n.type === "world_entity");
    expect(w.map(n => n.id).sort()).toEqual(["w1", "w2"]);
    expect(w.find(n => n.id === "w1")!.kind).toBe("weapon");
  });

  it("creates involves edges from an entity's link arrays to existing nodes", () => {
    const involves = g.edges.filter(e => e.kind === "involves").map(e => `${e.source}->${e.target}`).sort();
    // w1 → c1, l1, t1 ; w2 → c2, w1
    expect(involves).toEqual(["w1->c1", "w1->l1", "w1->t1", "w2->c2", "w2->w1"]);
  });

  it("ignores entity links pointing at non-existent nodes", () => {
    const g2 = buildStoryGraph({
      ...baseInput,
      worldEntities: [{ id: "w1", name: "Orphan", kind: "object", linkedCharacterIds: ["nope"], linkedLocationIds: [], linkedPlotThreadIds: [], linkedEntityIds: [] }],
    });
    expect(g2.edges.filter(e => e.kind === "involves")).toHaveLength(0);
  });
});

describe("buildStoryGraph — chapters", () => {
  it("does not emit a chapter node for id-less chapter fixtures (co-occurrence-only)", () => {
    // baseInput's chapter has no `id` — confirms existing/anonymous fixtures are unaffected.
    const g = buildStoryGraph(baseInput);
    expect(g.nodes.filter(n => n.type === "chapter")).toHaveLength(0);
  });

  it("emits a chapter node, carrying title/wordCount/status, only when the chapter has an id", () => {
    const g = buildStoryGraph({
      ...baseInput,
      chapters: [{ id: "ch1", title: "Dawn Raid", wordCount: 1200, reviewStatus: "approved", content: "Mara met Kessler at dawn." }],
    });
    const chapterNode = g.nodes.find(n => n.type === "chapter");
    expect(chapterNode).toMatchObject({ id: "ch1", name: "Dawn Raid", wordCount: 1200, status: "approved" });
  });

  it("creates a features edge from a chapter to every character it mentions", () => {
    const g = buildStoryGraph({
      ...baseInput,
      chapters: [{ id: "ch1", title: "Dawn Raid", content: "Mara met Kessler at dawn." }],
    });
    const features = g.edges.filter(e => e.kind === "features").map(e => `${e.source}->${e.target}`).sort();
    expect(features).toEqual(["ch1->c1", "ch1->c2"]);
  });

  it("a character only mentioned in a chapter (no other links) is no longer isolated", () => {
    const g = buildStoryGraph({
      characters: [{ id: "c1", name: "Mara" }, { id: "c2", name: "Ghost" }],
      locations: [], plotThreads: [], storedRels: [],
      chapters: [{ id: "ch1", title: "Dawn Raid", content: "Mara walked alone." }],
    });
    expect(g.isolated.map(i => i.id)).toEqual(["c2"]);
  });

  it("defaults name/wordCount/status for a chapter fixture missing those fields", () => {
    const g = buildStoryGraph({ ...baseInput, chapters: [{ id: "ch1" }] });
    const chapterNode = g.nodes.find(n => n.type === "chapter");
    expect(chapterNode).toMatchObject({ name: "Untitled chapter", wordCount: 0, status: "draft" });
  });
});
