import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({ getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })) }));

const findFirstProjects = vi.fn();
const findManyLocations = vi.fn();
const insertReturning = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      locations: { findMany: (...args: any[]) => findManyLocations(...args) },
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

describe("POST /api/projects/[projectId]/locations — duplicate detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    insertReturning.mockResolvedValue([{ id: "new-loc", name: "The Old Mill" }]);
  });

  it("includes similarEntities in the response when a near-duplicate location exists", async () => {
    generateEmbedding.mockResolvedValue([1, 0]);
    findManyLocations.mockResolvedValue([{ id: "existing-loc", name: "Old Mill", embedding: [1, 0] }]);

    const res = await POST(makeRequest({ name: "The Old Mill", description: "Abandoned" }), makeParams());
    const body = await res.json();

    expect(body.similarEntities).toEqual([{ id: "existing-loc", name: "Old Mill", similarity: 1 }]);
  });
});
