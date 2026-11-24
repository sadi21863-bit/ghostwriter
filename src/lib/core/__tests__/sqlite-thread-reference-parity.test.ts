import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createSqliteDb, type SqliteDbHandle } from "@/db/sqlite";
import { SQLITE_DDL } from "@/db/sqlite-ddl";
import { plotThreads, projects, referenceWorks, users } from "@/db/sqlite-schema";
import { cloudContext } from "@/lib/core/request-context";
import type { PostCommitHooks } from "@/lib/core/repositories";
import {
  createPlotThread,
  deletePlotThread,
  updatePlotThread,
} from "@/lib/core/handlers/plot-threads";
import {
  createReferenceWork,
  deleteReferenceWork,
} from "@/lib/core/handlers/reference-works";
import {
  makeSqlitePlotThreadCrudRepository,
  makeSqliteReferenceWorkCrudRepository,
} from "@/lib/core/sqlite-thread-reference-repos";

/**
 * The thread-reference slice of the sqlite tracer's real-DB parity suite
 * (docs/migration/phase3-prep.md §4): the same handler functions as
 * `thread-reference-crud.test.ts`, driven against a real node:sqlite database
 * through the sqlite-proxy drizzle baseline — no mocks for reachability
 * questions. Mirrors the contract assertions with real observables (row counts
 * instead of call spies where the DB can answer), plus the DB-specific cases
 * the contract mock cannot express (jsonb-as-TEXT round-trip through
 * `reference_works.attributes`, FK cascade, DDL presence of both tables).
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

const hooks = (log: string[] = []): PostCommitHooks => ({
  onCanonicalMutation: async (projectId, kind) => {
    log.push(`hook:${kind}`);
  },
});

const threadData = (name = "Red Line") => ({
  name,
  description: "Who kept the ledger",
  status: "Paused",
  stakes: "If the ledger leaks, Alex is done",
  connections: "Alex, Doppo",
  alwaysInContext: false,
  sortOrder: 4,
});

/** Seed one user + one project, and return repos wired to that database. */
async function seed() {
  const handle = fresh();
  const [user] = await handle.db.insert(users).values({ email: "u1@test.dev" }).returning();
  const [project] = await handle.db.insert(projects).values({ userId: user.id }).returning();
  return {
    handle,
    db: handle.db,
    user,
    project,
    threadRepo: makeSqlitePlotThreadCrudRepository(handle.db),
    refRepo: makeSqliteReferenceWorkCrudRepository(handle.db),
  };
}

