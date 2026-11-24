import { describe, it, expect, vi } from "vitest";
import {
  createPlotThread,
  deletePlotThread,
  updatePlotThread,
  type PlotThreadCreateData,
} from "@/lib/core/handlers/plot-threads";
import {
  createReferenceWork,
  deleteReferenceWork,
  type ReferenceWorkCreateData,
} from "@/lib/core/handlers/reference-works";
import { cloudContext, localContext } from "@/lib/core/request-context";

/**
 * Phase 2 / v4 §7 — plot-thread and reference-work CRUD handlers.
 *
 * Same shape as `update-chapter.test.ts`: no database, no Next.js — the rules
 * (scope before repo, ownership through the port, §11 hooks post-commit only)
 * exercised directly against mock ports.
 */

const ctx = cloudContext("u1");

function plotThreadRepo(over: Record<string, unknown> = {}) {
  // Mock implementations take the SAME arguments as the real ports so vitest
  // infers indexed call tuples (`mock.calls[0]![2]` typechecks — CLAUDE.md's
  // zero-arg `vi.fn()` gotcha).
  const ownsProject = vi.fn(async (_projectId: string, _actorId: string) => true);
  const create = vi.fn(async (_projectId: string, _data: PlotThreadCreateData) => ({
    id: "t1",
    projectId: "p1",
    name: "Red Line",
    status: "Active",
  }));
  const findScoped = vi.fn(async (_projectId: string, _threadId: string) => ({
    id: "t1",
    projectId: "p1",
    name: "Red Line",
  }));
  const updateScoped = vi.fn(
    async (_projectId: string, _threadId: string, _patch: Record<string, unknown>) => ({
      id: "t1",
      projectId: "p1",
      name: "Red Line",
    }),
  );
  const deleteScoped = vi.fn(async (_projectId: string, _threadId: string) => {});
  return { ownsProject, create, findScoped, updateScoped, deleteScoped, ...over } as unknown as {
    ownsProject: typeof ownsProject;
    create: typeof create;
    findScoped: typeof findScoped;
    updateScoped: typeof updateScoped;
    deleteScoped: typeof deleteScoped;
  };
}

function referenceWorkRepo(over: Record<string, unknown> = {}) {
  const ownsProject = vi.fn(async (_projectId: string, _actorId: string) => true);
  const create = vi.fn(async (_projectId: string, _data: ReferenceWorkCreateData) => ({
    id: "rw1",
    projectId: "p1",
    title: "Reedsy Style DNA",
    attributes: {},
  }));
  const deleteScoped = vi.fn(async (_projectId: string, _refId: string) => {});
  return { ownsProject, create, deleteScoped, ...over } as unknown as {
    ownsProject: typeof ownsProject;
    create: typeof create;
    deleteScoped: typeof deleteScoped;
  };
}

const hooks = () => ({ onCanonicalMutation: vi.fn(async (_projectId: string, _kind: string) => {}) });

describe("createPlotThread", () => {
  it("runs the scoped insert, returns the created thread, and fires plotThread.create", async () => {
    const r = plotThreadRepo();
    const h = hooks();
    const data = { name: "Red Line", stakes: "If the ledger leaks, Alex is done" };
    const out = await createPlotThread(ctx, { projectId: "p1", data }, r, h);
    expect(out).toMatchObject({ ok: true, thread: { id: "t1", name: "Red Line" } });
    expect(r.create).toHaveBeenCalledWith("p1", data);
    expect(h.onCanonicalMutation).toHaveBeenCalledTimes(1);
    expect(h.onCanonicalMutation).toHaveBeenCalledWith("p1", "plotThread.create");
  });

  it("403 on a mismatched scope and 404 on a non-owned project never reach the repo or the hook", async () => {
    const h = hooks();

    const r403 = plotThreadRepo();
    const out403 = await createPlotThread(
      localContext({ projectScope: "other" }),
      { projectId: "p1", data: { name: "x" } },
      r403,
      h,
    );
    expect(out403).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(r403.ownsProject).not.toHaveBeenCalled();
    expect(r403.create).not.toHaveBeenCalled();

    const r404 = plotThreadRepo({ ownsProject: vi.fn(async () => false) as never });
    const out404 = await createPlotThread(ctx, { projectId: "p1", data: { name: "x" } }, r404, h);
    expect(out404).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(r404.create).not.toHaveBeenCalled();

    expect(h.onCanonicalMutation).not.toHaveBeenCalled();
  });
});

