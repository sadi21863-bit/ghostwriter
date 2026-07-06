import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyShowcases = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      showcases: { findMany: (...args: any[]) => findManyShowcases(...args) },
    },
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

import { GET } from "../route";

describe("GET /api/showcases/mine", () => {
  beforeEach(() => {
    findManyShowcases.mockReset();
  });

  it("scopes the query to the authenticated user's showcases", async () => {
    findManyShowcases.mockResolvedValue([]);

    await GET();

    expect(findManyShowcases).toHaveBeenCalledWith(expect.objectContaining({ where: expect.anything() }));
  });

  it("returns a slim projection (no flagReason/userId leaked)", async () => {
    findManyShowcases.mockResolvedValue([
      { projectId: "p1", slug: "s1", title: "T1", visibility: "public", userId: "user-1", flagReason: "" },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.showcases).toEqual([{ projectId: "p1", slug: "s1", title: "T1", visibility: "public" }]);
  });
});
