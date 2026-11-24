import { describe, it, expect, vi, beforeEach } from "vitest";
import { projects } from "@/db/schema";

vi.mock("@/lib/auth-helpers", () => ({
  getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const findFirstProjects = vi.fn();
const deleteWhere = vi.fn();
const updateTables = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...args: any[]) => findFirstProjects(...args) },
    },
    delete: vi.fn(() => ({ where: (...args: any[]) => deleteWhere(...args) })),
    update: (...uArgs: any[]) => {
      updateTables(...uArgs);
      return { set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) };
    },
  },
}));

const { DELETE } = await import("../route");

function makeParams(projectId = "proj-1", pageId = "page-1") {
  return { params: Promise.resolve({ projectId, pageId }) };
}

describe("DELETE /api/projects/[projectId]/comics/[pageId] (thin deleteComicPage adapter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstProjects.mockResolvedValue({ id: "proj-1" });
    deleteWhere.mockResolvedValue(undefined);
  });

  it("deletes the scoped page, returns the preserved `{ ok: true }` body, and bumps once", async () => {
    const res = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), makeParams());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(deleteWhere).toHaveBeenCalledTimes(1);
    expect(updateTables).toHaveBeenCalledTimes(1);
    expect(updateTables.mock.calls[0][0]).toBe(projects);
  });

  it("404 `{ error: \"Not found\" }` when the project isn't owned — nothing is deleted, nothing bumps", async () => {
    findFirstProjects.mockResolvedValue(null);

    const res = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), makeParams());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
    expect(deleteWhere).not.toHaveBeenCalled();
    expect(updateTables).not.toHaveBeenCalled();
  });

  it("a vanished row (delete matches nothing) still resolves `{ ok: true }` with the bump", async () => {
    deleteWhere.mockResolvedValue(undefined); // Drizzle delete resolves regardless of matched rows

    const res = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), makeParams());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(updateTables).toHaveBeenCalledTimes(1);
  });
});
