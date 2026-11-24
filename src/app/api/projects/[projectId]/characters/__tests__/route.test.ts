import { describe, it, expect, vi, beforeEach } from "vitest";
import { characters, projects } from "@/db/schema";

vi.mock("@/lib/auth-helpers", () => ({ getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })) }));
const bootstrapSpy = vi.fn(async (_char: unknown, _genre: unknown, _format: unknown) => ({}));
vi.mock("@/lib/ai/engine", () => ({
  bootstrapCharacterIntelligence: (c: unknown, g: unknown, f: unknown) => bootstrapSpy(c, g, f),
}));

const findFirstProjects = vi.fn();
const findManyCharacters = vi.fn();
const insertReturning = vi.fn();
const insertTables: unknown[] = [];
const insertValues: unknown[] = [];
const updateSetCalls: { table: unknown; payload: unknown }[] = [];
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      characters: { findMany: (...args: any[]) => findManyCharacters(...args) },
    },
    insert: (table: unknown) => {
      insertTables.push(table);
      return {
        values: (v: unknown) => {
          insertValues.push(v);
          return { returning: (...args: any[]) => insertReturning(...args) };
        },
      };
    },
    update: (table: unknown) => ({
      set: (payload: unknown) => {
        updateSetCalls.push({ table, payload });
        return { where: () => Promise.resolve(undefined) };
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

const { POST } = await import("../route");

function makeRequest(body: unknown) {
  return new Request("http://localhost", { method: "POST", body: JSON.stringify(body) });
}
function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1" }) };
}
const revisionBumpCalls = () =>
  updateSetCalls.filter(
    (c) =>
      c.table === projects &&
      typeof (c.payload as Record<string, unknown>).contentRevision === "object",
  );

describe("POST /api/projects/[projectId]/characters — duplicate detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertTables.length = 0;
    insertValues.length = 0;
    updateSetCalls.length = 0;
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1", format: "Novel" });
    insertReturning.mockResolvedValue([{ id: "new-char", name: "Sarah", role: "Protagonist" }]);
  });

  it("includes similarEntities in the response when a near-duplicate exists", async () => {
    generateEmbedding.mockResolvedValue([1, 0]);
    findManyCharacters.mockResolvedValue([{ id: "existing-char", name: "Sara", embedding: [1, 0] }]);

    const res = await POST(makeRequest({ name: "Sarah", role: "Protagonist" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.similarEntities).toEqual([{ id: "existing-char", name: "Sara", similarity: 1 }]);
  });

  it("returns an empty similarEntities array when nothing matches", async () => {
    generateEmbedding.mockResolvedValue([1, 0]);
    findManyCharacters.mockResolvedValue([{ id: "existing-char", name: "Totally Different", embedding: [0, 1] }]);

    const res = await POST(makeRequest({ name: "Sarah" }), makeParams());
    const body = await res.json();

    expect(body.similarEntities).toEqual([]);
  });

  it("skips the similarity check entirely (fail-open) when embedding generation returns null", async () => {
    generateEmbedding.mockResolvedValue(null);

    const res = await POST(makeRequest({ name: "Sarah" }), makeParams());
    const body = await res.json();

    expect(body.similarEntities).toEqual([]);
    expect(findManyCharacters).not.toHaveBeenCalled();
  });

  // ---- thin-adapter migration additions (behavior preservation + §11) ----

  it("regression — the INSERT carries the URL's projectId even though the body never includes it", async () => {
    generateEmbedding.mockResolvedValue(null);
    findManyCharacters.mockResolvedValue([]);

    const res = await POST(makeRequest({ name: "Sarah" }), makeParams());

    expect(res.status).toBe(201);
    expect(insertValues).toHaveLength(1);
    const values = insertValues[0] as Record<string, unknown>;
    // The scoped-write invariant the adapter must reproduce for every create:
    // without projectId in the INSERT the row hits the column's NOT NULL/FK
    // constraint and a real 500 replaces the 201.
    expect(values.projectId).toBe("proj-1");
    expect(values.name).toBe("Sarah");
    expect(values.embedding).toBeNull();
  });

  it("404 — unknown project probes ownership before the body is ever read", async () => {
    findFirstProjects.mockResolvedValue(null);

    const res = await POST(makeRequest({ name: "Sarah" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Not found" });
    expect(insertTables).toEqual([]);
    expect(findManyCharacters).not.toHaveBeenCalled();
  });

  it("400 — missing name on an owned project never inserts a row", async () => {
    const res = await POST(makeRequest({ role: "Protagonist" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "name is required" });
    expect(insertTables).toEqual([]);
  });

  it("400 — non-string name rejected with the transport body", async () => {
    const res = await POST(makeRequest({ name: 42 }), makeParams());

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("name is required");
  });

  it("§11 — a real pgPostCommitHooks revision bump fires after the insert (never before)", async () => {
    generateEmbedding.mockResolvedValue(null);
    findManyCharacters.mockResolvedValue([]);

    const res = await POST(makeRequest({ name: "Sarah" }), makeParams());

    expect(res.status).toBe(201);
    expect(insertTables).toEqual([characters]);
    expect(revisionBumpCalls()).toHaveLength(1);
    expect(updateSetCalls[0].table).toBe(projects);
    expect(typeof (updateSetCalls[0].payload as Record<string, unknown>).contentRevision).toBe("object");
    expect(updateSetCalls).toHaveLength(1);
  });

  it("bootstrap — the fire-and-forget post-create side effect receives the row and project format", async () => {
    generateEmbedding.mockResolvedValue(null);
    findManyCharacters.mockResolvedValue([]);

    const res = await POST(makeRequest({ name: "Sarah", role: "Protagonist" }), makeParams());

    expect(res.status).toBe(201);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(bootstrapSpy).toHaveBeenCalledTimes(1);
    const [char, genre, format] = bootstrapSpy.mock.calls[0];
    expect(char).toEqual({ name: "Sarah", role: "Protagonist", age: "", personality: "" });
    expect(genre).toBe("");
    expect(format).toBe("Novel");
    // Empty intelligence writes nothing via the update path.
    expect(updateSetCalls).toHaveLength(1); // only the §11 revision bump
  });

  it("bootstrap failure — surfaces only in logs and the 201 still returns", async () => {
    bootstrapSpy.mockImplementation(async () => {
      throw new Error("claude down");
    });
    generateEmbedding.mockResolvedValue(null);
    findManyCharacters.mockResolvedValue([]);

    const res = await POST(makeRequest({ name: "Sarah" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(typeof body.similarEntities).toBe("object");
    expect(Array.isArray(body.similarEntities)).toBe(true);
  });
});
