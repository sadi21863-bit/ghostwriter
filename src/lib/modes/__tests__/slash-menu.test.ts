// src/lib/modes/__tests__/slash-menu.test.ts
import { describe, it, expect } from "vitest";
import { getVisibleModes, filterModesByQuery } from "../slash-menu";
import { MODE_REGISTRY } from "../registry";
import { MODES } from "@/lib/formats";

describe("getVisibleModes", () => {
  it("returns all 26 modes for story formats", () => {
    expect(getVisibleModes("Novel")).toEqual(MODES);
    expect(getVisibleModes("Screenplay")).toEqual(MODES);
    expect(getVisibleModes("Web Series")).toEqual(MODES);
  });

  it("returns brainstorm/outline/write for Podcast Episode", () => {
    expect(getVisibleModes("Podcast Episode")).toEqual(["brainstorm", "outline", "write"]);
  });

  it("excludes story_only modes for non-podcast creator formats", () => {
    const visible = getVisibleModes("YouTube Long-form");
    for (const m of visible) {
      expect(MODE_REGISTRY[m].visibility).not.toBe("story_only");
    }
    expect(visible).toContain("emotional");
    expect(visible).not.toContain("combat");
    expect(visible).not.toContain("isekai");
  });
});

describe("filterModesByQuery", () => {
  const all = MODES;

  it("returns all given modes unchanged for an empty query", () => {
    expect(filterModesByQuery("", all)).toEqual(all);
    expect(filterModesByQuery("   ", all)).toEqual(all);
  });

  it("matches by slash command", () => {
    expect(filterModesByQuery("fight", all)).toContain("combat");
  });

  it("matches by label", () => {
    expect(filterModesByQuery("horror", all)).toContain("horror");
  });

  it("matches by keyword", () => {
    expect(filterModesByQuery("kiss", all)).toContain("romance");
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterModesByQuery("zzzznotamode", all)).toEqual([]);
  });

  it("only searches within the given modes subset", () => {
    const subset: ("brainstorm" | "outline" | "write")[] = ["brainstorm", "outline", "write"];
    expect(filterModesByQuery("fight", subset)).toEqual([]);
  });
});
