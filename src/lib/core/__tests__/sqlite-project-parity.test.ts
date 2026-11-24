import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";

import { createSqliteDb, type SqliteDbHandle } from "@/db/sqlite";
import { SQLITE_DDL } from "@/db/sqlite-ddl";
import {
  chapters,
  characters,
  projects,
  users,
  worldEntities,
} from "@/db/sqlite-schema";
import { cloudContext } from "@/lib/core/request-context";
import type { PostCommitHooks, ProjectRow } from "@/lib/core/repositories";
import {
  PROJECT_LIMIT_REACHED_BODY,
  createProject,
  deleteProject,
  listProjects,
  readProject,
  updateProject,
  type ProjectsCoreRepository,
  type ProjectTierResolver,
} from "@/lib/core/handlers/projects";
import { encodeAIRules } from "@/lib/types/story";
import { makeSqliteProjectCrudRepository } from "@/lib/core/sqlite-project-crud";

/**
 * The project-crud slice of the sqlite tracer's real-DB parity suite
 * (docs/migration/phase3-prep.md §4): the same handler functions as
 * `projects-core.test.ts`, driven against a real node:sqlite database through
 * the sqlite-proxy drizzle baseline — no mocks for reachability questions.
 * Covers the REAL verb surface (`ownsProject`/`listForUser`/`countForUser`/
 * `create`/`read`/`updateScoped`/`deleteScoped` — all seven, verified against
 * both consumers: the two cloud routes and `local-host.ts`'s five /projects
 * mounts), the create's `.returning()` fidelity + seeded `Chapter 1`, the
 * tier cap through the INJECTED `getTier` parameter (the cap never lives in
 * the adapter — `countForUser` is its only cap-facing verb), list
 * scoping/ordering parity, the 403/404 orderings on the three scoped verbs,
 * the jsonb columns' `mode:"json"` round-trip (adapter pass-through, like
 * pg), the FK cascades (project → children, user → project), and the
 * declared-baseline DDL pins.
 */

// One fresh in-memory database per test; disposed afterEach so vitest reports
// no open async handles.
const createdDbs: SqliteDbHandle[] = [];
function fresh() {
  const handle = createSqliteDb(":memory:");
  createdDbs.push(handle);
  return handle;
}
afterEach(() => {
  for (const h of createdDbs) h.sqlite.close();
  createdDbs.length = 0;
});

const hooks = (log: string[] = []): PostCommitHooks => ({
  onCanonicalMutation: async (projectId, kind) => {
    log.push(`hook:${kind}`);
  },
});

/** A fixed-tier resolver — the injected seam the routes supply `getUserTier` for. */
const tierOf = (tier: string): ProjectTierResolver => async () => tier as SubscriptionTierValue;
/** Local alias so the test keeps `@/types/subscription` out of its runtime imports. */
type SubscriptionTierValue = Awaited<ReturnType<ProjectTierResolver>>;

/** Seed one user and return the repo wired to that database. */
async function seed() {
  const handle = fresh();
  const [user] = await handle.db.insert(users).values({ email: "u1@test.dev" }).returning();
  return {
    handle,
    db: handle.db,
    sqlite: handle.sqlite,
    user,
    repo: makeSqliteProjectCrudRepository(handle.db),
  };
}

/** Count all project rows — the number the tier cap is judged against. */
const countRows = (db: Awaited<ReturnType<typeof fresh>>["db"]) =>
  db.select().from(projects).then((rows) => rows.length);

