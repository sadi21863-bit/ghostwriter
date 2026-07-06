import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirstShowcases = vi.fn();
const updateSet = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      showcases: { findFirst: (...args: any[]) => findFirstShowcases(...args) },
    },
    update: () => ({
      set: (...args: any[]) => {
        updateSet(...args);
        return { where: () => Promise.resolve(undefined) };
      },
    }),
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

import { POST } from "../route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/showcase/some-slug/report", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/showcase/[slug]/report", () => {
  beforeEach(() => {
    findFirstShowcases.mockReset();
    updateSet.mockReset();
  });

  it("404s when the slug doesn't exist", async () => {
    findFirstShowcases.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ reason: "spam" }), { params: Promise.resolve({ slug: "missing" }) });

    expect(res.status).toBe(404);
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("404s for an already-private showcase", async () => {
    findFirstShowcases.mockResolvedValue({ slug: "s", visibility: "private" });

    const res = await POST(makeRequest({ reason: "spam" }), { params: Promise.resolve({ slug: "s" }) });

    expect(res.status).toBe(404);
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("sets flagged=true with the given reason for a visible showcase", async () => {
    findFirstShowcases.mockResolvedValue({ slug: "s", visibility: "public" });

    const res = await POST(makeRequest({ reason: "inappropriate" }), { params: Promise.resolve({ slug: "s" }) });

    expect(res.status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ flagged: true, flagReason: "inappropriate" }));
  });
});
