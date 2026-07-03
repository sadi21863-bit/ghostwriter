import { describe, it, expect } from "vitest";
import { analyzeGraphHealth } from "../graph-health";
import { buildStoryGraph, type StoryGraphInput } from "../story-graph";

// A healthy little graph: Mara drives the Heist thread, appears at the Factory,
// and the Ember Blade (weapon) is wired to Mara.
const healthy: StoryGraphInput = {
  characters: [{ id: "c1", name: "Mara", linkedLocationIds: ["l1"], linkedPlotThreadIds: ["t1"] }],
  locations: [{ id: "l1", name: "The Factory", linkedCharacterIds: ["c1"] }],
  plotThreads: [{ id: "t1", name: "The Heist" }],
  chapters: [],
  storedRels: [],
  worldEntities: [{ id: "w1", name: "Ember Blade", kind: "weapon", linkedCharacterIds: ["c1"], linkedLocationIds: [], linkedPlotThreadIds: [], linkedEntityIds: [] }],
};

describe("analyzeGraphHealth", () => {
  it("reports no issues and a perfect score for a fully-connected graph", () => {
    const report = analyzeGraphHealth(buildStoryGraph(healthy));
    expect(report.issues).toEqual([]);
    expect(report.score).toBe(100);
  });

  it("flags a fully isolated character as a warning", () => {
    const g = buildStoryGraph({
      ...healthy,
      characters: [...healthy.characters, { id: "c9", name: "Ghost", linkedLocationIds: [], linkedPlotThreadIds: [] }],
    });
    const report = analyzeGraphHealth(g);
    const issue = report.issues.find(i => i.nodeId === "c9");
    expect(issue).toMatchObject({ kind: "isolated_character", severity: "warning" });
    expect(report.score).toBeLessThan(100);
  });

  it("flags a thread that no character drives as unrooted", () => {
    const g = buildStoryGraph({
      ...healthy,
      plotThreads: [...healthy.plotThreads, { id: "t9", name: "Orphan Thread" }],
    });
    const report = analyzeGraphHealth(g);
    // t9 has no driver and degree 0 → isolated path; give it a driver-less but
    // connected case instead: link an entity to it so it's connected but unrooted.
    expect(report.issues.some(i => i.nodeName === "Orphan Thread")).toBe(true);
  });

  it("flags a connected-but-unrooted thread (entity-linked, no character driver)", () => {
    const g = buildStoryGraph({
      characters: [{ id: "c1", name: "Mara", linkedLocationIds: [], linkedPlotThreadIds: [] }],
      locations: [],
      plotThreads: [{ id: "t1", name: "The Curse" }],
      chapters: [],
      storedRels: [],
      // entity → thread "involves" edge connects t1 (degree>0) but no character drives it
      worldEntities: [{ id: "w1", name: "Hex Stone", kind: "object", linkedCharacterIds: [], linkedLocationIds: [], linkedPlotThreadIds: ["t1"], linkedEntityIds: [] }],
    });
    const report = analyzeGraphHealth(g);
    expect(report.issues.some(i => i.kind === "unrooted_thread" && i.nodeName === "The Curse")).toBe(true);
  });

  it("flags an unused world entity (wired to nothing) as info", () => {
    const g = buildStoryGraph({
      ...healthy,
      worldEntities: [
        ...healthy.worldEntities!,
        { id: "w2", name: "Lost Relic", kind: "object", linkedCharacterIds: [], linkedLocationIds: [], linkedPlotThreadIds: [], linkedEntityIds: [] },
      ],
    });
    const report = analyzeGraphHealth(g);
    expect(report.issues.find(i => i.nodeId === "w2")).toMatchObject({ kind: "isolated_entity", severity: "info" });
  });

  it("does not flag an unwritten (degree-0) chapter as an isolation issue", () => {
    const g = buildStoryGraph({
      ...healthy,
      chapters: [{ id: "ch1", title: "Chapter 3", content: "" }],
    });
    const report = analyzeGraphHealth(g);
    expect(report.issues.find(i => i.nodeId === "ch1")).toBeUndefined();
    expect(report.score).toBe(100);
  });
});
