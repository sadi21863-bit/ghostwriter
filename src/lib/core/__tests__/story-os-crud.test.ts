import { describe, it, expect, vi } from "vitest";
import {
  createStoryThread,
  createStoryPromise,
  listStoryState,
  updateStoryThread,
  updateStoryPromise,
  storyThreadInsertFields,
  storyPromiseInsertFields,
  type StoryThreadRow,
  type StoryPromiseRow,
} from "@/lib/core/handlers/story-state";
import {
  createStoryMemory,
  deleteStoryMemory,
  listStoryMemories,
  type StoryMemoryRow,
} from "@/lib/core/handlers/story-memories";
import { readStoryGraph } from "@/lib/core/handlers/story-graph";
import {
  computeCheckpointSnapshot,
  createCheckpoint,
  deleteCheckpoint,
  listCheckpoints,
  type StoryCheckpointRow,
} from "@/lib/core/handlers/story-checkpoints";
import {
  deleteStoryPlan,
  listStoryPlans,
  updateStoryPlan,
  type StoryPlanRow,
} from "@/lib/core/handlers/story-plans";
import { cloudContext, localContext } from "@/lib/core/request-context";

/**
 * Phase 2 / v4 §7 — story-OS CRUD handlers (story-state / story-memories /
 * story-graph / story-checkpoints / story-plans).
 *
 * Same shape as `thread-reference-crud.test.ts`: no database, no Next.js — the
 * rules (scope before repo, ownership through the port, §11 hooks post-commit
 * only) exercised directly against mock ports typed with the real signatures so
 * vitest infers indexed call tuples.
 */

const ctx = cloudContext("u1");

const hooks = () => ({ onCanonicalMutation: vi.fn(async (_projectId: string, _kind: string) => {}) });

function threadRow(over: Partial<StoryThreadRow> = {}): StoryThreadRow {
  return { id: "th1", projectId: "p1", name: "Heist debt", ...over };
}
function promiseRow(over: Partial<StoryPromiseRow> = {}): StoryPromiseRow {
  return { id: "pr1", projectId: "p1", setup: "The dealer owes a favor", ...over };
}

function stateRepo(over: Record<string, unknown> = {}) {
  const ownsProject = vi.fn(async (_projectId: string, _actorId: string) => true);
  const findThreads = vi.fn(async (_projectId: string) => [
    { ...threadRow(), promises: [promiseRow()] },
  ] as never);
  const createThread = vi.fn(async (_projectId: string, _fields: Record<string, unknown>) =>
    threadRow(),
  );
  const createPromise = vi.fn(async (_projectId: string, _fields: Record<string, unknown>) =>
    promiseRow(),
  );
  const updateThreadScoped = vi.fn(
    async (_projectId: string, _threadId: string, _patch: Record<string, unknown>) => threadRow(),
  );
  const updatePromiseScoped = vi.fn(
    async (_projectId: string, _promiseId: string, _patch: Record<string, unknown>) => promiseRow(),
  );
  return {
    ownsProject,
    findThreads,
    createThread,
    createPromise,
    updateThreadScoped,
    updatePromiseScoped,
    ...over,
  } as unknown as {
    ownsProject: typeof ownsProject;
    findThreads: typeof findThreads;
    createThread: typeof createThread;
    createPromise: typeof createPromise;
    updateThreadScoped: typeof updateThreadScoped;
    updatePromiseScoped: typeof updatePromiseScoped;
  };
}

function memoryRepo(over: Record<string, unknown> = {}) {
  const ownsProject = vi.fn(async (_projectId: string, _actorId: string) => true);
  const findScoped = vi.fn(async (_projectId: string) =>
    [{ id: "m1", projectId: "p1", fact: "Kessler never bluffs" } as StoryMemoryRow],
  );
  const create = vi.fn(async (_projectId: string, _fields: Record<string, unknown>) =>
    ({ id: "m1", projectId: "p1", fact: "f" } as StoryMemoryRow),
  );
  const deleteScoped = vi.fn(async (_projectId: string, _memoryId: unknown) => {});
  return { ownsProject, findScoped, create, deleteScoped, ...over } as unknown as {
    ownsProject: typeof ownsProject;
    findScoped: typeof findScoped;
    create: typeof create;
    deleteScoped: typeof deleteScoped;
  };
}

