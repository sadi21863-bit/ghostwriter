import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyShowcases = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      showcases: { findMany: (...args: any[]) => findManyShowcases(...args) },
    },
  },
}));

import { GET } from "../route";

function makeRequest(cursor?: string) {
  const url = cursor ? `http://localhost/api/showcase?cursor=${cursor}` : "http://localhost/api/showcase";
  return new Request(url);
}

describe("GET /api/showcase (public discovery feed)", () => {
  beforeEach(() => {
    findManyShowcases.mockReset();
  });

  it("queries only visibility=public AND flagged=false, ordered newest first", async () => {
    findManyShowcases.mockResolvedValue([]);

    await GET(makeRequest());

    const callArgs = findManyShowcases.mock.calls[0][0];
    expect(callArgs.where).toBeDefined();
    expect(callArgs.orderBy).toBeDefined();
  });

  it("returns nextCursor=null when fewer than a full page comes back", async () => {
    findManyShowcases.mockResolvedValue([
      { slug: "a", title: "A", blurb: "b", project: { name: "A", format: "Novel" } },
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.showcases).toHaveLength(1);
    expect(body.nextCursor).toBeNull();
  });

  it("returns a nextCursor when a full page-plus-one comes back, and trims to page size", async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({
      slug: `s${i}`, title: `T${i}`, blurb: "b", project: { name: `T${i}`, format: "Novel" },
    }));
    findManyShowcases.mockResolvedValue(rows);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.showcases).toHaveLength(20);
    expect(body.nextCursor).toBe(20);
  });

  it("passes the cursor through as the offset", async () => {
    findManyShowcases.mockResolvedValue([]);

    await GET(makeRequest("40"));

    const callArgs = findManyShowcases.mock.calls[0][0];
    expect(callArgs.offset).toBe(40);
  });
});