describe("createProject through the real adapter — returning fidelity + seeded Chapter 1", () => {
  it("happy path — uuid id, every supplied field round-trips, omitted fields hit the column defaults, Date timestamps, hook fires", async () => {
    const log: string[] = [];
    const { handle, user, repo } = await seed();

    const result = await createProject(
      cloudContext(user.id),
      {
        data: {
          name: "Debt Gravity",
          format: "Comic",
          skillLevel: "intermediate",
          genres: ["Fantasy"],
          storyType: "series",
          biggestChallenge: "stakes",
        },
      },
      repo,
      hooks(log),
      tierOf("story_pro"),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p = result.project;
    // Ids are client-generated uuids ($defaultFn in sqlite-schema.ts) — the
    // pg `defaultRandom()` equivalent, surfaced through `.returning()`.
    expect(p.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(p.userId).toBe(user.id);
    expect(p["name"]).toBe("Debt Gravity");
    expect(p["format"]).toBe("Comic");
    expect(p["skillLevel"]).toBe("intermediate");
    expect(p["genres"]).toEqual(["Fantasy"]);
    expect(p["storyType"]).toBe("series");
    expect(p["biggestChallenge"]).toBe("stakes");
    // Fields the POST never sent applied the pg schema defaults on read.
    expect(p["notes"]).toBe("");
    expect(p["controllingIdea"]).toBe("");
    expect(p["dismissedGuideIds"]).toEqual([]);
    expect(p["intentionalViolations"]).toEqual({});
    expect(p["aiRules"]).toEqual([]);
    expect(p["isHiggsfieldProject"]).toBe(false);
    expect(p["narratorVoice"]).toBe("");
    expect(p["narrativeStructure"]).toBe("linear");
    expect(p["qualityGradingEnabled"]).toBe(false);
    expect(p["aiismsCheck"]).toBe(false);
    expect(p["universeId"]).toBe(null);
    expect(p["timelineSort"]).toBe(null);
    expect(p["phase"]).toBe(null);
    expect(p["seriesParentId"]).toBe(null);
    expect(p["adaptedFromProjectId"]).toBe(null);
    expect(p["aiInitiative"]).toBe("Collaborates");
    expect(p["densityLevel"]).toBe("standard");
    expect(p["contentRevision"]).toBe(null);
    // epoch-ms integer columns surface as real Date objects (timestamp_ms mode).
    expect(p["createdAt"]).toBeInstanceOf(Date);
    expect(p["updatedAt"]).toBeInstanceOf(Date);
    expect(log).toEqual(["hook:project.create"]);

    // The same 28-column row the pg adapter's `.returning()` carries. Sorted
    // compare: the baseline's declaration places `genres` before `format`
    // (pg declares `format` first — a documented, inert key-ORDER swap).
    expect(Object.keys(p).sort()).toEqual(
      [
        "id", "userId", "name", "genres", "format", "skillLevel", "notes",
        "controllingIdea", "dismissedGuideIds", "intentionalViolations", "aiRules",
        "isHiggsfieldProject", "narratorVoice", "narrativeStructure", "qualityGradingEnabled",
        "aiismsCheck", "storyType", "universeId", "timelineSort", "phase",
        "seriesParentId", "adaptedFromProjectId", "biggestChallenge", "aiInitiative",
        "densityLevel", "contentRevision", "createdAt", "updatedAt",
      ].sort(),
    );

    // The seeded `Chapter 1`: the second (non-transactional, same as pg)
    // insert sits right after the project row.
    const seeded = await handle.db.select().from(chapters).where(eq(chapters.projectId, p.id));
    expect(seeded.length).toBe(1);
    expect(seeded[0]!.title).toBe("Chapter 1");
    expect(seeded[0]!.sortOrder).toBe(0);
    expect(seeded[0]!.wordCount).toBe(0);
    expect(seeded[0]!.projectId).toBe(p.id);
  });

  it("the pre-migration `||` defaults (not `??`) apply through the real insert — an empty-string name still falls back", async () => {
    const { user, repo } = await seed();
    const fallen = await createProject(
      cloudContext(user.id),
      { data: { name: "", format: "" } },
      repo,
      {},
      tierOf("story_pro"),
    );
    expect(fallen.ok).toBe(true);
    if (!fallen.ok) return;
    expect(fallen.project["name"]).toBe("Untitled");
    expect(fallen.project["format"]).toBe("Novel");

    // Bare bodies default the whole set.
    const bare = await createProject(
      cloudContext(user.id),
      { data: {} },
      repo,
      {},
      tierOf("all_access"),
    );
    expect(bare.ok).toBe(true);
    if (!bare.ok) return;
    expect(bare.project["skillLevel"]).toBe("beginner");
    expect(bare.project["genres"]).toEqual([]);
    expect(bare.project["storyType"]).toBe("linear");
    expect(bare.project["biggestChallenge"]).toBe("");
  });

  it("a create for an unknown user is refused by the FK (foreign_keys=ON reproduces pg instead of storing an orphan)", async () => {
    const { repo } = await seed();
    const err = (await repo
      .create("ghost-user", {
        name: "orphan", format: "Novel", skillLevel: "beginner",
        genres: [], storyType: "linear", biggestChallenge: "",
      })
      .catch((e: unknown) => e)) as Error & { cause?: { message?: string } };
    expect(err).toBeInstanceOf(Error);
    // Drizzle wraps the driver error (`Failed query: …`); the real SQLite
    // message is the cause.
    expect(`${err.message}\n${err.cause?.message ?? ""}`).toMatch(/FOREIGN KEY constraint failed/);
  });
});

describe("the tier cap through the injected getTier — the adapter's only cap-facing verb is countForUser", () => {
  it("free tier at cap: the EXACT pre-migration 403 body, countForUser paged, no project written, no hooks", async () => {
    const log: string[] = [];
    const { handle, user, repo } = await seed();
    // Seed exactly the free-tier cap of 3 owned projects.
    for (let i = 0; i < 3; i++) {
      await handle.db.insert(projects).values({ userId: user.id, name: `P${i}` });
    }
    expect(await countRows(handle.db)).toBe(3);
    const chaptersBefore = await handle.db.select().from(chapters);

    const calls: string[] = [];
    const watched: ProjectsCoreRepository = {
      ...repo,
      countForUser: async (actorId) => {
        calls.push("countForUser");
        return repo.countForUser(actorId);
      },
      create: async (actorId, data) => {
        calls.push("create");
        return repo.create(actorId, data);
      },
    };

    const refused = await createProject(
      cloudContext(user.id),
      { data: { name: "one too many" } },
      watched,
      hooks(log),
      tierOf("free"),
    );
    expect(refused).toEqual({
      ok: false,
      status: 403,
      reason: "project-limit",
      body: PROJECT_LIMIT_REACHED_BODY,
    });
    // The cap's call sequence: tier resolved -> count -> refuse. `create`
    // is never reached.
    expect(calls).toEqual(["countForUser"]);
    expect(log).toEqual([]);
    // Nothing written — the seeded-chapter table untouched too.
    expect(await countRows(handle.db)).toBe(3);
    expect(await handle.db.select().from(chapters)).toEqual(chaptersBefore);
  });

  it("free tier one below cap: create succeeds, and the NEXT create after it refuses (real boundary walk)", async () => {
    const log: string[] = [];
    const { handle, user, repo } = await seed();
    for (let i = 0; i < 2; i++) {
      await handle.db.insert(projects).values({ userId: user.id, name: `P${i}` });
    }

    const third = await createProject(
      cloudContext(user.id),
      { data: { name: "P2" } },
      repo,
      hooks(log),
      tierOf("free"),
    );
    expect(third.ok).toBe(true);
    if (!third.ok) return;
    expect(await countRows(handle.db)).toBe(3);
    expect(log).toEqual(["hook:project.create"]); // hook fired before the cap walk
    // Its seeded chapter landed; the cap count ignores children anyway.
    expect(
      (await handle.db.select().from(chapters).where(eq(chapters.projectId, third.project.id))).length,
    ).toBe(1);

    const fourth = await createProject(
      cloudContext(user.id),
      { data: { name: "P3" } },
      repo,
      hooks(log),
      tierOf("free"),
    );
    expect(fourth).toEqual({
      ok: false,
      status: 403,
      reason: "project-limit",
      body: PROJECT_LIMIT_REACHED_BODY,
    });
    expect(await countRows(handle.db)).toBe(3);
  });

  it("an unlimited tier (-1) skips the count entirely and creates past any cap", async () => {
    const { handle, user, repo } = await seed();
    for (let i = 0; i < 4; i++) {
      await handle.db.insert(projects).values({ userId: user.id, name: `P${i}` });
    }
    const calls: string[] = [];
    const watched: ProjectsCoreRepository = {
      ...repo,
      countForUser: async (actorId) => {
        calls.push("countForUser");
        return repo.countForUser(actorId);
      },
    };

    const result = await createProject(
      cloudContext(user.id),
      { data: { format: "Comic" } },
      watched,
      {},
      tierOf("story_pro"),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project["format"]).toBe("Comic");
    // `maxProjects !== -1` gates the count — story_pro (every pro tier) never paged it.
    expect(calls).toEqual([]);
    expect(await countRows(handle.db)).toBe(5);
  });

  it("an unknown tier falls back to the pre-migration `?? 3` cap against the real MAX_PROJECTS table", async () => {
    const { handle, user, repo } = await seed();
    for (let i = 0; i < 3; i++) {
      await handle.db.insert(projects).values({ userId: user.id, name: `P${i}` });
    }
    const result = await createProject(
      cloudContext(user.id),
      { data: { name: "P3" } },
      repo,
      {},
      tierOf("wanderer"),
    );
    expect(result).toEqual({
      ok: false,
      status: 403,
      reason: "project-limit",
      body: PROJECT_LIMIT_REACHED_BODY,
    });
    expect(await countRows(handle.db)).toBe(3);
  });
});

describe("listForUser through the real adapter — scoping, ordering, stub shapes", () => {
  it("returns only the actor's rows, newest-updated first, with the exact 9-column + chapter/character-stub shape pg's relational read emitted", async () => {
    const { handle, user, repo } = await seed();
    // Second user: whose rows must never leak into u1's list — and whose
    // project's child characters must never attach to it either.
    const [other] = await handle.db.insert(users).values({ email: "u2@test.dev" }).returning();
    const [foreign] = await handle.db.insert(projects).values({ userId: other.id, name: "Foreign" }).returning();
    if (!foreign) throw new Error("seed failed");
    await handle.db.insert(characters).values({ projectId: foreign.id, name: "Foreigner" });

    // Fixed timestamps: p1 older, p2 newer — no clock sleeps needed.
    const [p1] = await handle.db
      .insert(projects)
      .values({ userId: user.id, name: "Older", updatedAt: new Date(1000), createdAt: new Date(1000) })
      .returning();
    const [p2] = await handle.db
      .insert(projects)
      .values({ userId: user.id, name: "Newer", updatedAt: new Date(2000), createdAt: new Date(2000) })
      .returning();
    if (!p1 || !p2) throw new Error("seed failed");

    // Children on p2 only: prove per-project grouping and empty stubs on p1.
    await handle.db.insert(chapters).values({ projectId: p2.id, title: "ch A", wordCount: 5, sortOrder: 1 });
    await handle.db.insert(chapters).values({ projectId: p2.id, title: "ch B", wordCount: 2, sortOrder: 0 });
    await handle.db.insert(characters).values({ projectId: p2.id, name: "Ana" });

    const rows = await repo.listForUser(user.id);
    expect(rows.map((r) => r["name"])).toEqual(["Newer", "Older"]);

    // A well-typed view over the list row (the port types it index-signature;
    // these are the members the 9-column + `with` shape actually carries).
    type ListRow = ProjectRow & {
      format: string;
      genres: string[];
      createdAt: Date;
      updatedAt: Date;
      skillLevel: string;
      isHiggsfieldProject: boolean;
      universeId: null;
      chapters: Array<{ id: string; title: string; wordCount: number; sortOrder: number }>;
      characters: Array<{ id: string; name: string }>;
    };
    const [viewNewer, viewOlder] = rows as unknown as ListRow[];

    // The exact 11-member row: the 9 list columns in the pg columns-option
    // order, then the two `with` stub arrays appended — the key order the
    // relational build produced on pg.
    expect(Object.keys(viewNewer)).toEqual([
      "id",
      "name",
      "format",
      "genres",
      "updatedAt",
      "createdAt",
      "skillLevel",
      "isHiggsfieldProject",
      "universeId",
      "chapters",
      "characters",
    ]);
    expect(viewNewer.id).toBe(p2.id);
    expect(viewNewer.userId).toBeUndefined(); // not among the 9 selected columns
    expect(viewNewer.genres).toEqual([]);
    expect(viewNewer.isHiggsfieldProject).toBe(false);
    // The chapter stub carries exactly { id, title, wordCount, sortOrder } —
    // DB row order (pg's relation fan-out had no ORDER BY either).
    expect(viewNewer.chapters).toEqual([
      { id: expect.stringMatching(/^[0-9a-f-]{36}$/), title: "ch A", wordCount: 5, sortOrder: 1 },
      { id: expect.stringMatching(/^[0-9a-f-]{36}$/), title: "ch B", wordCount: 2, sortOrder: 0 },
    ]);
    expect(Object.keys(viewNewer.chapters[0]!)).toEqual(["id", "title", "wordCount", "sortOrder"]);
    expect(viewNewer.characters).toEqual([{ id: expect.stringMatching(/^[0-9a-f-]{36}$/), name: "Ana" }]);
    expect(Object.keys(viewNewer.characters[0]!)).toEqual(["id", "name"]);

    // p1: no children anywhere — pg's relational read produced [] arrays,
    // never undefined.
    expect(viewOlder.chapters).toEqual([]);
    expect(viewOlder.characters).toEqual([]);
  });

  it("listForUser of an actor with no projects is an empty array (the fan-out never runs)", async () => {
    const { user, repo } = await seed();
    expect(await repo.listForUser(user.id)).toEqual([]);
  });

  it("the handler wraps the same rows as { ok: true, projects }", async () => {
    const { user, repo } = await seed();
    await createProject(cloudContext(user.id), { data: { name: "Via handler" } }, repo, {}, tierOf("story_pro"));
    const out = await listProjects(cloudContext(user.id), repo);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.projects.map((p) => p["name"])).toEqual(["Via handler"]);
    // The list row's chapter stub is the seeded Chapter 1 — one chapter deep.
    expect(out.projects[0]!["chapters"]).toEqual([
      { id: expect.stringMatching(/^[0-9a-f-]{36}$/), title: "Chapter 1", wordCount: 0, sortOrder: 0 },
    ]);
  });
});

describe("read through the real adapter — the re-expressed 9-relation graph", () => {
  it("the project row plus all 9 relation arrays in pg's `with:` order; chapters ordered asc(sortOrder)", async () => {
    const { handle, user, repo } = await seed();
    const created = await createProject(
      cloudContext(user.id),
      { data: { name: "Graph Read" } },
      repo,
      {},
      tierOf("story_pro"),
    );
    if (!created.ok) throw new Error("seed failed");
    const pid = created.project.id;

    // Two extra chapters out of order; read() must return Chapter 1 (0), then
    // sortOrder 1, then 3 — pg's `asc(c.sortOrder)`.
    await handle.db.insert(chapters).values([
      { projectId: pid, title: "third", sortOrder: 3 },
      { projectId: pid, title: "second", sortOrder: 1 },
    ]);
    await handle.db.insert(characters).values({ projectId: pid, name: "Quinn" });
    await handle.db.insert(worldEntities).values({ projectId: pid, kind: "weapon", name: "Ledger Blade" });

    type GraphRow = ProjectRow & {
      chapters: Array<{ id: string; title: string; sortOrder: number }>;
      characters: Array<{ id: string; name: string }>;
      locations: unknown[];
      plotThreads: unknown[];
      worldEntities: Array<{ id: string; kind: string; name: string }>;
      referenceWorks: unknown[];
      storyMemories: unknown[];
      characterRelationships: unknown[];
      storyPromises: unknown[];
    };
    const graph = (await repo.read(pid)) as unknown as GraphRow;
    expect(graph).not.toBeNull();
    if (!graph) return;
    expect(graph.id).toBe(pid);
    expect(graph["name"]).toBe("Graph Read");
    // Full project columns are on the row (the 9-column slice is listForUser's
    // shape only), and the 9 relation keys sit after them in the pg `with:`
    // order.
    expect(Object.keys(graph)).toEqual([
      ...Object.keys(created.project),
      "chapters",
      "characters",
      "locations",
      "plotThreads",
      "worldEntities",
      "referenceWorks",
      "storyMemories",
      "characterRelationships",
      "storyPromises",
    ]);
    expect(graph.chapters.map((c) => c.title)).toEqual(["Chapter 1", "second", "third"]);
    expect(graph.chapters.map((c) => c.sortOrder)).toEqual([0, 1, 3]);
    // Child rows carry their FULL columns (pg loaded the relations verbatim).
    expect(graph.characters.map((c) => c.name)).toEqual(["Quinn"]);
    expect(graph.worldEntities.map((w) => w["name"])).toEqual(["Ledger Blade"]);
    // Empty relations are [] arrays — pg's relational read produced the same.
    expect(graph.locations).toEqual([]);
    expect(graph.plotThreads).toEqual([]);
    expect(graph.referenceWorks).toEqual([]);
    expect(graph.storyMemories).toEqual([]);
    expect(graph.characterRelationships).toEqual([]);
    expect(graph.storyPromises).toEqual([]);
  });

  it("a project vanished between ownsProject and read reads as null — the handler then 404s (vanish-contract)", async () => {
    const { repo } = await seed();
    expect(await repo.read("no-such-project")).toBe(null);
  });
});

describe("updateProject through the real adapter — allowlist, density, unconditional touch, jsonb round-trips", () => {
  it("patches land at column level; server-owned and junk keys stay out (the handler allowlist, judged on real rows)", async () => {
    const log: string[] = [];
    const { user, repo } = await seed();
    const created = await createProject(
      cloudContext(user.id),
      { data: { name: "Before" } },
      repo,
      {},
      tierOf("story_pro"),
    );
    if (!created.ok) throw new Error("seed failed");
    const pid = created.project.id;

    const result = await updateProject(
      cloudContext(user.id),
      {
        projectId: pid,
        patch: {
          name: "After",
          densityLevel: "simple",
          junk: 1,
          id: "attacker",
          userId: "victim",
          contentRevision: 999,
          createdAt: "1999-01-01",
        },
      },
      repo,
      hooks(log),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project["name"]).toBe("After");
    expect(result.project["densityLevel"]).toBe("simple");
    // Server-owned fields survive untouched — the allowlist dropped them.
    expect(result.project["userId"]).toBe(user.id);
    expect(result.project["id"]).toBe(pid);
    expect(result.project["contentRevision"]).toBe(null);
    expect(result.project["createdAt"]).toEqual(created.project["createdAt"]);
    expect(result.project["updatedAt"]).toBeInstanceOf(Date);
    expect(log).toEqual(["hook:project.update"]);

    // Garbage density coerces to standard (normalizeDensity's contract).
    const coerced = await updateProject(
      cloudContext(user.id),
      { projectId: pid, patch: { densityLevel: "bogus" } },
      repo,
    );
    if (!coerced.ok) throw new Error("coercion update unexpectedly failed");
    expect(coerced.project["densityLevel"]).toBe("standard");

    // Adapter-level pins: no row matched -> null (the handler 404s on it);
    // deleteScoped stays a no-op for a missing row (pg's DELETE matched
    // nothing there too).
    expect(await repo.updateScoped("no-such-project", { name: "x" })).toBe(null);
    await expect(repo.deleteScoped("no-such-project")).resolves.toBeUndefined();
  });

  it("an all-unknown body is still a touch: updatedAt stamps server-side even for an empty surviving patch, and the canon hook stays silent", async () => {
    const log: string[] = [];
    const { user, repo } = await seed();
    const created = await createProject(
      cloudContext(user.id),
      { data: { name: "Touch only" } },
      repo,
      {},
      tierOf("story_pro"),
    );
    if (!created.ok) throw new Error("seed failed");

    const result = await updateProject(
      cloudContext(user.id),
      { projectId: created.project.id, patch: { junkOnly: true } },
      repo,
      hooks(log),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project["updatedAt"]).toBeInstanceOf(Date);
    expect(log).toEqual([]); // touch, not a canon change

    // The new stamp is monotonically at/after the creation one — no clock
    // sleeps needed for the always-set comparison.
    expect((result.project["updatedAt"] as Date).getTime()).toBeGreaterThanOrEqual(
      (created.project["updatedAt"] as Date).getTime(),
    );
  });

  it("the jsonb-typed PATCH fields round-trip through TEXT storage — adapter pass-through, decode stays at the story.ts edge", async () => {
    const { sqlite, user, repo } = await seed();
    const created = await createProject(
      cloudContext(user.id),
      { data: { name: "Json Carrier" } },
      repo,
      {},
      tierOf("story_pro"),
    );
    if (!created.ok) throw new Error("seed failed");

    // `aiRules` arrives at the handler ALREADY encoded by the route-edge
    // guard (`encodeAIRules`), exactly as the PATCH route feeds it. The
    // adapter must carry it verbatim into the json column — no second decode.
    const encoded = encodeAIRules([{ id: "r1", text: "no head hopping", source: "user" }]);
    const result = await updateProject(
      cloudContext(user.id),
      {
        projectId: created.project.id,
        patch: {
          aiRules: encoded,
          dismissedGuideIds: ["guide-chapter-run"],
          genres: ["Fantasy", "Comedy"],
        },
      },
      repo,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project["aiRules"]).toEqual(encoded);
    expect(result.project["dismissedGuideIds"]).toEqual(["guide-chapter-run"]);
    expect(result.project["genres"]).toEqual(["Fantasy", "Comedy"]);

    // The columns really are TEXT on disk, JSON-encoded at the adapter
    // boundary — typed arrays on read via the `mode:"json"` translation.
    const raw = sqlite
      .prepare("SELECT ai_rules, dismissed_guide_ids, genres FROM projects WHERE id = ?")
      .get(created.project.id) as
      { ai_rules: string; dismissed_guide_ids: string; genres: string } | undefined;
    expect(typeof raw?.ai_rules).toBe("string");
    expect(JSON.parse(raw!.ai_rules)).toEqual([{ id: "r1", text: "no head hopping", source: "user" }]);
    expect(JSON.parse(raw!.dismissed_guide_ids)).toEqual(["guide-chapter-run"]);
    expect(JSON.parse(raw!.genres)).toEqual(["Fantasy", "Comedy"]);
  });
});

describe("403/404 orderings on every scoped verb through the real adapter", () => {
  it("scope-mismatch 403 pages ZERO verbs; non-owned 404 pages ownsProject only; refusals write nothing", async () => {
    const log: string[] = [];
    const { handle, user, repo } = await seed();
    const created = await createProject(
      cloudContext(user.id),
      { data: { name: "Owned" } },
      repo,
      {},
      tierOf("story_pro"),
    );
    if (!created.ok) throw new Error("seed failed");
    const pid = created.project.id;
    const before = await handle.db.select().from(projects);

    const calls: string[] = [];
    const watched: ProjectsCoreRepository = {
      ...repo,
      ownsProject: async (projectId, actorId) => {
        calls.push("ownsProject");
        return repo.ownsProject(projectId, actorId);
      },
      read: async (projectId) => {
        calls.push("read");
        return repo.read(projectId);
      },
      updateScoped: async (projectId, patch) => {
        calls.push("updateScoped");
        return repo.updateScoped(projectId, patch);
      },
      deleteScoped: async (projectId) => {
        calls.push("deleteScoped");
        return repo.deleteScoped(projectId);
      },
    };

    // READ verb: 403 (context scoped elsewhere) before any verb; 404
    // (stranger) after ownsProject, before read.
    const r403 = await readProject(
      cloudContext(user.id, { projectScope: "other-project" }),
      { projectId: pid },
      watched,
    );
    const r404 = await readProject(cloudContext("stranger"), { projectId: pid }, watched);
    expect(r403).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(r404).toEqual({ ok: false, status: 404, reason: "Not found" });

    // UPDATE verb: the same two orderings, nothing written.
    const u403 = await updateProject(
      cloudContext(user.id, { projectScope: "other-project" }),
      { projectId: pid, patch: { name: "hijack" } },
      watched,
    );
    const u404 = await updateProject(
      cloudContext("stranger"),
      { projectId: pid, patch: { name: "hijack" } },
      watched,
    );
    expect(u403).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(u404).toEqual({ ok: false, status: 404, reason: "Not found" });

    // DELETE verb: the same two orderings again.
    const d403 = await deleteProject(
      cloudContext(user.id, { projectScope: "other-project" }),
      { projectId: pid },
      watched,
      hooks(log),
    );
    const d404 = await deleteProject(cloudContext("stranger"), { projectId: pid }, watched, hooks(log));
    expect(d403).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(d404).toEqual({ ok: false, status: 404, reason: "Not found" });

    // Call sequence: the three 403s page ZERO verbs (the scope check runs
    // before any repository call); only the three 404s reached one verb each
    // (ownsProject) and nothing advanced past a refusal.
    expect(calls).toEqual(["ownsProject", "ownsProject", "ownsProject"]);
    expect(log).toEqual([]); // refusals fire no canonical-mutation hooks
    expect(await handle.db.select().from(projects)).toEqual(before);
  });

  it("deleteProject through the real adapter — { ok: true }, hook AFTER the delete ran, row gone", async () => {
    const log: string[] = [];
    const { handle, user, repo } = await seed();
    const created = await createProject(
      cloudContext(user.id),
      { data: { name: "Doomed" } },
      repo,
      {},
      tierOf("story_pro"),
    );
    if (!created.ok) throw new Error("seed failed");

    const result = await deleteProject(
      cloudContext(user.id),
      { projectId: created.project.id },
      repo,
      hooks(log),
    );
    expect(result).toEqual({ ok: true });
    expect(log).toEqual(["hook:project.delete"]);
    const left = await handle.db.select().from(projects).where(eq(projects.id, created.project.id));
    expect(left).toEqual([]);
  });
});

describe("real-DB-specific — FK cascades across the projects parent table + DDL presence", () => {
  it("deleteScoped cascades every child table (projects is the parent of most cascades)", async () => {
    const { handle, user, repo } = await seed();
    const created = await createProject(
      cloudContext(user.id),
      { data: { name: "Cascade Root" } },
      repo,
      {},
      tierOf("story_pro"),
    );
    if (!created.ok) throw new Error("seed failed");
    const pid = created.project.id;
    await handle.db.insert(characters).values({ projectId: pid, name: "Child Character" });
    await handle.db.insert(worldEntities).values({ projectId: pid, kind: "object", name: "Child Entity" });
    expect((await handle.db.select().from(chapters)).length).toBe(1);
    expect((await handle.db.select().from(characters)).length).toBe(1);
    expect((await handle.db.select().from(worldEntities)).length).toBe(1);

    await repo.deleteScoped(pid);

    expect(await handle.db.select().from(chapters)).toEqual([]);
    expect(await handle.db.select().from(characters)).toEqual([]);
    expect(await handle.db.select().from(worldEntities)).toEqual([]);
    expect(await handle.db.select().from(projects)).toEqual([]);
  });

  it("deleting the USER cascades the user's projects (and their children, level-two)", async () => {
    const { handle } = await seed();
    const [doomed] = await handle.db.insert(users).values({ email: "doomed@test.dev" }).returning();
    const [gone] = await handle.db.insert(projects).values({ userId: doomed.id, name: "Gone" }).returning();
    if (!gone) throw new Error("seed failed");
    await handle.db.insert(chapters).values({ projectId: gone.id, title: "Under Gone" });
    // A survivor project from a second user must remain.
    const [survivor] = await handle.db.insert(users).values({ email: "survivor@test.dev" }).returning();
    await handle.db.insert(projects).values({ userId: survivor.id, name: "Survivor" });

    await handle.db.delete(users).where(eq(users.id, doomed.id));

    const leftProjects = await handle.db.select().from(projects);
    expect(leftProjects.length).toBe(1);
    expect(leftProjects[0]!.name).toBe("Survivor");
    // Level-two cascade through the vanished project's chapters.
    expect(await handle.db.select().from(chapters)).toEqual([]);
  });

  it("the vendored DDL includes the projects row from the 43-table baseline (and its seeded-child target)", () => {
    expect(SQLITE_DDL).toContain('CREATE TABLE "projects"');
    expect(SQLITE_DDL).toContain('CREATE TABLE "chapters"');
    // The jsonb family rides TEXT json defaults — the '{}'/'[]' defaults the
    // reads decode from.
    expect(SQLITE_DDL).toContain('"genres" text DEFAULT \'[]\'');
    expect(SQLITE_DDL).toContain('"intentional_violations" text DEFAULT \'{}\'');
    // `user_id` cascades: deleting a user takes their projects with it.
    expect(SQLITE_DDL).toMatch(
      /"user_id" text NOT NULL,[\s\S]*?FOREIGN KEY \("user_id"\) REFERENCES "users"\("id"\)[\s\S]*?ON DELETE cascade/,
    );
  });
});

describe("read-path join safety — stated, not fabricated", () => {
  it("this adapter's reads are join-free by construction (every pg relational read was re-expressed as sibling/inArray queries), so the duplicate-column object-mode hazard cannot arise on this read path; pinned at the source level so a future join-based rewrite must add the raw pin instead", async () => {
    const source = readFileSync(join(__dirname, "../sqlite-project-crud.ts"), "utf-8");
    // No join-builder call anywhere in the adapter — the reads are
    // `db.query.*` findFirst/findMany. (The setReturnArrays(true) guard in
    // src/db/sqlite.ts remains the standing protection for any future join;
    // the relationship adapter's parity test pins it with a raw two-table
    // select for whichever sibling read actually joins one day.)
    expect(source).not.toMatch(/\.(innerJoin|leftJoin|rightJoin|fullJoin)\(/);
  });
});

describe("source purity of the sqlite layer (live-shell-reachability convention)", () => {
  // Deliberately a COPY + extension of the world-entity parity test's FILES
  // array rather than an edit of it: each new parity file carries its own
  // purity check so pair-by-pair integration never touches the already-landed
  // suite. Now cumulative over every landed sqlite adapter.
  const FILES = [
    join(__dirname, "../../../db/sqlite.ts"),
    join(__dirname, "../../../db/sqlite-schema.ts"),
    join(__dirname, "../../../db/sqlite-ddl.ts"),
    join(__dirname, "../sqlite-character-location-repos.ts"),
    join(__dirname, "../sqlite-thread-reference-repos.ts"),
    join(__dirname, "../sqlite-world-entity-repos.ts"),
    join(__dirname, "../sqlite-relationship-repos.ts"),
    join(__dirname, "../sqlite-comic-repos.ts"),
    join(__dirname, "../sqlite-project-crud.ts"),
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