function graphRepo(over: Record<string, unknown> = {}) {
  const ownsProject = vi.fn(async (_projectId: string, _actorId: string) => true);
  const readGraphData = vi.fn(async (_projectId: string) => ({
    project: {
      id: "p1",
      title: "The Dealer",
      characters: [],
      locations: [],
      plotThreads: [],
      chapters: [],
      worldEntities: [],
    },
    storedRels: [],
  }));
  return { ownsProject, readGraphData, ...over } as unknown as {
    ownsProject: typeof ownsProject;
    readGraphData: typeof readGraphData;
  };
}

function checkpointRepo(over: Record<string, unknown> = {}) {
  const ownsProject = vi.fn(async (_projectId: string, _actorId: string) => true);
  const readSnapshotInputs = vi.fn(async (_projectId: string) => ({
    chapters: [],
    plotThreads: [],
    storyPromises: [],
  }));
  const findScoped = vi.fn(async (_projectId: string) =>
    [{ id: "cp1", projectId: "p1", name: "Checkpoint" } as StoryCheckpointRow],
  );
  const create = vi.fn(async (_projectId: string, _fields: Record<string, unknown>) =>
    ({ id: "cp1", projectId: "p1", name: "Checkpoint" } as StoryCheckpointRow),
  );
  const deleteScoped = vi.fn(async (_projectId: string, _checkpointId: unknown) => {});
  return { ownsProject, readSnapshotInputs, findScoped, create, deleteScoped, ...over } as unknown as {
    ownsProject: typeof ownsProject;
    readSnapshotInputs: typeof readSnapshotInputs;
    findScoped: typeof findScoped;
    create: typeof create;
    deleteScoped: typeof deleteScoped;
  };
}

function planRepo(over: Record<string, unknown> = {}) {
  const ownsProject = vi.fn(async (_projectId: string, _actorId: string) => true);
  const findScoped = vi.fn(async (_projectId: string) =>
    [{ id: "pl1", projectId: "p1", kind: "beat_sheet", title: "Beat Sheet" } as StoryPlanRow],
  );
  const updateScoped = vi.fn(
    async (_projectId: string, _planId: string, _patch: Record<string, unknown>) =>
      ({ id: "pl1", projectId: "p1", kind: "beat_sheet", title: "Beat Sheet" }) as StoryPlanRow,
  );
  const deleteScoped = vi.fn(async (_projectId: string, _planId: unknown) => {});
  return { ownsProject, findScoped, updateScoped, deleteScoped, ...over } as unknown as {
    ownsProject: typeof ownsProject;
    findScoped: typeof findScoped;
    updateScoped: typeof updateScoped;
    deleteScoped: typeof deleteScoped;
  };
}

describe("insert-field defaults (story-state)", () => {
  it("applies the POST route's exact column defaults", () => {
    expect(storyThreadInsertFields({ name: "Heist debt" })).toEqual({
      name: "Heist debt",
      threadType: "subplot",
      notes: "",
    });
    expect(storyThreadInsertFields({ name: "x", threadType: "main", notes: "n" })).toEqual({
      name: "x",
      threadType: "main",
      notes: "n",
    });
    expect(
      storyPromiseInsertFields({ setup: "s", threadId: "t1", setupChapterId: "c1", payoffIntent: "p", priority: "A" }),
    ).toEqual({ threadId: "t1", setup: "s", setupChapterId: "c1", payoffIntent: "p", priority: "A" });
    expect(storyPromiseInsertFields({ setup: "s" })).toEqual({
      threadId: null,
      setup: "s",
      setupChapterId: null,
      payoffIntent: "",
      priority: "B",
    });
  });
});

