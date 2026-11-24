import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Phase 2 / v4 §7 — thin adapter route tests for story-memories (the
 * plot-threads route-test idiom): mocks @/db + auth; the adapter's own
 * behaviour under test is the request-shape passthrough, the preserved bare
 * bodies, the fact-400 ordering, and 404-before-parse.
 */
const findFirstProjects = vi.fn();
const findManyMemories = vi.fn();
const insertReturning = vi.fn();
const insertCaptures: Array<{ table: unknown; payload: unknown }> = [];
const updateCaptures: Array<{ table: unknown; payload: unknown }> = [];

vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      storyMemories: { findMany: (...args: any[]) => findManyMemories(...args) },
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
import { projects, storyMemories } from "@/db/schema";

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
  findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
  insertCaptures.length = 0;
  updateCaptures.length = 0;
});

describe("GET /api/projects/[projectId]/story-memories", () => {
  it("returns the BARE array (the pre-migration shape), newest first via the port", async () => {
    const memories = [{ id: "m1", projectId: "proj-1", fact: "Kessler never bluffs" }];
    findManyMemories.mockResolvedValue(memories);

    const res = await GET(makeRequest("", "GET"), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(memories);
    expect(findManyMemories).toHaveBeenCalledTimes(1);
  });

  it("404s on a non-owned project without listing", async () => {
    findFirstProjects.mockResolvedValue(undefined);

    const res = await GET(makeRequest("", "GET"), makeParams());

    expect(res.status).toBe(404);
    expect(findManyMemories).not.toHaveBeenCalled();
  });
});

describe("POST /api/projects/[projectId]/story-memories", () => {
  it("creates a bare row with category/structuredData passthrough and one revision bump", async () => {
    const created = { id: "m1", projectId: "proj-1", fact: "The ride loops" };
    insertReturning.mockResolvedValue([created]);

    const res = await POST(
      makeRequest({ fact: "The ride loops", category: "world", structuredData: null }),
      makeParams(),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(created);
    expect(insertCaptures[0]!.table).toBe(storyMemories);
    expect(insertCaptures[0]!.payload).toMatchObject({
      projectId: "proj-1",
      category: "world",
      autoExtracted: false,
      structuredData: null,
    });

    const bumps = updateCaptures.filter(
      (c) => c.table === projects && "contentRevision" in (c.payload as Record<string, unknown>),
    );
    expect(bumps).toHaveLength(1);
  });

  it("400s 'fact required' (after ownership) without inserting", async () => {
    const res = await POST(makeRequest({ fact: "   " }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "fact required" });
    expect(insertCaptures).toHaveLength(0);
    expect(findFirstProjects).toHaveBeenCalledTimes(1);
  });

  it("404s BEFORE the body is parsed when the project belongs to someone else", async () => {
    findFirstProjects.mockResolvedValue(undefined);

    const res = await POST(makeRequest("not-json"), makeParams());

    expect(res.status).toBe(404);
    expect(insertCaptures).toHaveLength(0);
  });
});

describe("DELETE /api/projects/[projectId]/story-memories", () => {
  it("keeps the silent-zero-match { ok: true } shape", async () => {
    const res = await DELETE(makeRequest({ memoryId: "bogus" }, "DELETE"), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it("404s on a non-owned project", async () => {
    findFirstProjects.mockResolvedValue(undefined);

    const res = await DELETE(makeRequest({ memoryId: "m1" }, "DELETE"), makeParams());

    expect(res.status).toBe(404);
  });
});
