import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * DELETE /api/projects/[projectId]/reference-works/[refId] — thin adapter
 * route tests (mocks @/db + auth, the chapters route-test idiom).
 */
const findFirstProjects = vi.fn();
const deleteWhere = vi.fn(async (..._args: unknown[]) => undefined);
const deleteTables: unknown[] = [];
const updateCaptures: Array<{ table: unknown; payload: unknown }> = [];

vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: unknown[]) => findFirstProjects(...args) },
    },
    delete: (table: unknown) => {
      deleteTables.push(table);
      return { where: (...args: unknown[]) => deleteWhere(...args) };
    },
    update: (table: unknown) => ({
      set: (payload: unknown) => {
        updateCaptures.push({ table, payload });
        return { where: async () => undefined };
      },
    }),
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

import { DELETE } from "../route";
import { projects, referenceWorks } from "@/db/schema";

function makeParams() {
  return { params: Promise.resolve({ projectId: "proj-1", refId: "rw-9" }) };
}

describe("DELETE /api/projects/[projectId]/reference-works/[refId] (thin adapter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1", userId: "user-1" });
    deleteTables.length = 0;
    updateCaptures.length = 0;
  });

  it("200s { ok: true }, runs the project-scoped delete, and bumps the revision after it", async () => {
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(deleteTables).toEqual([referenceWorks]);
    expect(deleteWhere).toHaveBeenCalledTimes(1);

    const bumps = updateCaptures.filter(
      (c) => c.table === projects && "contentRevision" in (c.payload as Record<string, unknown>),
    );
    expect(bumps).toHaveLength(1);
  });

  it("404s { error: 'Not found' } on a foreign project and never deletes nor bumps", async () => {
    findFirstProjects.mockResolvedValue(undefined);

    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Not found" });
    expect(deleteTables).toHaveLength(0);
    expect(updateCaptures).toHaveLength(0);
  });

  it("still 200s { ok: true } when the refId matches no row (deleteScoped is row-agnostic, pre-migration parity)", async () => {
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(deleteTables).toEqual([referenceWorks]);
  });
});