describe("story-state creates", () => {
  it("thread: scoped insert with defaults, hook AFTER the write", async () => {
    const order: string[] = [];
    const r = stateRepo({
      createThread: vi.fn(async (_p: string, _f: Record<string, unknown>) => {
        order.push("insert");
        return threadRow();
      }) as never,
    });
    const h = {
      onCanonicalMutation: vi.fn(async (_projectId: string, _kind: string) => {
        order.push("hook");
      }),
    };
    const out = await createStoryThread(ctx, { projectId: "p1", data: { name: "Heist debt" } }, r, h);
    expect(out).toMatchObject({ ok: true, thread: { id: "th1" } });
    expect(r.createThread).toHaveBeenCalledWith("p1", {
      name: "Heist debt",
      threadType: "subplot",
      notes: "",
    });
    expect(order).toEqual(["insert", "hook"]);
    expect(h.onCanonicalMutation).toHaveBeenCalledWith("p1", "storyThread.create");
  });

  it("promise: insert + hook + fire-and-forget embedSetup with the created row's setup", async () => {
    const r = stateRepo();
    const h = hooks();
    const embedSetup = vi.fn((_promiseId: string, _setup: string) => {});
    const out = await createStoryPromise(
      ctx,
      { projectId: "p1", data: { setup: "The dealer owes a favor", priority: "A" } },
      r,
      h,
      embedSetup,
    );
    expect(out).toMatchObject({ ok: true, promise: { id: "pr1" } });
    expect(r.createPromise).toHaveBeenCalledWith("p1", {
      threadId: null,
      setup: "The dealer owes a favor",
      setupChapterId: null,
      payoffIntent: "",
      priority: "A",
    });
    expect(h.onCanonicalMutation).toHaveBeenCalledWith("p1", "storyPromise.create");
    expect(embedSetup).toHaveBeenCalledTimes(1);
    expect(embedSetup).toHaveBeenCalledWith("pr1", "The dealer owes a favor");
  });

  it("a throwing embedSetup never fails the completed save, and the absent default is a no-op", async () => {
    const r = stateRepo();
    const throwing = await createStoryPromise(
      ctx,
      { projectId: "p1", data: { setup: "s" } },
      r,
      hooks(),
      () => {
        throw new Error("embedding service down");
      },
    );
    expect(throwing).toMatchObject({ ok: true });

    const ok = await createStoryPromise(ctx, { projectId: "p1", data: { setup: "s" } }, stateRepo());
    expect(ok).toMatchObject({ ok: true });
  });

  it("403 on a mismatched scope and 404 on a non-owned project never reach the repo, hook, or seam", async () => {
    const h = hooks();
    const embedSetup = vi.fn();

    const r403 = stateRepo();
    const out403 = await createStoryPromise(
      localContext({ projectScope: "other" }),
      { projectId: "p1", data: { setup: "s" } },
      r403,
      h,
      embedSetup,
    );
    expect(out403).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });

    const r404 = stateRepo({ ownsProject: vi.fn(async () => false) as never });
    const out404 = await createStoryThread(ctx, { projectId: "p1", data: { name: "x" } }, r404, h);
    expect(out404).toEqual({ ok: false, status: 404, reason: "Not found" });

    expect(r403.createPromise).not.toHaveBeenCalled();
    expect(r403.ownsProject).not.toHaveBeenCalled();
    expect(r404.createThread).not.toHaveBeenCalled();
    expect(embedSetup).not.toHaveBeenCalled();
    expect(h.onCanonicalMutation).not.toHaveBeenCalled();
  });

  it("GET lists the threads (with their promises) after the refusals", async () => {
    const r = stateRepo();
    const out = await listStoryState(ctx, { projectId: "p1" }, r);
    expect(out).toMatchObject({ ok: true });
    expect(r.findThreads).toHaveBeenCalledWith("p1");

    const refused = await listStoryState(localContext({ projectScope: "other" }), { projectId: "p1" }, stateRepo());
    expect(refused).toMatchObject({ ok: false, status: 403 });
  });
});

describe("story-state updates", () => {
  it("thread: the branch-fixed payload verbatim, including the ?? null reset", async () => {
    const r = stateRepo();
    const h = hooks();
    const out = await updateStoryThread(
      ctx,
      { projectId: "p1", threadId: "th1", patch: { status: "resolved" } },
      r,
      h,
    );
    expect(out).toMatchObject({ ok: true });
    const sent = r.updateThreadScoped.mock.calls[0]![2]!;
    expect(sent).toEqual({ status: "resolved", resolvedAtChapterId: null, notes: undefined });
    expect(h.onCanonicalMutation).toHaveBeenCalledWith("p1", "storyThread.update");
  });

  it("promise: the branch-fixed payload verbatim and the hook only when a row matched", async () => {
    const r = stateRepo();
    const out = await updateStoryPromise(
      ctx,
      { projectId: "p1", promiseId: "pr1", patch: { status: "paid_off", payoffChapterId: "c9" } },
      r,
      hooks(),
    );
    expect(out).toMatchObject({ ok: true });
    expect(r.updatePromiseScoped.mock.calls[0]![2]).toEqual({
      status: "paid_off",
      payoffChapterId: "c9",
      payoffIntent: undefined,
    });
  });

  it("404 when the scoped update matched no row; the hook stays silent (IDOR)", async () => {
    const r = stateRepo({ updateThreadScoped: vi.fn(async () => null) as never });
    const h = hooks();
    const out = await updateStoryThread(
      ctx,
      { projectId: "p1", threadId: "th1", patch: { status: "resolved" } },
      r,
      h,
    );
    expect(out).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(h.onCanonicalMutation).not.toHaveBeenCalled();
  });

  it("403 refuses before the repo is touched", async () => {
    const r = stateRepo();
    const out = await updateStoryPromise(
      localContext({ projectScope: "other" }),
      { projectId: "p1", promiseId: "pr1", patch: { status: "paid_off" } },
      r,
    );
    expect(out).toMatchObject({ ok: false, status: 403 });
    expect(r.ownsProject).not.toHaveBeenCalled();
    expect(r.updatePromiseScoped).not.toHaveBeenCalled();
  });
});

