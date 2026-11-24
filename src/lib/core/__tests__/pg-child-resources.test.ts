import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Phase 2 / v4 §7 — the Postgres child-resource adapter.
 *
 * Its security-relevant behaviour is the LOOKUP: an unrecognized resource name
 * must resolve to "not owned", never to "owned". A registry implemented as a
 * plain object resolves `toString` / `__proto__` through the prototype chain, so
 * a truthiness check there is a silent authorization bypass — which is exactly
 * what the first version of this adapter did.
 */

// Rest parameters, so the `...args` delegation below typechecks: a fixed-arity
// mock cannot accept a spread (CLAUDE.md item 69 gotcha).
const limit = vi.fn(async (..._n: number[]) => [{ id: "row" }]);
const where = vi.fn((..._cond: unknown[]) => ({ limit: (...a: any[]) => limit(...a) }));
const from = vi.fn((..._table: unknown[]) => ({ where: (...a: any[]) => where(...a) }));
const select = vi.fn((..._cols: unknown[]) => ({ from: (...a: any[]) => from(...a) }));

vi.mock("@/db", () => ({
  db: { select: (...args: any[]) => select(...args) },
}));

const { pgChildResourceRepository } = await import("@/lib/core/pg-repositories");

const ref = { resource: "comic_pages", childId: "page-1", projectId: "proj-1" };

describe("pgChildResourceRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limit.mockResolvedValue([{ id: "row" }]);
  });

  it("confirms ownership when the scoped query returns a row", async () => {
    expect(await pgChildResourceRepository.owns(ref)).toBe(true);
    expect(select).toHaveBeenCalled();
  });

  it("reports not-owned when the scoped query returns nothing", async () => {
    limit.mockResolvedValue([]);
    expect(await pgChildResourceRepository.owns(ref)).toBe(false);
  });

  it("does NOT resolve a misspelled resource to 'owned'", async () => {
    // A typo in a route must never become an authorization bypass.
    expect(await pgChildResourceRepository.owns({ ...ref, resource: "comic_pagnes" })).toBe(false);
    expect(select).not.toHaveBeenCalled();
  });

  it("does NOT resolve inherited object keys to 'owned'", async () => {
    // The bug this file exists for: `CHILD_TABLES["toString"]` is truthy on a
    // plain object, so an `if (!table)` guard would pass them straight through.
    for (const resource of ["toString", "constructor", "__proto__", "hasOwnProperty", "valueOf", ""]) {
      expect(await pgChildResourceRepository.owns({ ...ref, resource })).toBe(false);
    }
    expect(select).not.toHaveBeenCalled();
  });

  it("still resolves every registered resource", async () => {
    for (const resource of ["comic_pages", "comic_panels"]) {
      expect(await pgChildResourceRepository.owns({ ...ref, resource })).toBe(true);
    }
  });
});