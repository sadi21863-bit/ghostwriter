import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";

import { createSqliteDb, type SqliteDbHandle } from "@/db/sqlite";
import { SQLITE_DDL } from "@/db/sqlite-ddl";
import {
  chapters,
  characterRelationships,
  characters,
  plotThreads,
  projects,
  storyCheckpoints,
  storyMemories,
  storyPlans,
  storyPromises,
  storyThreads,
  users,
  worldEntities,
} from "@/db/sqlite-schema";
import { cloudContext } from "@/lib/core/request-context";
import type { PostCommitHooks } from "@/lib/core/repositories";
import {
  computeCheckpointSnapshot,
  createCheckpoint,
  listCheckpoints,
} from "@/lib/core/handlers/story-checkpoints";
import {
  createStoryMemory,
  deleteStoryMemory,
  listStoryMemories,
} from "@/lib/core/handlers/story-memories";
import {
  createStoryPromise,
  createStoryThread,
  listStoryState,
  updateStoryPromise,
  updateStoryThread,
} from "@/lib/core/handlers/story-state";
import { listStoryPlans, updateStoryPlan, deleteStoryPlan } from "@/lib/core/handlers/story-plans";
import { readStoryGraph } from "@/lib/core/handlers/story-graph";
import {
  makeSqliteStoryCheckpointRepository,
  makeSqliteStoryGraphRepository,
  makeSqliteStoryMemoryRepository,
  makeSqliteStoryPlanRepository,
  makeSqliteStoryStateRepository,
} from "@/lib/core/sqlite-story-os-repos";

/**
 * The story-OS slice of the sqlite tracer's real-DB parity suite
 * (docs/migration/phase3-prep.md §4): five SQLite factories mirroring
 * `pg-story-os-repos.ts`' five objects (Promise-Tracker story-state, memories,
 * the graph read, checkpoints, plans), driven here through the REAL handlers —
 * no mocks for reachability questions.
 *
 * Covers: the story-state GET shape (threads oldest-first with promises
 * grouped under pg's relation field name, unlinked promises attached to
 * nothing), the create/update verbs + the `?? null` reset through the branch
 * payloads, the embedding honesty (the promise seam never embeds locally —
 * the column doesn't exist, and a stray key is stripped at the insert), the
 * graph read's re-expression (probe + five sibling loads merging into the
 * full project row + the independent storedRels read incl. the vanished
 * project's `?? null` shape), the checkpoint health read's projected shape
 * computed through the REAL `computeCheckpointSnapshot` formula, the plans'
 * encoded-beats update with 404-before-400 ordering, the silent zero-match
 * deletes (memories/checkpoints/plans), FK cascades/set-null, DDL presence
 * for all five tables, and the cumulative source-purity grep.
 */

