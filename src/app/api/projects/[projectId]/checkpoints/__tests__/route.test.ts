import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Phase 2 / v4 §7 — thin adapter route tests for story checkpoints. The
 * body-parse-BEFORE-ownership order (the one deliberate inversion among the
 * migrated planning routes — preserved from the pre-migration route) and the
 * distinctive `{ success: true }` DELETE body are the pins that matter here;
 * the healthScore formula is covered by the core CRUD suite.
 */
const findFirstProjects = vi.fn();
const findManyCheckpoints = vi.fn();
const insertReturning = vi.fn();
const insertCaptures: Array<{ table: unknown; payload: unknown }> = [];
const updateCaptures: Array<{ table: unknown; payload: unknown }> = [];

vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      storyCheckpoints: { findMany: (...args: any[]) => findManyCheckpoints(...args) },
    },
    insert: (table: unknown) => ({
      values: (payload: unknown) => {
        insertCaptures.push({ table, payload });
        return { returning: (...args: any[]) => insertReturning(...args) };
      },
    }),
    update: (table: unknown) => ({
      set: (payload: unknown) => {
        updateCaptures.push({ table, payload });
        return { where: async () => undefined };
      },
    }),
    delete: (table: unknown) => ({
      where: async () => undefined,
    }),
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const { GET, POST, DELETE } = await import("../route");
import { projects, storyCheckpoints } from "@/db/schema";

function makeRequest(body: unknown, method = "POST") {
  const hasBody = typeof body === "string" ? body.length > 0 : body !== undefined;
  return new Request("http://localhost", {
    method,
    body: hasBody && method !== "GET" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });
}
function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1" }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  // The same findFirst mock serves BOTH the ownership probe and the health
  // read's project-with-relations query.
  findFirstProjects.mockResolvedValue({
    id: "proj-1",
    userId: "user-1",
    chapters: [{ id: "c1", title: "One", wordCount: 500, arcPosition: "setup" }],
    plotThreads: [{ id: "t1", status: "open", starvationWarning: false }],
    storyPromises: [{ id: "p1", status: "open" }],
  });
  findManyCheckpoints.mockResolvedValue([]);
  insertCaptures.length = 0;
  updateCaptures.length = 0;
});

describe("GET /api/projects/[projectId]/checkpoints", () => {
  it("returns { checkpoints } (the Promise Tracker's collapsed section shape)", async () => {
    const checkpoints = [{ id: "cp1", projectId: "proj-1", name: "Checkpoint" }];
    findManyCheckpoints.mockResolvedValue(checkpoints);

    const res = await GET(makeRequest("", "GET"), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ checkpoints });
  });

  it("404s on a non-owned project without listing", async () => {
    findFirstProjects.mockResolvedValue(undefined);

    const res = await GET(makeRequest("", "GET"), makeParams());

    expect(res.status).toBe(404);
    expect(findManyCheckpoints).not.toHaveBeenCalled();
  });
});

describe("POST /api/projects/[projectId]/checkpoints", () => {
  it("wraps the row as { checkpoint }, snapshots the health read, bumps the revision", async () => {
    const created = {
      id: "cp1",
      projectId: "proj-1",
      name: "Checkpoint — 10/20/2026",
      snapshot: { totalWordCount: 500, chapterCount: 1, openThreadCount: 1, openPromises: 1, healthScore: 100 },
    };
    insertReturning.mockResolvedValue([created]);

    const res = await POST(makeRequest({ name: "Checkpoint — 10/20/2026", notes: "mid-arc" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ checkpoint: created });
    expect(insertCaptures[0]!.table).toBe(storyCheckpoints);
    expect(insertCaptures[0]!.payload).toMatchObject({ projectId: "proj-1", notes: "mid-arc" });
    expect((insertCaptures[0]!.payload as Record<string, unknown>).snapshot).toMatchObject({
      totalWordCount: 500,
      chapterCount: 1,
      openThreadCount: 1,
      openPromises: 1,
      healthScore: 100,
    });

    const bumps = updateCaptures.filter(
      (c) => c.table === projects && "contentRevision" in (c.payload as Record<string, unknown>),
    );
    expect(bumps).toHaveLength(1);
  });

  it("404s on a non-owned project (the health read is never hit)", async () => {
    findFirstProjects.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ name: "x" }), makeParams());

    expect(res.status).toBe(404);
    expect(insertCaptures).toHaveLength(0);
  });
});

describe("DELETE /api/projects/[projectId]/checkpoints", () => {
  it("keeps the distinctive { success: true } body", async () => {
    const res = await DELETE(makeRequest({ checkpointId: "cp1" }, "DELETE"), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
  });

  it("404s on a non-owned project", async () => {
    findFirstProjects.mockResolvedValue(undefined);

    const res = await DELETE(makeRequest({ checkpointId: "cp1" }, "DELETE"), makeParams());

    expect(res.status).toBe(404);
  });
});
