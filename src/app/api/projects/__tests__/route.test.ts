import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET/POST /api/projects — thin adapter route tests.
 * Mocks @/db + auth + tier helper (the plot-threads route-test idiom): the
 * adapter route's own behavior under test is the bare-array GET passthrough,
 * the preserved bare-row 201 body, the tier-cap 403 body, and the create
 * defaulting + inserted payload shapes.
 */
const findManyProjects = vi.fn();
const insertCaptures: Array<{ table: unknown; payload: unknown }> = [];
const insertReturning = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findMany: (...args: unknown[]) => findManyProjects(...args) },
    },
    insert: (table: unknown) => ({
      values: (payload: unknown) => {
        insertCaptures.push({ table, payload });
        return { returning: async () => insertReturning() };
      },
    }),
    update: () => ({
      set: () => ({ where: async () => undefined }),
    }),
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const getUserTier = vi.fn();
vi.mock("@/lib/subscription", () => ({
  getUserTier: (...args: unknown[]) => getUserTier(...args),
}));

const track = vi.fn(async () => {});
vi.mock("@/lib/analytics", () => ({
  // any[] spread: `track(...args)` against a non-rest 3-param signature needs a
  // tuple type — `unknown[]` triggers TS2556 (the `(...args: any[])` idiom the
  // sibling route tests use).
  track: (...args: any[]) => (track as (...a: any[]) => Promise<void>)(...args),
}));

import { GET, POST } from "../route";
import { chapters, projects } from "@/db/schema";

describe("GET /api/projects (thin adapter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("200s the Bare rows from the repo query (the pre-migration body)", async () => {
    const rows = [
      {
        id: "p1",
        name: "Novel",
        format: "Novel",
        genres: [],
        updatedAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        skillLevel: "beginner",
        isHiggsfieldProject: false,
        universeId: null,
        chapters: [{ id: "c1", title: "Chapter 1", wordCount: 0, sortOrder: 0 }],
        characters: [{ id: "ch1", name: "Ana" }],
      },
    ];
    findManyProjects.mockResolvedValue(rows);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(rows); // bare array — never wrapped
    expect(findManyProjects).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/projects (thin adapter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserTier.mockResolvedValue("story_pro"); // unlimited → cap skipped
    findManyProjects.mockResolvedValue([]);
    insertCaptures.length = 0;
  });

  function makeRequest(body: unknown) {
    return new Request("http://localhost/api/projects", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  it("201s the created project as a BARE row, inserts project + Chapter 1, and tracks project_created", async () => {
    const created = {
      id: "p9",
      userId: "user-1",
      name: "My Story",
      format: "Screenplay",
      skillLevel: "beginner",
      genres: ["Thriller"],
      storyType: "linear",
      biggestChallenge: "",
    };
    insertReturning.mockResolvedValue([created]);

    const res = await POST(makeRequest({ name: "My Story", format: "Screenplay", genres: ["Thriller"] }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual(created); // bare row — the pre-migration shape
    expect(body).not.toHaveProperty("project");

    expect(insertCaptures).toHaveLength(2);
    expect(insertCaptures[0]!.table).toBe(projects);
    expect(insertCaptures[0]!.payload).toMatchObject({
      userId: "user-1",
      name: "My Story",
      format: "Screenplay",
      skillLevel: "beginner",
      genres: ["Thriller"],
      storyType: "linear",
      biggestChallenge: "",
    });
    expect(insertCaptures[1]!.table).toBe(chapters);
    expect(insertCaptures[1]!.payload).toEqual({
      projectId: "p9",
      title: "Chapter 1",
      sortOrder: 0,
    });

    // The pre-migration route awaited `track` after both inserts — preserved as
    // the handler's onCreated hook.
    expect(track).toHaveBeenCalledWith("user-1", "project_created", { format: "Screenplay" });
  });

  it("403s with { error, upgrade } (the exact cap body) when the tier cap is reached, inserting nothing", async () => {
    getUserTier.mockResolvedValue("free"); // MAX_PROJECTS.free = 3
    findManyProjects.mockResolvedValue([{ id: "p1" }, { id: "p2" }, { id: "p3" }]);

    const res = await POST(makeRequest({ name: "One too many" }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toEqual({
      error: "Project limit reached for your plan",
      upgrade: true,
    });
    expect(insertCaptures).toHaveLength(0);
    expect(track).not.toHaveBeenCalled();
  });

  it("applies the `||` create defaults for a fully empty body", async () => {
    insertReturning.mockResolvedValue([{ id: "p10", userId: "user-1", name: "Untitled" }]);

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(201);
    expect(insertCaptures[0]!.payload).toMatchObject({
      name: "Untitled",
      format: "Novel",
      skillLevel: "beginner",
      genres: [],
      storyType: "linear",
      biggestChallenge: "",
    });
    expect(track).toHaveBeenCalledWith("user-1", "project_created", { format: "Novel" });
  });
});