describe("updatePlotThread", () => {
  it("stamps updatedAt last, returns the row, and fires plotThread.update for a real patch", async () => {
    const r = plotThreadRepo();
    const h = hooks();
    const out = await updatePlotThread(ctx, { projectId: "p1", threadId: "t1", patch: { name: "Twist" } }, r, h);
    expect(out).toMatchObject({ ok: true, thread: { id: "t1" } });
    const sent = r.updateScoped.mock.calls[0]![2]!;
    expect(sent).toMatchObject({ name: "Twist" });
    expect(sent.updatedAt).toBeInstanceOf(Date);
    expect(h.onCanonicalMutation).toHaveBeenCalledTimes(1);
    expect(h.onCanonicalMutation).toHaveBeenCalledWith("p1", "plotThread.update");
  });

  it("an empty patch still touches the row but never fires the revision hook", async () => {
    const r = plotThreadRepo();
    const h = hooks();
    const out = await updatePlotThread(ctx, { projectId: "p1", threadId: "t1", patch: {} }, r, h);
    expect(out).toMatchObject({ ok: true });
    expect(r.updateScoped).toHaveBeenCalledTimes(1);
    expect(r.updateScoped.mock.calls[0]![2]!.updatedAt).toBeInstanceOf(Date);
    expect(h.onCanonicalMutation).not.toHaveBeenCalled();
  });

  it("404s when the scoped update matched no row, and the hook stays silent (IDOR)", async () => {
    const r = plotThreadRepo({ updateScoped: vi.fn(async () => null) as never });
    const h = hooks();
    const out = await updatePlotThread(ctx, { projectId: "p1", threadId: "t1", patch: { name: "x" } }, r, h);
    expect(out).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(h.onCanonicalMutation).not.toHaveBeenCalled();
  });
});

describe("deletePlotThread", () => {
  it("fires plotThread.delete only AFTER the scoped delete actually ran", async () => {
    const order: string[] = [];
    const deleteScoped = vi.fn(async (_projectId: string, _threadId: string) => {
      order.push("delete");
    });
    const onCanonicalMutation = vi.fn(async (_projectId: string, _kind: string) => {
      order.push("hook");
    });
    const r = plotThreadRepo({ deleteScoped });
    const out = await deletePlotThread(ctx, { projectId: "p1", threadId: "t1" }, r, { onCanonicalMutation });
    expect(out).toEqual({ ok: true });
    expect(r.deleteScoped).toHaveBeenCalledWith("p1", "t1");
    expect(order).toEqual(["delete", "hook"]);
    expect(onCanonicalMutation).toHaveBeenCalledWith("p1", "plotThread.delete");
  });

  it("403 and 404 refusals fire neither the delete nor the hook", async () => {
    const h = hooks();

    const r403 = plotThreadRepo();
    const out403 = await deletePlotThread(
      localContext({ projectScope: "other" }),
      { projectId: "p1", threadId: "t1" },
      r403,
      h,
    );
    expect(out403).toMatchObject({ ok: false, status: 403 });
    expect(r403.deleteScoped).not.toHaveBeenCalled();

    const r404 = plotThreadRepo({ ownsProject: vi.fn(async () => false) as never });
    const out404 = await deletePlotThread(ctx, { projectId: "p1", threadId: "t1" }, r404, h);
    expect(out404).toMatchObject({ ok: false, status: 404 });
    expect(r404.deleteScoped).not.toHaveBeenCalled();

    expect(h.onCanonicalMutation).not.toHaveBeenCalled();
  });
});

describe("createReferenceWork", () => {
  it("runs the scoped insert, returns the created row, and fires referenceWork.create", async () => {
    const r = referenceWorkRepo();
    const h = hooks();
    const data = { title: "Reedsy Style DNA", attributes: { tension: 4 } };
    const out = await createReferenceWork(ctx, { projectId: "p1", data }, r, h);
    expect(out).toMatchObject({ ok: true, reference: { id: "rw1", title: "Reedsy Style DNA" } });
    expect(r.create).toHaveBeenCalledWith("p1", data);
    expect(h.onCanonicalMutation).toHaveBeenCalledTimes(1);
    expect(h.onCanonicalMutation).toHaveBeenCalledWith("p1", "referenceWork.create");
  });

  it("403 on a mismatched scope and 404 on a non-owned project never reach the repo or the hook", async () => {
    const h = hooks();

    const r403 = referenceWorkRepo();
    const out403 = await createReferenceWork(
      localContext({ projectScope: "other" }),
      { projectId: "p1", data: { title: "x" } },
      r403,
      h,
    );
    expect(out403).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(r403.create).not.toHaveBeenCalled();

    const r404 = referenceWorkRepo({ ownsProject: vi.fn(async () => false) as never });
    const out404 = await createReferenceWork(ctx, { projectId: "p1", data: { title: "x" } }, r404, h);
    expect(out404).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(r404.create).not.toHaveBeenCalled();

    expect(h.onCanonicalMutation).not.toHaveBeenCalled();
  });
});

describe("deleteReferenceWork", () => {
  it("deletes scoped, bumps the revision after, and refuses before any side effect otherwise", async () => {
    const r = referenceWorkRepo();
    const h = hooks();
    const out = await deleteReferenceWork(ctx, { projectId: "p1", refId: "rw1" }, r, h);
    expect(out).toEqual({ ok: true });
    expect(r.deleteScoped).toHaveBeenCalledWith("p1", "rw1");
    expect(h.onCanonicalMutation).toHaveBeenCalledTimes(1);
    expect(h.onCanonicalMutation).toHaveBeenCalledWith("p1", "referenceWork.delete");

    const r404 = referenceWorkRepo({ ownsProject: vi.fn(async () => false) as never });
    const refused = await deleteReferenceWork(
      localContext({ projectScope: "other" }),
      { projectId: "p1", refId: "rw1" },
      r404,
      h,
    );
    expect(refused).toMatchObject({ ok: false, status: 403 });
    expect(r404.deleteScoped).not.toHaveBeenCalled();
    expect(h.onCanonicalMutation).toHaveBeenCalledTimes(1);
  });
});
