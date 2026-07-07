import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({ getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })) }));
vi.mock("@/lib/ai/engine", () => ({ bootstrapCharacterIntelligence: vi.fn(async () => ({})) }));

const findFirstProjects = vi.fn();
const findManyCharacters = vi.fn();
const insertReturning = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      characters: { findMany: (...args: any[]) => findManyCharacters(...args) },
    },
    insert: () => ({ values: () => ({ returning: (...args: any[]) => insertReturning(...args) }) }),
    update: () => ({ set: () => ({ where: () => Promise.resolve(undefined) }) }),
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

describe("POST /api/projects/[projectId]/characters — duplicate detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1", format: "Novel" });
    insertReturning.mockResolvedValue([{ id: "new-char", name: "Sarah", role: "Protagonist" }]);
  });

  it("includes similarEntities in the response when a near-duplicate exists", async () => {
    generateEmbedding.mockResolvedValue([1, 0]);
    findManyCharacters.mockResolvedValue([{ id: "existing-char", name: "Sara", embedding: [1, 0] }]);

    const res = await POST(makeRequest({ name: "Sarah", role: "Protagonist" }), makeParams());
    const body = await res.json();

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
});
