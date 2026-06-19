// Regression test for the launch-blocking Story Bible save bug (2026-06-20):
// StoryBible.tsx's and WorldBiblePanel.tsx's plot-thread status dropdown only
// ever offers "Active" / "Simmering" / "Resolved", but the PATCH route's zod
// schema only accepted "Active" / "Resolved" / "Dormant" — a thread with
// status "Simmering" failed safeParse as a WHOLE, so saving ANY field
// (including a simultaneous name edit) silently 400'd, with the client never
// checking res.ok. This exercises the real exported PATCH handler end-to-end
// (mocking only auth/db) to lock in that "Simmering" + a name change persists.
import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirstProjects = vi.fn();
const updateSet = vi.fn();

function makeUpdateChain(table: any, setValues: any) {
  updateSet(table, setValues);
  return {
    where: () => ({
      returning: () => Promise.resolve([{ id: "thread-1", projectId: "proj-1", ...setValues }]),
    }),
  };
}

vi.mock("@/db", () => ({
  db: {
    query: {
      projects: {
        findFirst: (...args: any[]) => findFirstProjects(...args),
      },
    },
    update: (table: any) => ({ set: (vals: any) => makeUpdateChain(table, vals) }),
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

import { PATCH } from "../route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/projects/proj-1/plot-threads/thread-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/projects/[projectId]/plot-threads/[threadId]", () => {
  beforeEach(() => {
    findFirstProjects.mockReset();
    updateSet.mockReset();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
  });

  it("accepts status: Simmering alongside a name edit (previously 400'd)", async () => {
    const res = await PATCH(makeRequest({ name: "The Heist Tightens", status: "Simmering" }), {
      params: Promise.resolve({ projectId: "proj-1", threadId: "thread-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("The Heist Tightens");
    expect(body.status).toBe("Simmering");
  });

  it("still rejects a genuinely invalid status", async () => {
    const res = await PATCH(makeRequest({ status: "NotARealStatus" }), {
      params: Promise.resolve({ projectId: "proj-1", threadId: "thread-1" }),
    });
    expect(res.status).toBe(400);
  });
});
