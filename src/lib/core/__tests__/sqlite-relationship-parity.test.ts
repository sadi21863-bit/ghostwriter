import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";

import { createSqliteDb, type SqliteDbHandle } from "@/db/sqlite";
import { SQLITE_DDL } from "@/db/sqlite-ddl";
import {
  characterRelationships,
  characters,
  chapters,
  projects,
  users,
} from "@/db/sqlite-schema";
import { cloudContext } from "@/lib/core/request-context";
import type { PostCommitHooks } from "@/lib/core/repositories";
import {
  readRelationshipMap,
  upsertRelationshipMap,
  type RelationshipMapRepository,
} from "@/lib/core/handlers/relationship-map";
import { makeSqliteRelationshipMapRepository } from "@/lib/core/sqlite-relationship-repos";

/**
 * The relationship-map slice of the sqlite tracer's real-DB parity suite
 * (docs/migration/phase3-prep.md §4): the same handler functions as
 * `relationship-map.test.ts`, driven against a real node:sqlite database
 * through the sqlite-proxy drizzle baseline — no mocks for reachability
 * questions. Covers the REAL verb surface (ownsProject/readGraph/
 * upsertRelationships — the port has no delete/clear verb; deletion only
 * arrives through FK cascades), the GET graph shape (same counts and field
 * presence as the pg adapter emits, with stored-relationship layering and
 * defaults), the pair upsert's normalization/idempotency/conditional-set
 * semantics, the 403/404 orderings, and the DB-specific cases the contract
 * mock cannot express (FK cascade in both character positions, FK-violation
 * refusal, DDL presence, the duplicate-column join-safety pin).
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

/**
 * Seed one user + project and the graph fixture: four characters (names are
 * deliberately non-substring — `mara`, `sole`, `quill`, `rill` each match
 * exactly where intended under the content.includes(name) scan), four
 * chapters (two real; one empty, one whitespace-only — both must contribute
 * nothing). Returns the repos wired to that database.
 */
async function seed() {
  const handle = fresh();
  const [user] = await handle.db.insert(users).values({ email: "u1@test.dev" }).returning();
  const [project] = await handle.db.insert(projects).values({ userId: user.id }).returning();

  const charIds = ["c-mara", "c-sole", "c-quill", "c-rill"] as const;
  await handle.db.insert(characters).values([
    // Insertion order is the scan order findMany will return (rowid table),
    // so the nodes order below is deterministic.
    { id: "c-mara", projectId: project.id, name: "Mara", role: "Protagonist", portraitUrl: "http://img/mara" },
    { id: "c-sole", projectId: project.id, name: "Sole", role: "Foil" },
    { id: "c-quill", projectId: project.id, name: "Quill", role: "Scribe" },
    { id: "c-rill", projectId: project.id, name: "Rill", role: "Rival" },
  ]);

  await handle.db.insert(chapters).values([
    { projectId: project.id, title: "ch1", content: "Mara and Sole walked." },
    {
      projectId: project.id,
      title: "ch2",
      content: "SOLE drew the map while MARA kept the ledger, and Rill watched.",
    },
    // The skip guards (`chapter.content || ""` + `content.trim()`): no names,
    // no contribution — only prove nothing crashes and nothing is counted.
    { projectId: project.id, title: "ch3", content: "" },
    { projectId: project.id, title: "ch4", content: "   " },
  ]);

  return {
    handle,
    db: handle.db,
    user,
    project,
    charIds,
    repo: makeSqliteRelationshipMapRepository(handle.db),
  };
}

