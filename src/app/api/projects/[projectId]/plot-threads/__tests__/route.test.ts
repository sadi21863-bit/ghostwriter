import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/projects/[projectId]/plot-threads — thin adapter route tests.
 * Mocks @/db + auth (the chapters route-test idiom): the adapter route's own
 * behavior under test is the request shape passthrough, the preserved
 * bare-row 201 body, and the not-found/name-400 mappings.
 */
const findFirstProjects = vi.fn();
const insertReturning = vi.fn();

const insertCaptures: Array<{ table: unknown; payload: unknown }> = [];
const updateCaptures: Array<{ table: unknown; payload: unknown }> = [];

vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: unknown[]) => findFirstProjects(...args) },
    },
    insert: (table: unknown) => ({
      values: (payload: unknown) => {
        insertCaptures.push({ table, payload });
        return { returning: (...args: unknown[]) => insertReturning(...args) };
      },
    }),
    update: (table: unknown) => ({
      set: (payload: unknown) => {
        updateCaptures.push({ table, payload });
        return { where: async () => undefined };
      },
    }),
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

import { POST } from "../route";
import { plotThreads, projects } from "@/db/schema";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/projects/proj-1/plot-threads", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1" }) };
}

describe("POST /api/projects/[projectId]/plot-threads (thin adapter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    insertReturning.mockResolvedValue([]);
    insertCaptures.length = 0;
    updateCaptures.length = 0;
  });

  it("201s the created thread as a BARE row (the pre-migration shape) and bumps the revision post-insert", async () => {
    const created = { id: "thread-9", projectId: "proj-1", name: "Red Line", status: "Active" };
    insertReturning.mockResolvedValue([created]);

    const res = await POST(makeRequest({ name: "Red Line" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual(created);
    expect(body).not.toHaveProperty("thread");

    expect(insertCaptures).toHaveLength(1);
    expect(insertCaptures[0]!.table).toBe(plotThreads);
    expect(insertCaptures[0]!.payload).toMatchObject({ projectId: "proj-1", name: "Red Line" });

    // §11: exactly one canonical-mutation bump on the projects table.
    const bumps = updateCaptures.filter(
      (c) => c.table === projects && "contentRevision" in (c.payload as Record<string, unknown>),
    );
    expect(bumps).toHaveLength(1);
  });

  it("404s with { error: 'Not found' } when the project belongs to someone else, inserting nothing", async () => {
    findFirstProjects.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ name: "Red Line" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Not found" });
    expect(insertCaptures).toHaveLength(0);
    expect(updateCaptures).toHaveLength(0);
  });

  it("400s 'name is required' at the route before any handler work", async () => {
    const res = await POST(makeRequest({ sortOrder: 7 }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "name is required" });
    expect(insertCaptures).toHaveLength(0);
    expect(updateCaptures).toHaveLength(0);
    expect(findFirstProjects).not.toHaveBeenCalled();
  });
});