describe("createPlotThread through the real adapter", () => {
  it("happy path — uuid id, column-level round-trip of every supplied field, Date timestamps, hook fires", async () => {
    const log: string[] = [];
    const { user, project, threadRepo } = await seed();
    const result = await createPlotThread(
      cloudContext(user.id),
      { projectId: project.id, data: threadData() },
      threadRepo,
      hooks(log),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Ids are client-generated uuids ($defaultFn in sqlite-schema.ts).
    expect(result.thread.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.thread.projectId).toBe(project.id);
    expect(result.thread.name).toBe("Red Line");
    expect(result.thread.description).toBe("Who kept the ledger");
    expect(result.thread.status).toBe("Paused");
    expect(result.thread.stakes).toBe("If the ledger leaks, Alex is done");
    expect(result.thread.connections).toBe("Alex, Doppo");
    // boolean/integer mode columns round-trip real types on real rows.
    expect(result.thread.alwaysInContext).toBe(false);
    expect(result.thread.sortOrder).toBe(4);
    // epoch-ms integer columns surface as real Date objects (timestamp_ms mode).
    expect(result.thread.createdAt).toBeInstanceOf(Date);
    expect(result.thread.updatedAt).toBeInstanceOf(Date);
    expect(log).toEqual(["hook:plotThread.create"]);
  });

  it("an name-only create keeps hitting the vendored DDL defaults, exactly where pg's column defaults sat", async () => {
    const { user, project, threadRepo } = await seed();
    const result = await createPlotThread(
      cloudContext(user.id),
      { projectId: project.id, data: { name: "Bare thread" } },
      threadRepo,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.thread.description).toBe("");
    expect(result.thread.status).toBe("Active");
    expect(result.thread.stakes).toBe("");
    expect(result.thread.connections).toBe("");
    expect(result.thread.alwaysInContext).toBe(true);
    expect(result.thread.sortOrder).toBe(0);
    expect(result.thread.starvationWarning).toBe(false);
    expect(result.thread.lastMentionedChapterId).toBe(null);
  });

  it("findScoped returns the scoped row and null on a wrong id or wrong project", async () => {
    const { user, project, threadRepo } = await seed();
    const created = await createPlotThread(
      cloudContext(user.id),
      { projectId: project.id, data: threadData() },
      threadRepo,
    );
    if (!created.ok) throw new Error("seed failed");

    const found = await threadRepo.findScoped(project.id, created.thread.id);
    expect(found?.name).toBe("Red Line");
    expect(await threadRepo.findScoped(project.id, "no-such-thread")).toBe(null);
    expect(await threadRepo.findScoped("other-project", created.thread.id)).toBe(null);
  });
});

describe("updatePlotThread / deletePlotThread through the real adapter", () => {
  it("update honors the patch at column level, stamps updatedAt, fires hook:plotThread.update; adapter-level no-match returns null", async () => {
    const log: string[] = [];
    const { user, project, threadRepo } = await seed();
    const created = await createPlotThread(
      cloudContext(user.id),
      { projectId: project.id, data: threadData() },
      threadRepo,
    );
    if (!created.ok) throw new Error("seed failed");
    const tid = created.thread.id;

    const result = await updatePlotThread(
      cloudContext(user.id),
      { projectId: project.id, threadId: tid, patch: { name: "Twist" } },
      threadRepo,
      hooks(log),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.thread.name).toBe("Twist");
    expect(result.thread.stakes).toBe("If the ledger leaks, Alex is done");
    expect(result.thread.updatedAt).toBeInstanceOf(Date);
    expect(log).toEqual(["hook:plotThread.update"]);

    // Adapter-level parity pin: no matching row -> null (the handler 404s on it).
    expect(await threadRepo.updateScoped(project.id, "no-such-thread", { name: "x" })).toBe(null);
  });

  it("handler 404 on a wrong id: no write, no hook (IDOR shape, real rows)", async () => {
    const { handle, user, project, threadRepo } = await seed();
    const log: string[] = [];
    const before = await handle.db.select().from(plotThreads).where(eq(plotThreads.projectId, project.id));

    const result = await updatePlotThread(
      cloudContext(user.id),
      { projectId: project.id, threadId: "no-such-thread", patch: { name: "Twist" } },
      threadRepo,
      hooks(log),
    );

    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(log).toEqual([]);
    const after = await handle.db.select().from(plotThreads).where(eq(plotThreads.projectId, project.id));
    expect(after).toEqual(before);
  });

  it("empty patch — touch only (fresh updatedAt), no canon hook", async () => {
    const { user, project, threadRepo } = await seed();
    const created = await createPlotThread(
      cloudContext(user.id),
      { projectId: project.id, data: threadData() },
      threadRepo,
    );
    if (!created.ok) throw new Error("seed failed");
    const log: string[] = [];

    const result = await updatePlotThread(
      cloudContext(user.id),
      { projectId: project.id, threadId: created.thread.id, patch: {} },
      threadRepo,
      hooks(log),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // PlotThreadRow's index signature types late fields unknown — cast for the
    // wall-clock comparison only.
    const touchedAt = result.thread.updatedAt as Date;
    expect(result.thread.updatedAt).toBeInstanceOf(Date);
    expect(touchedAt.getTime()).toBeGreaterThanOrEqual((created.thread.createdAt as Date).getTime());
    expect(log).toEqual([]);
  });

  it("delete — scoped delete is idempotent, hook fires each call, real row vanishes", async () => {
    const { handle, user, project, threadRepo } = await seed();
    const created = await createPlotThread(
      cloudContext(user.id),
      { projectId: project.id, data: threadData() },
      threadRepo,
    );
    if (!created.ok) throw new Error("seed failed");
    const tid = created.thread.id;
    const log: string[] = [];

    const first = await deletePlotThread(
      cloudContext(user.id),
      { projectId: project.id, threadId: tid },
      threadRepo,
      hooks(log),
    );
    const second = await deletePlotThread(
      cloudContext(user.id),
      { projectId: project.id, threadId: tid },
      threadRepo,
      hooks(log),
    );

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(log).toEqual(["hook:plotThread.delete", "hook:plotThread.delete"]);
    const left = await handle.db.select().from(plotThreads).where(eq(plotThreads.id, tid));
    expect(left).toEqual([]);
  });
});

describe("createReferenceWork through the real adapter — the jsonb→TEXT json round-trip", () => {
  it("supplied attributes: nested object survives TEXT storage and comes back typed, hook fires", async () => {
    const log: string[] = [];
    const { handle, user, project, refRepo } = await seed();
    const attributes = {
      sensoryBias: "smell",
      dialogueTagStyle: "sparse",
      abstractWords: ["justice", "fate"],
      paragraphTexture: { opening: "terse", closing: "lyrical" },
    };
    const result = await createReferenceWork(
      cloudContext(user.id),
      { projectId: project.id, data: { title: "Reedsy Style DNA", attributes } },
      refRepo,
      hooks(log),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reference.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.reference.projectId).toBe(project.id);
    expect(result.reference.title).toBe("Reedsy Style DNA");
    expect(result.reference.attributes).toEqual(attributes);
    expect(result.reference.createdAt).toBeInstanceOf(Date);

    // The column on disk really is TEXT json — core's typed object was encoded
    // at the adapter boundary, exactly the §4.2 discipline.
    const raw = handle.sqlite
      .prepare("SELECT attributes FROM reference_works WHERE id = ?")
      .get(result.reference.id) as { attributes: string } | undefined;
    expect(typeof raw?.attributes).toBe("string");
    expect(JSON.parse(raw!.attributes)).toEqual(attributes);
    expect(log).toEqual(["hook:referenceWork.create"]);
  });

  it("attributes stays untyped like pg's jsonb — an array value round-trips as the same typed array", async () => {
    const { user, project, refRepo } = await seed();
    const result = await createReferenceWork(
      cloudContext(user.id),
      { projectId: project.id, data: { title: "Array attrs", attributes: ["terse", "sparse"] } },
      refRepo,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Read back the same typed array, not a stringified JSON blob.
    expect(result.reference.attributes).toEqual(["terse", "sparse"]);
  });

  it("an omitted attributes never enters the INSERT — the '{}' column default applies and decodes to a typed empty object", async () => {
    const { user, project, refRepo } = await seed();
    const result = await createReferenceWork(
      cloudContext(user.id),
      { projectId: project.id, data: { title: "No attributes" } },
      refRepo,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // A raw JSON string here instead of an object would be the failed decode.
    expect(result.reference.attributes).toEqual({});
  });
});

describe("deleteReferenceWork through the real adapter", () => {
  it("delete — scoped delete is idempotent, hook fires each call, real row vanishes", async () => {
    const { handle, user, project, refRepo } = await seed();
    const created = await refRepo.create(project.id, { title: "Reedsy Style DNA" });
    const log: string[] = [];

    const first = await deleteReferenceWork(
      cloudContext(user.id),
      { projectId: project.id, refId: created.id },
      refRepo,
      hooks(log),
    );
    const second = await deleteReferenceWork(
      cloudContext(user.id),
      { projectId: project.id, refId: created.id },
      refRepo,
      hooks(log),
    );

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(log).toEqual(["hook:referenceWork.delete", "hook:referenceWork.delete"]);
    const left = await handle.db.select().from(referenceWorks).where(eq(referenceWorks.id, created.id));
    expect(left).toEqual([]);
  });
});

describe("403/404 orderings through the real adapter (both repos)", () => {
  it("scope mismatch 403s before the port, non-owned project 404s at the port; refusals write nothing and fire nothing", async () => {
    const { handle, user, project, threadRepo, refRepo } = await seed();
    const log: string[] = [];
    const before = await handle.db.select().from(plotThreads).where(eq(plotThreads.projectId, project.id));
    const rwBefore = await handle.db.select().from(referenceWorks).where(eq(referenceWorks.projectId, project.id));

    const t403 = await createPlotThread(
      cloudContext(user.id, { projectScope: "other-project" }),
      { projectId: project.id, data: threadData() },
      threadRepo,
      hooks(log),
    );
    const t404 = await createPlotThread(
      cloudContext("stranger"),
      { projectId: project.id, data: threadData() },
      threadRepo,
      hooks(log),
    );
    const rw403 = await deleteReferenceWork(
      cloudContext(user.id, { projectScope: "other-project" }),
      { projectId: project.id, refId: "no-such-ref" },
      refRepo,
      hooks(log),
    );
    const rw404 = await deleteReferenceWork(
      cloudContext("stranger"),
      { projectId: project.id, refId: "no-such-ref" },
      refRepo,
      hooks(log),
    );

    expect(t403).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(t404).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(rw403).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(rw404).toEqual({ ok: false, status: 404, reason: "Not found" });
    const after = await handle.db.select().from(plotThreads).where(eq(plotThreads.projectId, project.id));
    const rwAfter = await handle.db.select().from(referenceWorks).where(eq(referenceWorks.projectId, project.id));
    expect(after).toEqual(before);
    expect(rwAfter).toEqual(rwBefore);
    expect(log).toEqual([]);
  });
});

describe("real-DB-specific — FK cascade + DDL presence", () => {
  it("deleting a project cascades its plot threads and reference works", async () => {
    const { handle, project, threadRepo, refRepo } = await seed();
    await threadRepo.create(project.id, threadData());
    await refRepo.create(project.id, { title: "Reedsy Style DNA" });

    await handle.db.delete(projects).where(eq(projects.id, project.id));

    expect(await handle.db.select().from(plotThreads)).toEqual([]);
    expect(await handle.db.select().from(referenceWorks)).toEqual([]);
  });

  it("the vendored DDL includes both tables (the 43-table baseline already carried them)", () => {
    expect(SQLITE_DDL).toContain('CREATE TABLE "plot_threads"');
    expect(SQLITE_DDL).toContain('CREATE TABLE "reference_works"');
  });
});
