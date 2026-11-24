import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Phase 2 / v4 §7 — thin adapter route test for the story-graph health probe.
 * The handler/adapter split puts only auth + response shaping here, so the
 * route test pins the `{...graph, health, contextTrimmed}` body and the
 * refusals — the graph math itself is covered by the core CRUD suite.
 */
const findFirstProjects = vi.fn();
const findManyRelationships = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      characterRelationships: { findMany: (...args: any[]) => findManyRelationships(...args) },
    },
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const { GET } = await import("../route");

function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1" }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  findFirstProjects.mockResolvedValue({
    id: "proj-1",
    userId: "user-1",
    title: "The Dealer",
    characters: [],
    locations: [],
    plotThreads: [],
    chapters: [],
    worldEntities: [],
  });
  findManyRelationships.mockResolvedValue([]);
});

describe("GET /api/projects/[projectId]/story-graph", () => {
  it("spreads the graph with health + contextTrimmed (the pre-migration body shape)", async () => {
    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("nodes");
    expect(body).toHaveProperty("edges");
    expect(body.health).toHaveProperty("score");
    expect(body.health).toHaveProperty("issues");
    expect(typeof body.contextTrimmed).toBe("boolean");
    expect(findManyRelationships).toHaveBeenCalledTimes(1);
  });

  it("404s on a non-owned project without building the graph", async () => {
    findFirstProjects.mockResolvedValue(undefined);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(404);
    expect(findManyRelationships).not.toHaveBeenCalled();
  });
});

function makeRequest() {
  return new Request("http://localhost", { method: "GET" });
}
