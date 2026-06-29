import { describe, it, expect } from "vitest";
import { INSPIRATION_CATEGORIES } from "../inspiration-sources";

describe("INSPIRATION_CATEGORIES", () => {
  it("has categories, each with at least one source", () => {
    expect(INSPIRATION_CATEGORIES.length).toBeGreaterThan(0);
    for (const cat of INSPIRATION_CATEGORIES) {
      expect(cat.sources.length, cat.id).toBeGreaterThan(0);
    }
  });

  it("every source has an https url, a name, a description, and a license", () => {
    for (const cat of INSPIRATION_CATEGORIES) {
      for (const s of cat.sources) {
        expect(s.url, `${cat.id}/${s.name}`).toMatch(/^https?:\/\//);
        expect(s.name.trim().length).toBeGreaterThan(0);
        expect(s.description.trim().length).toBeGreaterThan(0);
        expect(s.license).toBeTruthy();
      }
    }
  });

  it("has no duplicate category ids and no duplicate source URLs", () => {
    const catIds = INSPIRATION_CATEGORIES.map(c => c.id);
    expect(new Set(catIds).size).toBe(catIds.length);
    const urls = INSPIRATION_CATEGORIES.flatMap(c => c.sources.map(s => s.url));
    expect(new Set(urls).size).toBe(urls.length);
  });
});
