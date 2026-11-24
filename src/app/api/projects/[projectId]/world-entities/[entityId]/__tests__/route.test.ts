// Phase 2 / v4 §7 — route adapter tests for the world-entity PATCH/DELETE edge.
// The route keeps the manual allowlist + kind/properties parsing; the handler
// owns scoping, `updatedAt`, and the §11 hook. Mocks only auth + `@/db`
// (the chapters route-test idiom).
import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirstProjects = vi.fn();
const updateSet = vi.fn();
const updateReturning = vi.fn();
const deleteWhere = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
    },
    update: (_table: unknown) => ({
      set: (vals: unknown) => {
        updateSet(vals);
        return {
          where: () => ({
            returning: (...args: any[]) => updateReturning(...args),
          }),
        };
      },
    }),
    delete: (_table: unknown) => ({
      where: (...args: any[]) => {
        deleteWhere(...args);
        return Promise.resolve(undefined);
      },
    }),
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const { DELETE, PATCH } = await import("../route");

function makeRequest(body: unknown, method = "PATCH") {
  return new Request("http://localhost", { method, body: JSON.stringify(body) });
}
function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1", entityId: "we-1" }) };
}

describe("PATCH .../world-entities/[entityId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    updateReturning.mockResolvedValue([{ id: "we-1", projectId: "proj-1", name: "Renamed" }]);
  });

  it("happy path: returns the updated row exactly as the pre-migration route did", async () => {
    const res = await PATCH(makeRequest({ name: "Renamed", sortOrder: 3 }), makeParams());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "we-1", projectId: "proj-1", name: "Renamed" });
  });

  it("manual allowlist drops server-owned fields the caller must not write", async () => {
    await PATCH(
      makeRequest({ name: "Renamed", id: "chosen-id", embedding: [0.1], projectId: "victim" }),
      makeParams(),
    );
    const patch = updateSet.mock.calls[0]![0] as Record<string, unknown>;
    expect(patch).toMatchObject({ name: "Renamed" });
    expect(patch).not.toHaveProperty("id");
    expect(patch).not.toHaveProperty("embedding");
    expect(patch).not.toHaveProperty("projectId");
    // The route never accepts a client `updatedAt`; the handler stamps its own
    // server-owned one after the route's allowlist passes.
    expect(patch.updatedAt).toBeInstanceOf(Date);
  });

  it("normalizes a bogus kind through WorldEntityKindSchema ('spaceship' → 'object')", async () => {
    const res = await PATCH(makeRequest({ kind: "spaceship" }), makeParams());
    expect(res.status).toBe(200);
    expect(updateSet.mock.calls[0]![0]).toMatchObject({ kind: "object" });
  });

  it("rejects a non-object properties value with the pre-migration 'invalid properties' 400", async () => {
    // Only a non-object value throws — each FIELD of the schema `catch`es
    // itself, so a malformed field is silently dropped (same as pre-migration).
    const bad = await PATCH(makeRequest({ properties: "nope" }), makeParams());
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "invalid properties" });
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("404s cleanly when the entityId belongs to another project — no serialization crash", async () => {
    // The pre-migration route returned NextResponse.json(undefined) here and
    // crashed ("Value is not JSON serializable") — the same behavior the
    // chapters PATCH 404 fix (CLAUDE.md item 52) eliminated.
    updateReturning.mockResolvedValue([]);
    const res = await PATCH(makeRequest({ name: "T" }), makeParams());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });
});

describe("DELETE .../world-entities/[entityId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
  });

  it("responds {ok:true} after a project-scoped delete", async () => {
    const res = await DELETE(new Request("http://localhost"), makeParams());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(deleteWhere).toHaveBeenCalledTimes(1);
  });
});
