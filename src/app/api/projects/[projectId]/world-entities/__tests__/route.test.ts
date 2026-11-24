import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({ getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })) }));

const findFirstProjects = vi.fn();
const findManyWorldEntities = vi.fn();
const insertReturning = vi.fn();
const insertValues = vi.fn();
const updateSet = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      worldEntities: { findMany: (...args: any[]) => findManyWorldEntities(...args) },
    },
    // The §11 revision hook (pgPostCommitHooks) fires an update on `projects`
    // after every canonical mutation — it needs a chain to resolve against.
    update: (_table: unknown) => ({
      set: (vals: unknown) => {
        updateSet(vals);
        return { where: () => Promise.resolve(undefined) };
      },
    }),
    insert: (_table: unknown) => ({
      values: (vals: unknown) => {
        insertValues(vals);
        return { returning: (...args: any[]) => insertReturning(...args) };
      },
    }),
  },
}));

const generateEmbedding = vi.fn();
function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return magA && magB ? dot / (magA * magB) : 0;
}
vi.mock("@/lib/ai/embeddings", () => ({
  generateEmbedding: (...args: any[]) => generateEmbedding(...args),
  cosineSimilarity,
}));

const { GET, POST } = await import("../route");

function makeRequest(body: unknown, init: RequestInit = {}) {
  return new Request("http://localhost", { method: "POST", body: JSON.stringify(body), ...init });
}
function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1" }) };
}

describe("POST /api/projects/[projectId]/world-entities — duplicate detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    insertReturning.mockResolvedValue([{ id: "new-entity", name: "The Ring", kind: "object" }]);
  });

  it("scopes the similarity check to entities of the same kind", async () => {
    generateEmbedding.mockResolvedValue([1, 0]);
    findManyWorldEntities.mockResolvedValue([{ id: "existing-entity", name: "The Cursed Ring", embedding: [1, 0] }]);

    const res = await POST(makeRequest({ name: "The Ring", kind: "object", summary: "A cursed ring" }), makeParams());
    const body = await res.json();

    expect(body.similarEntities).toEqual([{ id: "existing-entity", name: "The Cursed Ring", similarity: 1 }]);
    expect(findManyWorldEntities.mock.calls[0][0].where).toBeDefined();
  });
});

/**
 * Phase 2 / v4 §7 — the route became a thin AUTH ADAPTER around the shared
 * `createWorldEntity`/`listWorldEntities` handlers. These tests pin the
 * transport-edge behavior that stayed here and the response bodies that must
 * remain byte-comparable to the pre-migration route.
 */
describe("POST /api/projects/[projectId]/world-entities — adapter pinning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    insertReturning.mockResolvedValue([{ id: "new-entity", name: "The Ring", kind: "object" }]);
  });

  it("still 400s 'name is required' and 'invalid properties' BEFORE touching the db", async () => {
    const missingName = await POST(makeRequest({ properties: {} }), makeParams());
    expect(missingName.status).toBe(400);
    expect(await missingName.json()).toEqual({ error: "name is required" });
    expect(insertReturning).not.toHaveBeenCalled();

    // Only a non-object properties value throws (each FIELD `catch`es itself,
    // so a malformed field is dropped, never fatal — same as pre-migration).
    const badProps = await POST(makeRequest({ name: "X", properties: "nope" }), makeParams());
    expect(badProps.status).toBe(400);
    expect(await badProps.json()).toEqual({ error: "invalid properties" });
  });

  it("normalizes a bogus kind through WorldEntityKindSchema ('spaceship' → 'object')", async () => {
    generateEmbedding.mockRejectedValue(new Error("embeddings down"));
    const res = await POST(makeRequest({ name: "The Ring", kind: "spaceship" }), makeParams());
    expect(res.status).toBe(201);
    expect(insertValues.mock.calls[0][0].kind).toBe("object");
  });

  it("insert applies the pre-migration column defaults and the embedding seam stays live", async () => {
    generateEmbedding.mockResolvedValue([0.5, 0.5]);
    const res = await POST(
      makeRequest({ name: "The Ring", linkedCharacterIds: ["c1"] }),
      makeParams(),
    );
    expect(res.status).toBe(201);
    const values = insertValues.mock.calls[0][0];
    expect(values).toMatchObject({
      name: "The Ring",
      summary: "",
      description: "",
      properties: {},
      linkedCharacterIds: ["c1"],
      linkedLocationIds: [],
      linkedPlotThreadIds: [],
      linkedEntityIds: [],
      alwaysInContext: false,
      sortOrder: 0,
      embedding: [0.5, 0.5],
    });
  });

  it("404s a non-owner with 'Not found' and 403-reasons stay out of the legacy-cloud path", async () => {
    findFirstProjects.mockResolvedValue(null);
    const res = await POST(makeRequest({ name: "The Ring" }), makeParams());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
    expect(insertReturning).not.toHaveBeenCalled();
  });
});

describe("GET /api/projects/[projectId]/world-entities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
  });

  it("404s a non-owner with the same 'Not found' body", async () => {
    findFirstProjects.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), makeParams());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });

  it("returns the scoped rows ordered by (kind, sortOrder) — the same listing contract", async () => {
    findManyWorldEntities.mockResolvedValue([
      { id: "e1", kind: "faction", name: "Order" },
      { id: "e2", kind: "object", name: "Ring" },
    ]);
    const res = await GET(new Request("http://localhost"), makeParams());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { id: "e1", kind: "faction", name: "Order" },
      { id: "e2", kind: "object", name: "Ring" },
    ]);
    // Handler → adapter: (kind, sortOrder) ordering is carried by the adapter.
    expect(findManyWorldEntities.mock.calls[0][0].orderBy).toBeDefined();
  });
});