describe("story-memories", () => {
  it("create: trims the fact, forces autoExtracted false, and fires memory.create", async () => {
    const r = memoryRepo();
    const h = hooks();
    const out = await createStoryMemory(
      ctx,
      { projectId: "p1", fact: "  Kessler never bluffs  ", category: "trait" },
      r,
      h,
    );
    expect(out).toMatchObject({ ok: true, memory: { id: "m1" } });
    expect(r.create).toHaveBeenCalledWith("p1", {
      fact: "Kessler never bluffs",
      category: "trait",
      structuredData: null,
      autoExtracted: false,
    });
    expect(h.onCanonicalMutation).toHaveBeenCalledWith("p1", "memory.create");
  });

  it("create: null structuredData stays null; a valid object decodes; garbage sub-fields drop without rejecting", async () => {
    const r = memoryRepo();

    await createStoryMemory(ctx, { projectId: "p1", fact: "f", structuredData: null }, r);
    expect(r.create.mock.calls[0]![1]!.structuredData).toBeNull();

    await createStoryMemory(
      ctx,
      { projectId: "p1", fact: "f", structuredData: { chapterTitle: "Ch 1", keyEvents: ["x"], charactersPresent: "not-an-array" } },
      r,
    );
    const decoded = r.create.mock.calls[1]![1]!.structuredData as Record<string, unknown>;
    expect(decoded).toEqual({ chapterTitle: "Ch 1", keyEvents: ["x"] });

    await createStoryMemory(ctx, { projectId: "p1", fact: "f", structuredData: "not-an-object" }, r);
    expect(r.create.mock.calls[2]![1]!.structuredData).toEqual({});
  });

  it("delete: scoped delete then hook, silent ok even for a bogus id; refusals fire nothing", async () => {
    const order: string[] = [];
    const deleteScoped = vi.fn(async (_projectId: string, _memoryId: unknown) => {
      order.push("delete");
    });
    const onCanonicalMutation = vi.fn(async (_projectId: string, _kind: string) => {
      order.push("hook");
    });
    const r = memoryRepo({ deleteScoped });
    const out = await deleteStoryMemory(ctx, { projectId: "p1", memoryId: "bogus" }, r, { onCanonicalMutation });
    expect(out).toEqual({ ok: true });
    expect(order).toEqual(["delete", "hook"]);
    expect(onCanonicalMutation).toHaveBeenCalledWith("p1", "memory.delete");

    const h2 = hooks();
    const r404 = memoryRepo({ ownsProject: vi.fn(async () => false) as never });
    const refused = await deleteStoryMemory(localContext({ projectScope: "other" }), { projectId: "p1", memoryId: "m1" }, r404, h2);
    expect(refused).toMatchObject({ ok: false, status: 403 });
    expect(r404.deleteScoped).not.toHaveBeenCalled();
    expect(h2.onCanonicalMutation).not.toHaveBeenCalled();
  });

  it("GET lists newest-first via the port after the refusals", async () => {
    const r = memoryRepo();
    const out = await listStoryMemories(ctx, { projectId: "p1" }, r);
    expect(out).toMatchObject({ ok: true });
    expect(r.findScoped).toHaveBeenCalledWith("p1");
  });
});

