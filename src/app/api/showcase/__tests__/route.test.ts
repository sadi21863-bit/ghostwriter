import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyShowcases = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      showcases: { findMany: (...args: any[]) => findManyShowcases(...args) },
    },
  },
}));

const generateEmbedding = vi.fn();
const cosineSimilarity = vi.fn();
vi.mock("@/lib/ai/embeddings", () => ({
  generateEmbedding: (...args: any[]) => generateEmbedding(...args),
  cosineSimilarity: (...args: any[]) => cosineSimilarity(...args),
}));

import { GET } from "../route";

function makeRequest(cursor?: string) {
  const url = cursor ? `http://localhost/api/showcase?cursor=${cursor}` : "http://localhost/api/showcase";
  return new Request(url);
}
function makeSearchRequest(q: string) {
  return new Request(`http://localhost/api/showcase?q=${encodeURIComponent(q)}`);
}

describe("GET /api/showcase (public discovery feed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries only visibility=public AND flagged=false, ordered newest first", async () => {
    findManyShowcases.mockResolvedValue([]);

    await GET(makeRequest());

    const callArgs = findManyShowcases.mock.calls[0][0];
    expect(callArgs.where).toBeDefined();
    expect(callArgs.orderBy).toBeDefined();
  });

  it("returns nextCursor=null when fewer than a full page comes back", async () => {
    findManyShowcases.mockResolvedValue([
      { slug: "a", title: "A", blurb: "b", project: { name: "A", format: "Novel" } },
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.showcases).toHaveLength(1);
    expect(body.nextCursor).toBeNull();
  });

  it("returns a nextCursor when a full page-plus-one comes back, and trims to page size", async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({
      slug: `s${i}`, title: `T${i}`, blurb: "b", project: { name: `T${i}`, format: "Novel" },
    }));
    findManyShowcases.mockResolvedValue(rows);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.showcases).toHaveLength(20);
    expect(body.nextCursor).toBe(20);
  });

  it("passes the cursor through as the offset", async () => {
    findManyShowcases.mockResolvedValue([]);

    await GET(makeRequest("40"));

    const callArgs = findManyShowcases.mock.calls[0][0];
    expect(callArgs.offset).toBe(40);
  });
});

describe("GET /api/showcase?q= (semantic search)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ranks results by cosine similarity to the query, descending", async () => {
    generateEmbedding.mockResolvedValue([1, 0]);
    findManyShowcases.mockResolvedValue([
      { slug: "low", title: "Low match", blurb: "b", embedding: [0, 1], project: { name: "Low", format: "Novel" } },
      { slug: "high", title: "High match", blurb: "b", embedding: [1, 0], project: { name: "High", format: "Novel" } },
    ]);
    cosineSimilarity.mockImplementation((_q: number[], e: number[]) => (e[0] === 1 ? 0.9 : 0.1));

    const res = await GET(makeSearchRequest("a story about grief"));
    const body = await res.json();

    expect(body.showcases.map((s: any) => s.slug)).toEqual(["high", "low"]);
    expect(body.nextCursor).toBeNull();
  });

  it("only searches public, unflagged, embedded showcases", async () => {
    generateEmbedding.mockResolvedValue([1, 0]);
    findManyShowcases.mockResolvedValue([]);

    await GET(makeSearchRequest("test"));

    const callArgs = findManyShowcases.mock.calls[0][0];
    expect(callArgs.where).toBeDefined();
    expect(callArgs.orderBy).toBeUndefined(); // search mode ranks by similarity, not createdAt
  });

  it("returns an empty result set (fail-open) when embedding generation fails", async () => {
    generateEmbedding.mockResolvedValue(null);

    const res = await GET(makeSearchRequest("test"));
    const body = await res.json();

    expect(body.showcases).toEqual([]);
    expect(findManyShowcases).not.toHaveBeenCalled();
  });
});
