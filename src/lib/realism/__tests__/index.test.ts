// src/lib/realism/__tests__/index.test.ts
import { describe, it, expect } from "vitest";
import { getRealismDomainsForMode } from "../index";

describe("getRealismDomainsForMode", () => {
  it("returns the realism domains for the 4 modes that have them", () => {
    expect(getRealismDomainsForMode("combat")).toEqual(["combat", "body", "injury"]);
    expect(getRealismDomainsForMode("action")).toEqual(["chase", "body"]);
    expect(getRealismDomainsForMode("horror")).toEqual(["body", "injury"]);
    expect(getRealismDomainsForMode("emotional")).toEqual(["body"]);
  });

  it("returns an empty array for modes without realism directives", () => {
    expect(getRealismDomainsForMode("write")).toEqual([]);
    expect(getRealismDomainsForMode("brainstorm")).toEqual([]);
    expect(getRealismDomainsForMode("comedy")).toEqual([]);
  });

  it("returns an empty array for unknown/empty mode strings", () => {
    expect(getRealismDomainsForMode("")).toEqual([]);
    expect(getRealismDomainsForMode("cohost")).toEqual([]);
  });
});
