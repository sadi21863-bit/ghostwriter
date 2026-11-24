import { describe, it, expect, vi, beforeEach } from "vitest";
import { locations, projects } from "@/db/schema";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const findFirstProjects = vi.fn();
const updateSet = vi.fn();
const updateReturning = vi.fn();
const updateTables: unknown[] = [];
const deleteTables: unknown[] = [];
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
    },
    update: (table: unknown) => ({
      set: (vals: any) => {
        updateTables.push(table);
        updateSet(vals);
        return { where: () => ({ returning: (...a: any[]) => updateReturning(...a) }) };
      },
    }),
    delete: (table: unknown) => ({
      where: () => {
        deleteTables.push(table);
        return Promise.resolve(undefined);
      },
    }),
  },
}));

import { PATCH, DELETE } from "../route";

function makeRequest(body: any) {
  return new Request("http://localhost/api/projects/proj-1/locations/loc-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1", locationId: "loc-1" }) };
}

describe("PATCH /api/projects/[projectId]/locations/[locationId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateTables.length = 0;
    deleteTables.length = 0;
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    updateReturning.mockResolvedValue([{ id: "loc-1", name: "The Old Mill", description: "Abandoned" }]);
  });

  it("200 — returns the updated row, server-stamped updatedAt", async () => {
    const res = await PATCH(makeRequest({ description: "Repainted" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ id: "loc-1", name: "The Old Mill", description: "Abandoned" });
    const setArg = updateSet.mock.calls[0][0];
    expect(setArg.description).toBe("Repainted");
    expect(setArg.updatedAt).toBeInstanceOf(Date);
    expect(updateTables).toEqual([locations, projects]);
  });

  it("404 — unknown project probes ownership before the body is validated", async () => {
    findFirstProjects.mockResolvedValue(null);

    const res = await PATCH(makeRequest({ sortOrder: "not-a-number" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Not found" });
    expect(updateTables).toEqual([]);
  });

  it("400 — Invalid fields on an owned project touches nothing", async () => {
    const res = await PATCH(makeRequest({ sortOrder: "not-a-number" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Invalid fields" });
    expect(updateTables).toEqual([]);
  });

  it("404 — no row matched (foreign locationId): write attempted, no bump", async () => {
    updateReturning.mockResolvedValue([]);

    const res = await PATCH(makeRequest({ description: "x" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Not found" });
    expect(updateTables).toEqual([locations]);
  });

  it("§11 — a non-empty patch bumps through the real pgPostCommitHooks after the write", async () => {
    await PATCH(makeRequest({ description: "Repainted" }), makeParams());

    const bump = updateTables.filter((t) => t === projects);
    expect(bump).toHaveLength(1);
  });

  it("empty patch `{}` — touch without a revision bump", async () => {
    const res = await PATCH(makeRequest({}), makeParams());

    expect(res.status).toBe(200);
    expect(updateTables).toEqual([locations]);
    expect(updateSet.mock.calls[0][0].updatedAt).toBeInstanceOf(Date);
  });

  it("DELETE — {ok:true} and the §11 bump fires after the scoped delete", async () => {
    const res = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      makeParams(),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(deleteTables).toEqual([locations]);
    expect(updateTables).toEqual([projects]);
  });

  it("DELETE 404 — unknown project deletes nothing and never bumps", async () => {
    findFirstProjects.mockResolvedValue(null);

    const res = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      makeParams(),
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Not found" });
    expect(deleteTables).toEqual([]);
    expect(updateTables).toEqual([]);
  });
});