describe("readGraph through the real adapter — the exact GET body", () => {
  it("graph shape parity — same counts and field presence as the pg adapter emits: stored data layered on the co-occurrence edge, defaults on the unlayered ones", async () => {
    const { user, project, repo } = await seed();

    // Stored relationship data layered onto the (Mara, Sole) edge — created
    // with the pair REVERSED, so the layering key must canonicalize aId<bId
    // exactly like the stored row it reads back.
    await repo.upsertRelationships(project.id, {
      characterAId: "c-sole",
      characterBId: "c-mara",
      trustLevel: 80,
      relationshipType: "rivals",
      fourHorsemen: { criticism: 1, contempt: 0, defensiveness: 0, stonewalling: 2 },
      notes: "loud history",
    });

    const graph = await repo.readGraph(project.id);

    // nodes: every character, the exact field set the GET body carries.
    expect(graph.nodes).toEqual([
      { id: "c-mara", name: "Mara", role: "Protagonist", portraitUrl: "http://img/mara" },
      { id: "c-sole", name: "Sole", role: "Foil", portraitUrl: "" },
      { id: "c-quill", name: "Quill", role: "Scribe", portraitUrl: "" },
      { id: "c-rill", name: "Rill", role: "Rival", portraitUrl: "" },
    ]);
    // edges: one per co-occurring pair — (Mara,Sole) across both non-empty
    // chapters (case-insensitive match), (Mara,Rill) and (Sole,Rill) from ch2;
    // the empty and whitespace-only chapters contributed nothing.
    expect(graph.edges).toEqual([
      {
        charAId: "c-mara",
        charBId: "c-sole",
        charAName: "Mara",
        charBName: "Sole",
        sharedChapters: 2,
        trustLevel: 80,
        relationshipType: "rivals",
        fourHorsemen: { criticism: 1, contempt: 0, defensiveness: 0, stonewalling: 2 },
        notes: "loud history",
      },
      {
        charAId: "c-mara",
        charBId: "c-rill",
        charAName: "Mara",
        charBName: "Rill",
        sharedChapters: 1,
        trustLevel: 50,
        relationshipType: "",
        fourHorsemen: { criticism: 0, contempt: 0, defensiveness: 0, stonewalling: 0 },
        notes: "",
      },
      {
        charAId: "c-rill",
        charBId: "c-sole",
        charAName: "Rill",
        charBName: "Sole",
        sharedChapters: 1,
        trustLevel: 50,
        relationshipType: "",
        fourHorsemen: { criticism: 0, contempt: 0, defensiveness: 0, stonewalling: 0 },
        notes: "",
      },
    ]);
    expect(graph.isolated).toEqual([{ id: "c-quill", name: "Quill" }]);

    // Field presence exactly — after the "join" (pg's relational load; here the
    // sibling queries), the shapes the route serializes verbatim must not
    // carry extra keys or lose any.
    expect(Object.keys(graph.nodes[0])).toEqual(["id", "name", "role", "portraitUrl"]);
    expect(Object.keys(graph.edges[0])).toEqual([
      "charAId",
      "charBId",
      "charAName",
      "charBName",
      "sharedChapters",
      "trustLevel",
      "relationshipType",
      "fourHorsemen",
      "notes",
    ]);
    expect(Object.keys(graph.isolated[0])).toEqual(["id", "name"]);
  });

  it("a project that vanished between the handler's ownsProject and the read reads as an empty but valid graph — the documented pg divergence, reproduced", async () => {
    const { repo } = await seed();
    expect(await repo.readGraph("no-such-project")).toEqual({
      nodes: [],
      edges: [],
      isolated: [],
    });
  });
});

