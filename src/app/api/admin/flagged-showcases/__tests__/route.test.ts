import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const findManyShowcases = vi.fn();
const updateSet = vi.fn();
const updateWhere = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      showcases: { findMany: (...args: any[]) => findManyShowcases(...args) },
    },
    update: () => ({
      set: (vals: any) => {
        updateSet(vals);
        return { where: (...args: any[]) => { updateWhere(...args); return Promise.resolve(undefined); } };
      },
    }),
  },
}));

import { GET, POST } from "../route";

const SECRET = "test-admin-secret";

function makeGetRequest(auth?: string) {
  return new Request("http://localhost/api/admin/flagged-showcases", {
    headers: auth ? { authorization: auth } : {},
  });
}

function makePostRequest(body: unknown, auth?: string) {
  return new Request("http://localhost/api/admin/flagged-showcases", {
    method: "POST",
    headers: { ...(auth ? { authorization: auth } : {}), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/admin/flagged-showcases", () => {
  const originalSecret = process.env.ADMIN_SECRET;

  beforeEach(() => {
    findManyShowcases.mockReset();
    updateSet.mockReset();
    updateWhere.mockReset();
    process.env.ADMIN_SECRET = SECRET;
  });

  afterAll(() => {
    process.env.ADMIN_SECRET = originalSecret;
  });

  it("GET rejects an unauthorized request", async () => {
    const res = await GET(makeGetRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("GET lists flagged showcases for a valid admin secret", async () => {
    findManyShowcases.mockResolvedValue([
      { slug: "s1", title: "T1", flagReason: "spam", visibility: "public", project: { name: "T1" } },
    ]);

    const res = await GET(makeGetRequest(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.showcases).toHaveLength(1);
    expect(body.showcases[0].slug).toBe("s1");
  });

  it("POST rejects an unauthorized request", async () => {
    const res = await POST(makePostRequest({ slug: "s1", action: "dismiss" }, "Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("POST unpublish sets visibility=private and clears flagged", async () => {
    const res = await POST(makePostRequest({ slug: "s1", action: "unpublish" }, `Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ flagged: false, visibility: "private" }));
  });

  it("POST dismiss clears flagged only, without touching visibility", async () => {
    const res = await POST(makePostRequest({ slug: "s1", action: "dismiss" }, `Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    const setArg = updateSet.mock.calls[0][0];
    expect(setArg.flagged).toBe(false);
    expect(setArg.visibility).toBeUndefined();
  });

  it("POST rejects an invalid action", async () => {
    const res = await POST(makePostRequest({ slug: "s1", action: "bogus" }, `Bearer ${SECRET}`));
    expect(res.status).toBe(400);
  });
});
