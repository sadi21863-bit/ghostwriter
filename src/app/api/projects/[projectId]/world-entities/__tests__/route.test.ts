import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({ getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })) }));

const findFirstProjects = vi.fn();
const findManyWorldEntities = vi.fn();
const insertReturning = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      worldEntities: { findMany: (...args: any[]) => findManyWorldEntities(...args) },
    },
    insert: () => ({ values: () => ({ returning: (...args: any[]) => insertReturning(...args) }) }),
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
