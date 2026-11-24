import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET/PATCH/DELETE /api/projects/[projectId] — thin adapter route tests.
 * Mocks @/db + auth (the chapters route-test idiom): the adapter route's own
 * behavior under test is the full-graph GET passthrough (payload pinned),
 * the 404 mappings, the preserved aiRules-400 edge guard, the PATCH
 * density/updatedAt handling, and the `{ok:true}` DELETE body.
 */
const findFirstProjects = vi.fn();
const updateReturning = vi.fn();
const updateSet = vi.fn();
const deleteWhere = vi.fn(async () => undefined);

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/db", () => ({
  db: {
    query: { projects: { findFirst: (...args: any[]) => findFirstProjects(...args) } },
    update: () => ({
      set: (payload: unknown) => {
        updateSet(payload);
        return { where: () => ({ returning: (...args: any[]) => updateReturning(...args) }) };
      },
    }),
    delete: () => ({ where: () => deleteWhere() }),
  },
}));

const { GET, PATCH, DELETE } = await import("../route");

function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1" }) };
}
const noopRequest = (): Request => new Request("http://localhost", { method: "GET" });
function makePatch(body: unknown) {
  return new Request("http://localhost", { method: "PATCH", body: JSON.stringify(body) });
}

/** The full-graph read payload shape the pre-migration GET returned — pinned. */
const GRAPH_ROW = {
  id: "proj-1",
  userId: "user-1",
  name: "My Story",
  chapters: [{ id: "c1", projectId: "proj-1", title: "Chapter 1", sortOrder: 0 }],
  characters: [{ id: "ch1", projectId: "proj-1", name: "Ana" }],
  locations: [],
  plotThreads: [],
  worldEntities: [],
  referenceWorks: [],
  storyMemories: [],
  characterRelationships: [],
  storyPromises: [],
};

describe("GET /api/projects/[projectId] (thin adapter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("200s the FULL graph row, never simplified (payload pinned)", async () => {
    findFirstProjects.mockResolvedValue(GRAPH_ROW);

    const res = await GET(noopRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(GRAPH_ROW);
    for (const key of [
      "chapters",
      "characters",
      "locations",
      "plotThreads",
      "worldEntities",
      "referenceWorks",
      "storyMemories",
      "characterRelationships",
      "storyPromises",
    ]) {
      expect(key in body).toBe(true);
    }
  });

  it("404s with { error: 'Not found' } when the project belongs to someone else", async () => {
    findFirstProjects.mockResolvedValue(undefined);

    const res = await GET(noopRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Not found" });
  });
});

describe("PATCH /api/projects/[projectId] (thin adapter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    updateReturning.mockResolvedValue([{ id: "proj-1", userId: "user-1", name: "New" }]);
  });

  it("200s the updated row and passes a server-approved set (density normalized, updatedAt stamped)", async () => {
    const res = await PATCH(makePatch({ name: "New", densityLevel: "simple" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ id: "proj-1", userId: "user-1", name: "New" });
    const set = updateSet.mock.calls[0]![0] as Record<string, unknown>;
    expect(set.densityLevel).toBe("simple");
    expect(set.updatedAt).toBeInstanceOf(Date);
  });

  it("400s 'Invalid aiRules shape.' at the edge — the guard stays exactly where it lived", async () => {
    const res = await PATCH(makePatch({ aiRules: [{ id: "r1" }] }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Invalid aiRules shape." });
    expect(updateReturning).not.toHaveBeenCalled();
  });

  it("404s with { error: 'Not found' } when the scoped write matched no row", async () => {
    updateReturning.mockResolvedValue([]);

    const res = await PATCH(makePatch({ name: "New" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Not found" });
  });
});

describe("DELETE /api/projects/[projectId] (thin adapter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
  });

  it("200s { ok: true } after deleting", async () => {
    const res = await DELETE(noopRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(deleteWhere).toHaveBeenCalledTimes(1);
  });
});
