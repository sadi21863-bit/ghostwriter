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