describe("story-graph", () => {
  it("composes build → health → contextTrimmed over the port's read", async () => {
    const r = graphRepo();
    const out = await readStoryGraph(ctx, { projectId: "p1" }, r);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.graph).toHaveProperty("nodes");
    expect(out.graph).toHaveProperty("edges");
    expect(out.health).toHaveProperty("score");
    expect(out.health).toHaveProperty("issues");
    expect(typeof out.contextTrimmed).toBe("boolean");
    expect(r.readGraphData).toHaveBeenCalledWith("p1");
  });

  it("404 when the project vanished between the ownership probe and the read", async () => {
    const r = graphRepo({
      readGraphData: vi.fn(async (_projectId: string) => ({ project: null, storedRels: [] })) as never,
    });
    const out = await readStoryGraph(ctx, { projectId: "p1" }, r);
    expect(out).toEqual({ ok: false, status: 404, reason: "Not found" });
  });

  it("403 on a mismatched scope never reaches the repo; 404 on a non-owned project", async () => {
    const r403 = graphRepo();
    const out403 = await readStoryGraph(localContext({ projectScope: "other" }), { projectId: "p1" }, r403);
    expect(out403).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(r403.ownsProject).not.toHaveBeenCalled();

    const r404 = graphRepo({ ownsProject: vi.fn(async () => false) as never });
    const out404 = await readStoryGraph(ctx, { projectId: "p1" }, r404);
    expect(out404).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(r404.readGraphData).not.toHaveBeenCalled();
  });
});

describe("computeCheckpointSnapshot (the healthScore formula, verbatim)", () => {
  it("totals words, counts open threads ('open' || 'Active') and open promises", () => {
    const snap = computeCheckpointSnapshot({
      chapters: [
        { id: "c1", title: "One", wordCount: 500, arcPosition: "setup" },
        { id: "c2", title: "Two", wordCount: null, arcPosition: null },
      ],
      plotThreads: [
        { id: "t1", status: "open", starvationWarning: false },
        { id: "t2", status: "Active", starvationWarning: false },
        { id: "t3", status: "closed", starvationWarning: false },
      ],
      storyPromises: [{ id: "p1", status: "open" }, { id: "p2", status: "paid_off" }],
    });
    expect(snap.totalWordCount).toBe(500);
    expect(snap.chapterCount).toBe(2);
    expect(snap.openThreadCount).toBe(2);
    expect(snap.openPromises).toBe(1);
    expect(snap.chapters).toEqual([
      { id: "c1", title: "One", wordCount: 500, arcPosition: "setup" },
      { id: "c2", title: "Two", wordCount: 0, arcPosition: "" },
    ]);
  });

  it("applies the penalties: starvation −5, thin chapters −3, open promises beyond five −4 each, floored at 0", () => {
    const chapters = Array.from({ length: 3 }, (_, i) => ({ id: `c${i}`, title: `C${i}`, wordCount: 100, arcPosition: null }));
    const threads = Array.from({ length: 2 }, (_, i) => ({ id: `t${i}`, status: "open", starvationWarning: true }));
    const promises = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, status: "open" }));
    // 100 - (2*5) - (3*3) - ((7-5)*4) = 100 - 10 - 9 - 8 = 73
    expect(computeCheckpointSnapshot({ chapters, plotThreads: threads, storyPromises: promises }).healthScore).toBe(73);

    const brutal = computeCheckpointSnapshot({
      chapters: Array.from({ length: 40 }, (_, i) => ({ id: `c${i}`, title: `C${i}`, wordCount: 0, arcPosition: null })),
      plotThreads: Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, status: "open", starvationWarning: true })),
      storyPromises: Array.from({ length: 40 }, (_, i) => ({ id: `p${i}`, status: "open" })),
    });
    expect(brutal.healthScore).toBe(0);
  });
});