describe("upsertRelationships through the real adapter — pair normalization", () => {
  it("create branch — full character_relationships row back: uuid id, canonical aId<bId pair, closed field presence, insert defaults, Date updatedAt", async () => {
    const { user, project, repo } = await seed();
    // Pair sent REVERSED (B, A): the row must store (c-mara, c-sole) — the
    // lexicographic min first — exactly what the pg adapter normalizes to.
    const row = await repo.upsertRelationships(project.id, {
      characterAId: "c-sole",
      characterBId: "c-mara",
      trustLevel: 80,
      relationshipType: "rivals",
      fourHorsemen: { criticism: 1, contempt: 0, defensiveness: 0, stonewalling: 2 },
      notes: "loud history",
    });

    expect(row).not.toBeNull();
    if (!row) return;
    // Ids are client-generated uuids ($defaultFn in sqlite-schema.ts).
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(row.projectId).toBe(project.id);
    expect(row.characterAId).toBe("c-mara");
    expect(row.characterBId).toBe("c-sole");
    expect(row.trustLevel).toBe(80);
    expect(row.relationshipType).toBe("rivals");
    expect(row.fourHorsemen).toEqual({ criticism: 1, contempt: 0, defensiveness: 0, stonewalling: 2 });
    expect(row.notes).toBe("loud history");
    // Fields the caller omitted hit the insert defaults — the same column
    // defaults pg's schema applied.
    expect(row.powerDifferential).toBe(0);
    expect(row.emotionalRegister).toBe("");
    expect(row.knowledgeAsymmetry).toBe("");
    expect(row.dependencyStructure).toBe("none");
    expect(row.attachmentStyleA).toBe("");
    expect(row.arcTrajectory).toBe("");
    // epoch-ms integer column surfaces as a real Date (timestamp_ms mode).
    expect(row.updatedAt).toBeInstanceOf(Date);
    // The exact PATCH response body the route emitted on pg — all 15 columns.
    expect(Object.keys(row)).toEqual([
      "id",
      "projectId",
      "characterAId",
      "characterBId",
      "trustLevel",
      "relationshipType",
      "fourHorsemen",
      "notes",
      "powerDifferential",
      "emotionalRegister",
      "knowledgeAsymmetry",
      "dependencyStructure",
      "attachmentStyleA",
      "arcTrajectory",
      "updatedAt",
    ]);
  });

  it("idempotency and reversal — the same pair upserted in either order updates the SAME row (count stays 1), only sending fields actually patches", async () => {
    const { handle, project, repo } = await seed();

    const first = await repo.upsertRelationships(project.id, {
      characterAId: "c-mara",
      characterBId: "c-sole",
      trustLevel: 80,
    });
    expect(first).not.toBeNull();
    if (!first) return;

    // Reversed pair, changed trustLevel: reversal semantics = same stored row.
    const second = await repo.upsertRelationships(project.id, {
      characterAId: "c-sole",
      characterBId: "c-mara",
      trustLevel: 20,
    });
    expect(second?.id).toBe(first.id);
    expect(second?.characterAId).toBe("c-mara");
    expect(second?.characterBId).toBe("c-sole");
    expect(second?.trustLevel).toBe(20);

    // Full idempotency: a third call with the identical pair touches nothing
    // but updatedAt (fresh Date stamped by the always-set branch).
    const third = await repo.upsertRelationships(project.id, {
      characterAId: "c-mara",
      characterBId: "c-sole",
    });
    expect(third?.id).toBe(first.id);
    expect(third?.trustLevel).toBe(20);
    expect(third?.updatedAt).toBeInstanceOf(Date);
    expect((third!.updatedAt as Date).getTime()).toBeGreaterThanOrEqual(
      (first.updatedAt as Date).getTime(),
    );

    // Still exactly one stored row for the pair — never a duplicate.
    const all = await handle.db.select().from(characterRelationships);
    expect(all.length).toBe(1);
  });

  it("conditional update set — updatedAt always; fields the caller sent change, fields it did not keep their stored values", async () => {
    const { project, repo } = await seed();

    const created = await repo.upsertRelationships(project.id, {
      characterAId: "c-mara",
      characterBId: "c-sole",
      trustLevel: 80,
    });
    if (!created) throw new Error("seed failed");
    expect(created.trustLevel).toBe(80);
    expect(created.dependencyStructure).toBe("none");
    expect(created.notes).toBe("");

    // Only `notes` sent: the closed update-set list patches exactly that.
    const patched = await repo.upsertRelationships(project.id, {
      characterAId: "c-mara",
      characterBId: "c-sole",
      notes: "loud history",
    });
    expect(patched?.notes).toBe("loud history");
    expect(patched?.trustLevel).toBe(80);
    expect(patched?.dependencyStructure).toBe("none");
    expect(patched?.relationshipType).toBe("");

    // Touch-only call (ids alone): a fresh updatedAt, every other column stays.
    const touched = await repo.upsertRelationships(project.id, {
      characterAId: "c-mara",
      characterBId: "c-sole",
    });
    expect(touched?.id).toBe(created.id);
    expect(touched?.notes).toBe("loud history");
    expect((touched!.updatedAt as Date).getTime()).toBeGreaterThanOrEqual(
      (created.updatedAt as Date).getTime(),
    );
  });

  it("mass-assign guard — unknown payload keys never reach a query (no crash, columns unchanged)", async () => {
    const { handle, project, repo } = await seed();
    const created = await repo.upsertRelationships(project.id, {
      characterAId: "c-mara",
      characterBId: "c-sole",
      trustLevel: 80,
    });
    if (!created) throw new Error("seed failed");
    const before = await handle.db.select().from(characterRelationships);

    // The local host pins the body's field list; the adapter's closed key list
    // is the second layer. Smuggled keys (including the pg schema's own column
    // names) must be dropped, not written.
    const smuggled = await repo.upsertRelationships(project.id, {
      characterAId: "c-mara",
      characterBId: "c-sole",
      ...( { title: "not-a-column", embedding: [1, 0], contentRevision: 99 } as object ),
    } as Parameters<RelationshipMapRepository["upsertRelationships"]>[1]);

    expect(smuggled?.id).toBe(created.id);
    expect(smuggled?.trustLevel).toBe(80);
    expect(smuggled?.notes).toBe("");
    const after = await handle.db.select().from(characterRelationships);
    expect(after.length).toBe(before.length);
    // `updatedAt` legitimately bumps — the adapter's always-set branch, byte
    // for byte what pg's upsert does (see pg-relationship-repos.ts' identical
    // `{ updatedAt: new Date() }` head) — so the smuggled-keys pin excludes
    // only that column and pins the bump with the same >= guard the
    // touch-only tests use. Everything else, especially the smuggled keys'
    // would-be columns, must be byte-identical to the pre-call row.
    expect({ ...after[0]!, updatedAt: 0 }).toEqual({ ...before[0]!, updatedAt: 0 });
    expect((after[0]!.updatedAt as Date).getTime()).toBeGreaterThanOrEqual(
      (before[0]!.updatedAt as Date).getTime(),
    );
  });
});