// One fresh in-memory database per test; disposed afterEach so vitest reports
// no open async handles.
const created: SqliteDbHandle[] = [];
function fresh() {
  const handle = createSqliteDb(":memory:");
  created.push(handle);
  return handle;
}
afterEach(() => {
  for (const h of created) h.sqlite.close();
  created.length = 0;
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const hooks = (log: string[] = []): PostCommitHooks => ({
  onCanonicalMutation: async (projectId, kind) => {
    log.push(`hook:${kind}`);
  },
});

/** Seed user + project (+ alien project), plus chapter/plot-thread rows for the graph + health reads. */
async function seed() {
  const handle = fresh();
  const [user] = await handle.db.insert(users).values({ email: "u1@test.dev" }).returning();
  const [alienUser] = await handle.db.insert(users).values({ email: "u2@test.dev" }).returning();
  const [project] = await handle.db.insert(projects).values({ userId: user.id }).returning();
  const [alien] = await handle.db.insert(projects).values({ userId: alienUser.id }).returning();

  await handle.db.insert(chapters).values({ id: "ch-1", projectId: project.id, title: "ch one", wordCount: 500, arcPosition: "rise" });
  await sleep(5);
  await handle.db.insert(chapters).values({ id: "ch-2", projectId: project.id, title: "ch two", wordCount: 100, arcPosition: "fall" });
  await handle.db.insert(chapters).values({ id: "ch-alien", projectId: alien.id, title: "alien" });

  await handle.db.insert(plotThreads).values({ id: "pt-1", projectId: project.id, name: "A thread", status: "Active", starvationWarning: false });
  await handle.db.insert(plotThreads).values({ id: "pt-2", projectId: project.id, name: "Starving", status: "Active", starvationWarning: true });
  await handle.db.insert(plotThreads).values({ id: "pt-3", projectId: project.id, name: "Idle", status: "open", starvationWarning: false });

  // Real characters so the graph test's character_relationships rows satisfy
  // the FK (relationship link ids are not project-scoped at the table level,
  // but the FK to characters still must resolve).
  await handle.db.insert(characters).values([
    { id: "ch-a", projectId: project.id, name: "Mara" },
    { id: "ch-b", projectId: project.id, name: "Sole" },
    { id: "ax", projectId: alien.id, name: "Ax" },
    { id: "ay", projectId: alien.id, name: "Ay" },
  ]);

  return {
    handle,
    db: handle.db,
    user,
    project,
    alien,
    state: makeSqliteStoryStateRepository(handle.db),
    memories: makeSqliteStoryMemoryRepository(handle.db),
    graph: makeSqliteStoryGraphRepository(handle.db),
    checkpoints: makeSqliteStoryCheckpointRepository(handle.db),
    plans: makeSqliteStoryPlanRepository(handle.db),
  };
}

describe("story-state through the real handlers — the Promise Tracker GET shape", () => {
  it("threads oldest-first, each carrying its promises under pg's relation field name; a null-threadId promise attaches to nothing", async () => {
    const { user, project, state, db } = await seed();

    const made = await createStoryThread(
      cloudContext(user.id),
      { projectId: project.id, data: { name: "The Long Night" } },
      state,
      hooks(),
    );
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const thread = made.thread;
    // Returning fidelity: $defaultFn uuid, Date createdAt, the handler's
    // insert defaults (threadType subplot, empty notes) already upstream.
    expect(thread.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(thread.createdAt).toBeInstanceOf(Date);
    expect((thread as Record<string, unknown>).threadType).toBe("subplot");

    await sleep(5);
    await createStoryThread(
      cloudContext(user.id),
      { projectId: project.id, data: { name: "Second" } },
      state,
    );

    const linked = await createStoryPromise(
      cloudContext(user.id),
      { projectId: project.id, data: { setup: "the gun appears", threadId: thread.id, priority: "A" } },
      state,
      hooks(),
    );
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    // Fire-and-forget embedding seam: fail-open default, nothing embedded —
    // and the row's return shape has no embedding field at all (the column
    // doesn't exist locally; honesty over placeholder).
    expect(Object.keys(linked.promise)).not.toContain("embedding");

    await createStoryPromise(
      cloudContext(user.id),
      { projectId: project.id, data: { setup: "unlinked promise" } },
      state,
    );

    const list = await listStoryState(cloudContext(user.id), { projectId: project.id }, state);
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.threads.map((t) => t.name)).toEqual(["The Long Night", "Second"]);
    const grouped = list.threads[0] as Record<string, unknown>;
    const promises = grouped.promises as Record<string, unknown>[];
    expect(promises).toHaveLength(1);
    expect(promises[0]).toMatchObject({ setup: "the gun appears", priority: "A" });
    expect((list.threads[1] as Record<string, unknown>).promises).toEqual([]);

    // A stray embedding key never corrupts the INSERT locally (the strip
    // keeps the column list clean; on pg it would write — degraded, not faked).
    const stray = await state.createPromise(project.id, {
      setup: "stray embed",
      embedding: [0.1, 0.2],
    } as never);
    expect(stray.setup).toBe("stray embed");
    // Raw proof: the unlinked promise is where the grouping left it — in
    // no thread's list.
    const [unlinked] = await Promise.all([
      db.select().from(storyPromises).where(eq(storyPromises.setup, "unlinked promise")),
    ]);
    expect(unlinked[0]!.threadId).toBeNull();
    void user;
  });

  it("update verbs reset the ?? null fields for real (a cleared resolvedAtChapterId stores null) and no-match updates 404 through the handler", async () => {
    const { user, project, state, db } = await seed();
    const made = await createStoryThread(
      cloudContext(user.id),
      { projectId: project.id, data: { name: "T" } },
      state,
    );
    if (!made.ok) throw new Error("seed failed");
    const threadId = made.thread.id;

    const updated = await updateStoryThread(
      cloudContext(user.id),
      { projectId: project.id, threadId, patch: { status: "resolved" } },
      state,
      hooks(),
    );
    expect(updated.ok).toBe(true);
    const row = (await db.query.storyThreads.findFirst({
      where: eq(storyThreads.name, "T"),
    })) as unknown as Record<string, unknown>;
    // The route's `?? null` normalization is part of every update — a REAL
    // null write, not a skipped key.
    expect(row.resolvedAtChapterId).toBeNull();

    // Promise's payoffChapterId ?? null — the same reset through the other verb.
    const promise = await state.createPromise(project.id, {
      setup: "p",
      threadId: threadId,
    });
    const patched = await updateStoryPromise(
      cloudContext(user.id),
      { projectId: project.id, promiseId: promise.id, patch: { status: "paid" } },
      state,
      hooks(),
    );
    expect(patched.ok).toBe(true);
    const promiseRow = (await db.query.storyPromises.findFirst({
      where: eq(storyPromises.id, promise.id),
    })) as unknown as Record<string, unknown>;
    expect(promiseRow.payoffChapterId).toBeNull();

    // No-match: a bogus threadId → 404 (the handler's contract, over real rows).
    const bogus = await updateStoryThread(
      cloudContext(user.id),
      { projectId: project.id, threadId: "no-such-thread", patch: { status: "resolved" } },
      state,
    );
    expect(bogus).toEqual({ ok: false, status: 404, reason: "Not found" });
    void user;
  });
});

describe("story-memories through the real handlers — newest-first + silent deletes", () => {
  it("create carries the handler's normalization (trimmed fact, decoded structuredData, autoExtracted false); findScoped orders desc; delete is silent on zero match; hooks fire post-write", async () => {
    const log: string[] = [];
    const { user, project, memories } = await seed();

    const made = await createStoryMemory(
      cloudContext(user.id),
      {
        projectId: project.id,
        fact: "  Mara kept the ledger  ",
        category: "plot",
        structuredData: { chapterTitle: "ch one", keyEvents: ["ledger"] },
      },
      memories,
      hooks(log),
    );
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(made.memory.fact).toBe("Mara kept the ledger");
    expect((made.memory as Record<string, unknown>).structuredData).toEqual({
      chapterTitle: "ch one",
      keyEvents: ["ledger"],
    });
    expect((made.memory as Record<string, unknown>).autoExtracted).toBe(false);
    expect(log).toEqual(["hook:memory.create"]);

    // Second memory (timed apart so the desc order is observable), no
    // structuredData → the handler normalizes it to a real null.
    await sleep(5);
    await createStoryMemory(
      cloudContext(user.id),
      { projectId: project.id, fact: "Second memory" },
      memories,
    );
    const after = await listStoryMemories(cloudContext(user.id), { projectId: project.id }, memories);
    if (!after.ok) throw new Error("list failed");
    expect(after.memories).toHaveLength(2);
    // Desc order: the newest memory first.
    expect(after.memories[0].fact).toBe("Second memory");
    // The second memory's structuredData is a REAL null (the handler's
    // `!= null → null` normalization), the first memory's is the decoded
    // object — both pinned.
    expect((after.memories[0] as Record<string, unknown>).structuredData).toBeNull();
    expect((after.memories[1] as Record<string, unknown>).structuredData).toEqual({
      chapterTitle: "ch one",
      keyEvents: ["ledger"],
    });

    // Scoped delete + zero-match silent ok — the original route's exact behaviour.
    const deleted = await deleteStoryMemory(
      cloudContext(user.id),
      { projectId: project.id, memoryId: after.memories[0].id },
      memories,
      hooks(log),
    );
    expect(deleted).toEqual({ ok: true });
    const bogus = await deleteStoryMemory(
      cloudContext(user.id),
      { projectId: project.id, memoryId: "no-such-memory" },
      memories,
      hooks(log),
    );
    expect(bogus).toEqual({ ok: true });
    expect(log).toEqual(["hook:memory.create", "hook:memory.delete", "hook:memory.delete"]);
  });
});

describe("story-graph through the real handler — the read → build → health data plane", () => {
  it("readGraphData returns the full project row with the five relation arrays under pg's field names, storedRels independent and project-scoped", async () => {
    const { user, project, graph, db, alien } = await seed();
    // A stored relationship for THIS project + one for the alien project
    // (scoping proof).
    await db.insert(characterRelationships).values({
      projectId: project.id,
      characterAId: "ch-a",
      characterBId: "ch-b",
      trustLevel: 60,
      relationshipType: "rivals",
    });
    await db.insert(characterRelationships).values({
      projectId: alien.id,
      characterAId: "ax",
      characterBId: "ay",
    });

    const data = await graph.readGraphData(project.id);
    expect((data.project as Record<string, unknown>).id).toBe(project.id);
    // The seed's two FK-holders for the relationship rows (the alien pair
    // never arrives — per-project predicates).
    expect(
      ((data.project as Record<string, unknown>).characters as { id: string }[]).map((c) => c.id),
    ).toEqual(["ch-a", "ch-b"]);
    expect((data.project as Record<string, unknown>).chapters).toHaveLength(2);
    expect((data.project as Record<string, unknown>).plotThreads).toHaveLength(3);
    expect((data.project as Record<string, unknown>).worldEntities).toEqual([]);
    expect(data.storedRels).toHaveLength(1);
    expect(data.storedRels[0]).toMatchObject({ characterAId: "ch-a", trustLevel: 60 });

    // The full read → build → health handler over the twin: the zero-entity
    // graph shape the real route emits for an unpopulated project.
    const read = await readStoryGraph(cloudContext(user.id), { projectId: project.id }, graph);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    // The pure builder over the twin's data: the seeded rows arrive as graph
    // nodes (characters/threads/chapters; worldEntities empty) — membership
    // pin, not the builder's internal ordering (that's the pure component's
    // own test's job, and identical for pg- and sqlite-sourced data).
    const nodes = (read.graph as unknown as { nodes: { id: string; type: string }[] }).nodes;
    expect(nodes.map((n) => n.id)).toEqual(
      expect.arrayContaining(["ch-a", "ch-b", "pt-1", "pt-2", "pt-3", "ch-1", "ch-2"]),
    );
    expect(nodes.every((n) => typeof n.type === "string")).toBe(true);

    // 404 on the ownership probe (stranger) pages nothing further.
    const refused = await readStoryGraph(cloudContext("stranger"), { projectId: project.id }, graph);
    expect(refused).toEqual({ ok: false, status: 404, reason: "Not found" });

    // Vanished project: pg's `?? null` shape, storedRels honest.
    const vanished = await graph.readGraphData("no-such-project");
    expect(vanished).toEqual({ project: null, storedRels: [] });
  });

  it("world entities ride the graph read's fifth relation (a seeded entity arrives under `worldEntities`)", async () => {
    const { project, graph, db } = await seed();
    await db.insert(worldEntities).values({
      id: "we-1",
      projectId: project.id,
      name: "The Deck",
      kind: "object",
    });
    const data = await graph.readGraphData(project.id);
    const entities = (data.project as Record<string, unknown>).worldEntities as Record<
      string,
      unknown
    >[];
    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({ name: "The Deck", kind: "object" });
  });
});

describe("story-checkpoints through the real handler — projected health read + silent deletes", () => {
  it("readSnapshotInputs carries the exact CheckpointSnapshotInputs shape, computed through the REAL formula; null project → null; create/delete keep their bodies", async () => {
    const log: string[] = [];
    const { user, project, checkpoints } = await seed();

    const inputs = await checkpoints.readSnapshotInputs(project.id);
    expect(inputs).not.toBeNull();
    // Exact per-input-column shape (no more data than the formula consumes).
    expect(Object.keys(inputs!.chapters[0]!)).toEqual(["id", "title", "wordCount", "arcPosition"]);
    expect(Object.keys(inputs!.plotThreads[0]!)).toEqual(["id", "status", "starvationWarning"]);
    // No promises exist in this seed — the projected array reads honestly empty.
    expect(inputs!.storyPromises).toEqual([]);
    const snapshot = computeCheckpointSnapshot(inputs!);
    // Formula truth on the seeded data: 500 + 100 words, 3 open-ish threads
    // ("Active" | "open" both count), 0 open promises, starvation −5,
    // thin chapter (100 < 300) −3.
    expect(snapshot).toEqual({
      totalWordCount: 600,
      chapterCount: 2,
      chapters: [
        { id: "ch-1", title: "ch one", wordCount: 500, arcPosition: "rise" },
        { id: "ch-2", title: "ch two", wordCount: 100, arcPosition: "fall" },
      ],
      openThreadCount: 3,
      openPromises: 0,
      healthScore: 92,
    });

    const made = await createCheckpoint(
      cloudContext(user.id),
      { projectId: project.id, name: "  ", notes: "after ch two" },
      checkpoints,
      hooks(log),
    );
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    // The server-owned name default lives handler-side.
    expect(made.checkpoint.name).toContain("Checkpoint");
    // snapshot rides the typed json column: the same object read back.
    expect((made.checkpoint as Record<string, unknown>).snapshot).toEqual(snapshot);
    expect(log).toEqual(["hook:checkpoint.create"]);

    const list = await listCheckpoints(cloudContext(user.id), { projectId: project.id }, checkpoints);
    if (!list.ok) throw new Error("list failed");
    expect(list.checkpoints).toHaveLength(1);

    // Null project → null (the handler's 404 path upstream on pg too).
    expect(await checkpoints.readSnapshotInputs("no-such-project")).toBeNull();

    // Scoped delete + silent zero-match.
    await checkpoints.deleteScoped(project.id, made.checkpoint.id);
    expect((await checkpoints.findScoped(project.id)).length).toBe(0);
    await checkpoints.deleteScoped(project.id, "no-such-checkpoint");
  });
});

describe("story-plans through the real handlers — 404 before 400 on beats", () => {
  it("update encodes beats through the story guard AFTER ownership, so 404 beats 400; the typed array round-trips TEXT; delete is silent on zero match", async () => {
    const { handle, project, plans, user } = await seed();
    await handle.db.insert(storyPlans).values({
      id: "plan-1",
      projectId: project.id,
      kind: "beat_sheet",
      title: "Beat Sheet",
      beats: [{ id: "b1", order: 1, label: "opening beat" } as never],
    });

    // 404 first (stranger) even with garbage beats — the handler orders
    // ownership before the encode rejection, and the sqlite twin preserves it.
    const refused = await updateStoryPlan(
      cloudContext("stranger"),
      { projectId: project.id, planId: "plan-1", beats: { not: "an array" } },
      plans,
    );
    expect(refused).toEqual({ ok: false, status: 404, reason: "Not found" });

    // Ownership ok + bad beats → 400 "Invalid beats shape." (encodeStoryBeats).
    const badBeats = await updateStoryPlan(
      cloudContext(user.id),
      { projectId: project.id, planId: "plan-1", beats: { not: "an array" } },
      plans,
    );
    expect(badBeats).toEqual({ ok: false, status: 400, reason: "Invalid beats shape." });

    // Good beats + title: the full patch through the adapter.
    const updated = await updateStoryPlan(
      cloudContext(user.id),
      {
        projectId: project.id,
        planId: "plan-1",
        title: "Act I beats",
        beats: [
          { id: "b1", order: 1, label: "opening beat" },
          { id: "b2", order: 2, label: "reveal" },
        ],
      },
      plans,
    );
    expect(updated.ok).toBe(true);
    const row = (await handle.db.select().from(storyPlans)).find((p) => p.id === "plan-1");
    expect(row!.title).toBe("Act I beats");
    // Typed StoryBeat[] through `mode:"json"` — the exact array, not a string.
    expect((row!.beats as unknown[]).length).toBe(2);
    expect((row!.beats as { label: string }[])[1]!.label).toBe("reveal");
    expect(row!.updatedAt).toBeInstanceOf(Date);

    const deleted = await deleteStoryPlan(
      cloudContext(user.id),
      { projectId: project.id, planId: "plan-1" },
      plans,
    );
    expect(deleted).toEqual({ ok: true });
    // Zero-match delete stays a silent ok.
    const bogus = await deleteStoryPlan(
      cloudContext(user.id),
      { projectId: project.id, planId: "no-such-plan" },
      plans,
    );
    expect(bogus).toEqual({ ok: true });
  });
});

describe("real-DB-specific — FK cascade + set-null + DDL presence", () => {
  it("deleting a thread SET-NULLs its promises' threadId; deleting the project cascades everything story-OS", async () => {
    const { handle, project, state, memories, checkpoints, user } = await seed();
    const made = await createStoryThread(
      cloudContext(user.id),
      { projectId: project.id, data: { name: "Cascade thread" } },
      state,
    );
    if (!made.ok) throw new Error("seed failed");
    await state.createPromise(
      project.id,
      { setup: "cascade promise", threadId: made.thread.id } as never,
    );
    await memories.create(project.id, { fact: "cascade memory" });
    await checkpoints.create(project.id, { name: "cascade checkpoint", snapshot: {} as never });
    await handle.db.insert(storyPlans).values({ projectId: project.id, title: "cascade plan" });

    // Thread delete set-nulls the promise (declared FK, enforced locally).
    await handle.db.delete(storyThreads).where(eq(storyThreads.name, "Cascade thread"));
    const [promiseRow] = await Promise.all([
      handle.db.select().from(storyPromises).where(eq(storyPromises.setup, "cascade promise")),
    ]);
    expect(promiseRow[0]!.threadId).toBeNull();

    // Project delete cascades everything.
    await handle.db.delete(projects).where(eq(projects.id, project.id));
    expect(await handle.db.select().from(storyPromises)).toEqual([]);
    expect(await handle.db.select().from(storyThreads)).toEqual([]);
    expect(await handle.db.select().from(storyMemories)).toEqual([]);
    expect(await handle.db.select().from(storyCheckpoints)).toEqual([]);
    expect(await handle.db.select().from(storyPlans)).toEqual([]);
  });

  it("the vendored DDL includes all five story-OS tables and honestly omits the promises embedding column", () => {
    expect(SQLITE_DDL).toContain('CREATE TABLE "story_threads"');
    expect(SQLITE_DDL).toContain('CREATE TABLE "story_promises"');
    expect(SQLITE_DDL).toContain('CREATE TABLE "story_memories"');
    expect(SQLITE_DDL).toContain('CREATE TABLE "story_checkpoints"');
    expect(SQLITE_DDL).toContain('CREATE TABLE "story_plans"');
    // The honesty pin: no vector column exists anywhere in this baseline.
    expect(SQLITE_DDL).not.toContain('embedding vector');
  });
});

describe("source purity of the sqlite layer (live-shell-reachability convention)", () => {
  const FILES = [
    join(__dirname, "../../../db/sqlite.ts"),
    join(__dirname, "../../../db/sqlite-schema.ts"),
    join(__dirname, "../../../db/sqlite-ddl.ts"),
    join(__dirname, "../sqlite-character-location-repos.ts"),
    join(__dirname, "../sqlite-thread-reference-repos.ts"),
    join(__dirname, "../sqlite-world-entity-repos.ts"),
    join(__dirname, "../sqlite-relationship-repos.ts"),
    join(__dirname, "../sqlite-project-crud.ts"),
    join(__dirname, "../sqlite-comic-repos.ts"),
    join(__dirname, "../sqlite-production-shot-repos.ts"),
    join(__dirname, "../sqlite-story-os-repos.ts"),
  ];

  it("the sqlite layer never imports the Neon side or the Next runtime", () => {
    for (const file of FILES) {
      const source = readFileSync(file, "utf-8");
      // Exact `@/db` alias (quote-delimited) and the pg schema alias — the
      // sqlite layer's legitimate imports are `@/db/sqlite` /
      // `@/db/sqlite-schema` / `@/db/sqlite-ddl`, which these regexes
      // deliberately do not match.
      expect(source, file).not.toMatch(/"@\/db"|'@\/db'|"@\/db\/schema"|'@\/db\/schema'/);
      expect(source, file).not.toMatch(/"next(\/|-auth)?"/);
      expect(source, file).not.toMatch(/@neondatabase\/serverless/);
    }
  }, 20000);
});