describe("story-checkpoints", () => {
  it("create: server-owned name default + snapshot, hook after the write", async () => {
    const r = checkpointRepo();
    const h = hooks();
    const out = await createCheckpoint(ctx, { projectId: "p1", name: "  ", notes: undefined }, r, h);
    expect(out).toMatchObject({ ok: true, checkpoint: { id: "cp1" } });
    const fields = r.create.mock.calls[0]![1]!;
    expect(fields.name).toMatch(/^Checkpoint — /);
    expect(fields.notes).toBe("");
    expect(fields.snapshot).toMatchObject({
      totalWordCount: 0,
      chapterCount: 0,
      openThreadCount: 0,
      openPromises: 0,
      healthScore: 100,
    });
    expect(h.onCanonicalMutation).toHaveBeenCalledWith("p1", "checkpoint.create");
  });

  it("404 when the project vanished between the probe and the health read", async () => {
    const r = checkpointRepo({
      readSnapshotInputs: vi.fn(async (_projectId: string) => null) as never,
    });
    const out = await createCheckpoint(ctx, { projectId: "p1", name: "x" }, r);
    expect(out).toEqual({ ok: false, status: 404, reason: "Not found" });
  });

  it("delete: scoped delete then hook, returns ok; refusals fire nothing", async () => {
    const r = checkpointRepo();
    const h = hooks();
    const out = await deleteCheckpoint(ctx, { projectId: "p1", checkpointId: "cp1" }, r, h);
    expect(out).toEqual({ ok: true });
    expect(r.deleteScoped).toHaveBeenCalledWith("p1", "cp1");
    expect(h.onCanonicalMutation).toHaveBeenCalledWith("p1", "checkpoint.delete");

    const h2 = hooks();
    const refused = await deleteCheckpoint(
      localContext({ projectScope: "other" }),
      { projectId: "p1", checkpointId: "cp1" },
      checkpointRepo(),
      h2,
    );
    expect(refused).toMatchObject({ ok: false, status: 403 });
    expect(h2.onCanonicalMutation).not.toHaveBeenCalled();
  });

  it("GET lists through the port after the refusals", async () => {
    const r = checkpointRepo();
    const out = await listCheckpoints(ctx, { projectId: "p1" }, r);
    expect(out).toMatchObject({ ok: true });
    expect(r.findScoped).toHaveBeenCalledWith("p1");
  });
});

describe("story-plans (no §11 hooks — planning artifacts, not canon)", () => {
  it("GET lists through the port; refusals never reach it", async () => {
    const r = planRepo();
    const out = await listStoryPlans(ctx, { projectId: "p1" }, r);
    expect(out).toMatchObject({ ok: true });
    expect(r.findScoped).toHaveBeenCalledWith("p1");

    const refused = await listStoryPlans(localContext({ projectScope: "other" }), { projectId: "p1" }, planRepo());
    expect(refused).toMatchObject({ ok: false, status: 403 });
  });

  it("PATCH: ownership is proved BEFORE the beats encoding, so 404 still beats 400", async () => {
    const notOwned = planRepo({ ownsProject: vi.fn(async () => false) as never });
    const out404 = await updateStoryPlan(
      ctx,
      { projectId: "p1", planId: "pl1", beats: "garbage" },
      notOwned,
    );
    expect(out404).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(notOwned.updateScoped).not.toHaveBeenCalled();

    const owned = planRepo();
    const out400 = await updateStoryPlan(ctx, { projectId: "p1", planId: "pl1", beats: "garbage" }, owned);
    expect(out400).toEqual({ ok: false, status: 400, reason: "Invalid beats shape." });
    expect(owned.updateScoped).not.toHaveBeenCalled();
  });

  it("PATCH: title passes through unvalidated (as before), beats encode, updatedAt stamps, and 404 on no match", async () => {
    const r = planRepo();
    const out = await updateStoryPlan(
      ctx,
      { projectId: "p1", planId: "pl1", title: "New title", beats: [{ id: "b1", order: 1, label: "Open" }] },
      r,
    );
    expect(out).toMatchObject({ ok: true, plan: { id: "pl1" } });
    const sent = r.updateScoped.mock.calls[0]![2]!;
    expect(sent.title).toBe("New title");
    expect(Array.isArray(sent.beats)).toBe(true);
    expect((sent.updatedAt as Date).constructor.name).toBe("Date");

    const noMatch = planRepo({ updateScoped: vi.fn(async () => null) as never });
    const out404 = await updateStoryPlan(ctx, { projectId: "p1", planId: "pl1", title: "x" }, noMatch);
    expect(out404).toEqual({ ok: false, status: 404, reason: "Not found" });
  });

  it("DELETE: silent ok on a zero-match scoped delete; refusals fire nothing", async () => {
    const r = planRepo();
    const out = await deleteStoryPlan(ctx, { projectId: "p1", planId: "bogus" }, r);
    expect(out).toEqual({ ok: true });
    expect(r.deleteScoped).toHaveBeenCalledWith("p1", "bogus");

    const refused = await deleteStoryPlan(
      localContext({ projectScope: "other" }),
      { projectId: "p1", planId: "pl1" },
      planRepo(),
    );
    expect(refused).toMatchObject({ ok: false, status: 403 });
  });
});
