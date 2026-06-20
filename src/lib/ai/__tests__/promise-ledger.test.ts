import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("@/db", () => ({
  db: { query: { storyMemories: { findMany: (...args: any[]) => findMany(...args) } } },
}));

const { buildPromiseLedger } = await import("@/lib/ai/promise-ledger");

describe("buildPromiseLedger", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns unresolved promises, excluding ones fuzzily matched as resolved", async () => {
    findMany.mockResolvedValue([
      { chapterIndex: 0, structuredData: { openPromisesCreated: ["who killed the duke"], openPromisesResolved: [] } },
      { chapterIndex: 1, structuredData: { openPromisesCreated: ["the missing letter"], openPromisesResolved: ["who killed the duke"] } },
    ]);
    const result = await buildPromiseLedger("proj-1");
    expect(result).toContain("the missing letter");
    expect(result).not.toContain("who killed the duke");
  });

  it("returns empty string when there are no open promises", async () => {
    findMany.mockResolvedValue([{ chapterIndex: 0, structuredData: {} }]);
    const result = await buildPromiseLedger("proj-1");
    expect(result).toBe("");
  });

  it("fails open (returns empty string) when the DB query throws", async () => {
    findMany.mockRejectedValue(new Error("db down"));
    const result = await buildPromiseLedger("proj-1");
    expect(result).toBe("");
  });

  it("de-dupes and caps at the 8 most recent open promises", async () => {
    const created = Array.from({ length: 12 }, (_, i) => `promise ${i}`);
    findMany.mockResolvedValue([{ chapterIndex: 0, structuredData: { openPromisesCreated: created, openPromisesResolved: [] } }]);
    const result = await buildPromiseLedger("proj-1");
    const lines = result.split("\n").filter((l) => l.startsWith("- "));
    expect(lines.length).toBe(8);
  });
});
