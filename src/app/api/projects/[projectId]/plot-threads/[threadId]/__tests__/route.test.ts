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
const deleteWhere = vi.fn(async (table: any, ...args: any[]) => undefined);
const deleteTables: unknown[] = [];
// Additive (2026-10 thin-adapter migration): lets a test control what the
// scoped UPDATE's .returning() yields — [] models a threadId that matches no
// row in this project; null override keeps the chain's original row shape.
let updateReturningOverride: (() => unknown) | null = null;

function makeUpdateChain(table: any, setValues: any) {
  updateSet(table, setValues);
  return {
    where: () => ({
      returning: () =>
        Promise.resolve(
          updateReturningOverride
            ? updateReturningOverride()
            : [{ id: "thread-1", projectId: "proj-1", ...setValues }],
        ),
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
    // Additive: the migration routes DELETE through the shared handler, which
    // needs a project-scoped db.delete + (post-delete) revision update.
    delete: (table: any) => {
      deleteTables.push(table);
      return { where: (...args: any[]) => deleteWhere(table, ...args) };
    },
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

import { PATCH, DELETE } from "../route";
import { plotThreads, projects } from "@/db/schema";

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

describe("thin-adapter migration (2026-10) — PATCH miss + DELETE paths", () => {
  beforeEach(() => {
    findFirstProjects.mockReset();
    updateSet.mockReset();
    deleteWhere.mockClear();
    deleteTables.length = 0;
    updateReturningOverride = null;
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
  });

  it("PATCH 404s { error: 'Not found' } when the scoped update matched no row, and skips the revision hook", async () => {
    // Regression: pre-migration the PATCH route dead-ended in
    // NextResponse.json(undefined) when threadId belonged to the caller's
    // own project but matched nothing in it — a broken body instead of a 404.
    updateReturningOverride = () => [];
    const res = await PATCH(makeRequest({ name: "x" }), {
      params: Promise.resolve({ projectId: "proj-1", threadId: "thread-1" }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
    // No §11 bump fired on the refused path: the ONLY update seen is the
    // thread write itself.
    expect(updateSet.mock.calls.map((c) => c[0])).toEqual([plotThreads]);
  });

  it("DELETE 200s { ok: true }, deletes scoped on plotThreads, and bumps the revision after", async () => {
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), {
      params: Promise.resolve({ projectId: "proj-1", threadId: "thread-1" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(deleteTables).toEqual([plotThreads]);
    expect(deleteWhere).toHaveBeenCalledTimes(1);
    const bumps = updateSet.mock.calls.filter(
      (c) => c[0] === projects && "contentRevision" in (c[1] as object),
    );
    expect(bumps).toHaveLength(1);
  });

  it("DELETE 404s { error: 'Not found' } on a foreign project — no delete, no revision bump", async () => {
    findFirstProjects.mockReset();
    findFirstProjects.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), {
      params: Promise.resolve({ projectId: "proj-1", threadId: "thread-1" }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
    expect(deleteTables).toHaveLength(0);
    expect(updateSet).not.toHaveBeenCalled();
  });
});
