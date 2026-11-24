import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const findFirstProjects = vi.fn();
const findManyShots = vi.fn();
const findManyArgs: unknown[] = [];
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
      productionShots: {
        findMany: (...args: any[]) => {
          findManyArgs.push(args[0]);
          return findManyShots(...args);
        },
      },
    },
  },
}));

import { GET } from "../route";

function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1" }) };
}

describe("GET /api/projects/[projectId]/production/shots — thin adapter over listProductionShots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findManyArgs.length = 0;
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    findManyShots.mockResolvedValue([
      { id: "shot-1", sceneNumber: 1, shotNumber: 1, primaryCharacter: { id: "c1", name: "Mara" } },
      { id: "shot-2", sceneNumber: 1, shotNumber: 2, primaryCharacter: null },
    ]);
  });

  it("404 — unowned project, no list query", async () => {
    findFirstProjects.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/projects/proj-1/production/shots"), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Not found" });
    expect(findManyShots).not.toHaveBeenCalled();
  });

  it("happy path — the pre-migration `{ shots }` body, passed through untouched", async () => {
    const res = await GET(new Request("http://localhost/api/projects/proj-1/production/shots"), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      shots: [
        { id: "shot-1", sceneNumber: 1, shotNumber: 1, primaryCharacter: { id: "c1", name: "Mara" } },
        { id: "shot-2", sceneNumber: 1, shotNumber: 2, primaryCharacter: null },
      ],
    });
    expect(findManyShots).toHaveBeenCalledTimes(1);
  });

  it("byte-identical query semantics — primaryCharacter joined, ordered (sceneNumber, shotNumber)", async () => {
    await GET(new Request("http://localhost/api/projects/proj-1/production/shots"), makeParams());
    const arg = findManyArgs[0] as {
      where: unknown;
      with?: Record<string, unknown>;
      orderBy?: (t: Record<string, unknown>, ops: { asc: (c: unknown) => unknown }) => unknown[];
    };

    // The relation the old GET loaded.
    expect(arg.with).toEqual({ primaryCharacter: true });
    // The old GET's exact ordering callback — NOT the (sortOrder, shotNumber)
    // order the scene-video stitch paths use.
    const fakeAsc = (c: unknown) => c;
    const fakeTable = { sceneNumber: "sceneNumber", shotNumber: "shotNumber" };
    expect(arg.orderBy?.(fakeTable, { asc: fakeAsc })).toEqual(["sceneNumber", "shotNumber"]);
    expect(arg.where).toBeTruthy();
  });
});