describe("handler wiring through the real adapter — refusals and hooks", () => {
  it("happy upsert fires the canonical-mutation hook only after the real write (kind: relationship.upsert); refusals fire nothing", async () => {
    const log: string[] = [];
    const { handle, user, project, repo } = await seed();

    const result = await upsertRelationshipMap(
      cloudContext(user.id),
      { projectId: project.id, characterAId: "c-mara", characterBId: "c-sole", trustLevel: 80 },
      repo,
      hooks(log),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The handler passes the repository row through verbatim — the same
    // full character_relationships row the PATCH route emitted on pg.
    expect(result.row.characterAId).toBe("c-mara");
    expect(result.row.trustLevel).toBe(80);
    expect(log).toEqual(["hook:relationship.upsert"]);

    // 404 refusal (stranger): no write, no additional hook.
    const refused = await upsertRelationshipMap(
      cloudContext("stranger"),
      { projectId: project.id, characterAId: "c-mara", characterBId: "c-sole" },
      repo,
      hooks(log),
    );
    expect(refused).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(log).toEqual(["hook:relationship.upsert"]);
    const rows = await handle.db.select().from(characterRelationships);
    expect(rows.length).toBe(1);
    expect(rows[0]!.trustLevel).toBe(80);
  });

  it("403/404 orderings on both verbs on real rows — scope mismatch pages no verb, non-owned project reaches ownsProject only; refusals write nothing", async () => {
    const { handle, user, project, repo } = await seed();
    const calls: string[] = [];
    const watched: RelationshipMapRepository = {
      ...repo,
      ownsProject: async (projectId, actorId) => {
        calls.push("ownsProject");
        return repo.ownsProject(projectId, actorId);
      },
      readGraph: async (projectId) => {
        calls.push("readGraph");
        return repo.readGraph(projectId);
      },
      upsertRelationships: async (projectId, payload) => {
        calls.push("upsertRelationships");
        return repo.upsertRelationships(projectId, payload);
      },
    };

    const before = await handle.db.select().from(characterRelationships);

    // READ: 403 (context scoped elsewhere) before any verb; 404 (stranger)
    // after ownsProject, before readGraph.
    const r403 = await readRelationshipMap(cloudContext(user.id, { projectScope: "other-project" }), { projectId: project.id }, watched);
    const r404 = await readRelationshipMap(cloudContext("stranger"), { projectId: project.id }, watched);
    expect(r403).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(r404).toEqual({ ok: false, status: 404, reason: "Not found" });

    // UPSERT: the same two orderings.
    const u403 = await upsertRelationshipMap(cloudContext(user.id, { projectScope: "other-project" }), {
      projectId: project.id,
      characterAId: "c-mara",
      characterBId: "c-sole",
    }, watched);
    const u404 = await upsertRelationshipMap(cloudContext("stranger"), {
      projectId: project.id,
      characterAId: "c-mara",
      characterBId: "c-sole",
    }, watched);
    expect(u403).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(u404).toEqual({ ok: false, status: 404, reason: "Not found" });

    // Call sequence: the 403s (context scoped elsewhere) page ZERO verbs —
    // the handler's scope check runs before any repository call; only the
    // two 404s reach a verb (ownsProject, then the refusal, before read/
    // upsert can be paged).
    expect(calls).toEqual(["ownsProject", "ownsProject"]);
    const after = await handle.db.select().from(characterRelationships);
    expect(after).toEqual(before);
  });
});

describe("real-DB-specific — FK cascade + declared-baseline pins", () => {
  it("deleting the project cascades every relationship row", async () => {
    const { handle, project, repo } = await seed();
    await repo.upsertRelationships(project.id, { characterAId: "c-mara", characterBId: "c-sole", trustLevel: 80 });
    await repo.upsertRelationships(project.id, { characterAId: "c-sole", characterBId: "c-quill" });
    expect((await handle.db.select().from(characterRelationships)).length).toBe(2);

    await handle.db.delete(projects).where(eq(projects.id, project.id));

    expect(await handle.db.select().from(characterRelationships)).toEqual([]);
  });

  it("deleting ONE character cascades the link from either position of the pair", async () => {
    const { handle, project, repo } = await seed();
    await repo.upsertRelationships(project.id, { characterAId: "c-mara", characterBId: "c-sole" });
    await repo.upsertRelationships(project.id, { characterAId: "c-sole", characterBId: "c-quill" });
    expect((await handle.db.select().from(characterRelationships)).length).toBe(2);

    // Mara is in position A of the first link only.
    await handle.db.delete(characters).where(eq(characters.id, "c-mara"));
    let left = await handle.db.select().from(characterRelationships);
    expect(left.length).toBe(1);
    // The surviving (Sole, Quill) row as the upsert normalized it — the
    // lexicographic-min-first canonicalization (the same string `<` the pg
    // adapter applies), not insertion order: "c-quill" < "c-sole".
    expect(left[0]!.characterAId).toBe("c-quill");
    expect(left[0]!.characterBId).toBe("c-sole");

    // Quill is in position B of the surviving link.
    await handle.db.delete(characters).where(eq(characters.id, "c-quill"));
    expect(await handle.db.select().from(characterRelationships)).toEqual([]);
  });

  it("a link to characters that do not exist is refused by the FK (foreign_keys=ON reproduces pg's behavior instead of silently storing an orphan)", async () => {
    const { project, repo } = await seed();
    const err = (await repo
      .upsertRelationships(project.id, { characterAId: "ghost-a", characterBId: "ghost-b", trustLevel: 10 })
      .catch((e: unknown) => e)) as Error & { cause?: { message?: string } };
    expect(err).toBeInstanceOf(Error);
    // Drizzle wraps the driver error (`Failed query: …`); the real SQLite
    // message is the cause.
    expect(`${err.message}\n${err.cause?.message ?? ""}`).toMatch(/FOREIGN KEY constraint failed/);
  });

  it("the vendored DDL includes the relationship table (the 43-table baseline already carried it)", () => {
    expect(SQLITE_DDL).toContain('CREATE TABLE "character_relationships"');
  });
});

describe("duplicate-column join pin — the setReturnArrays convention protecting this read", () => {
  it("this read path is join-free on the relation-less baseline (sibling queries, never pg's `with`), and the convention still holds: a raw same-named 2-table select keeps both values positionally", async () => {
    const { handle, project } = await seed();

    // A duplicated column name in one result — exactly the shape where SQLite
    // object mode would silently merge both `id` values into one key. The
    // proxy's `stmt.setReturnArrays(true)` (see src/db/sqlite.ts) keeps them
    // positional; pin it here so any future join-based rewrite of the graph
    // read inherits a green baseline rather than silent corruption.
    const rows = await handle.db
      .select({ projectId: projects.id, characterId: characters.id })
      .from(projects)
      .innerJoin(characters, eq(characters.projectId, projects.id));

    expect(rows.length).toBe(4);
    for (const row of rows) {
      expect(row.projectId).toBe(project.id);
      expect(row.characterId).toMatch(/^c-/);
      // The join-safety assertion itself: object-mode merging would make
      // these identical (the last column name wins).
      expect(row.characterId).not.toBe(row.projectId);
    }
  });
});

describe("source purity of the sqlite layer (live-shell-reachability convention)", () => {
  const FILES = [
    join(__dirname, "../../../db/sqlite.ts"),
    join(__dirname, "../../../db/sqlite-schema.ts"),
    join(__dirname, "../../../db/sqlite-ddl.ts"),
    join(__dirname, "../sqlite-character-location-repos.ts"),
    join(__dirname, "../sqlite-thread-reference-repos.ts"),
    join(__dirname, "../sqlite-relationship-repos.ts"),
  ];

  it("the sqlite layer never imports the Neon side or the Next runtime", () => {
    for (const file of FILES) {
      const source = readFileSync(file, "utf-8");
      // Exact `@/db` alias (quote-delimited) and the pg schema alias — the
      // sqlite layer's legitimate imports are `@/db/sqlite` / `@/db/sqlite-schema` /
      // `@/db/sqlite-ddl`, which these regexes deliberately do not match.
      expect(source, file).not.toMatch(/"@\/db"|'@\/db'|"@\/db\/schema"|'@\/db\/schema'/);
      expect(source, file).not.toMatch(/"next(\/|-auth)?"/);
      expect(source, file).not.toMatch(/@neondatabase\/serverless/);
    }
  }, 20000);
});
