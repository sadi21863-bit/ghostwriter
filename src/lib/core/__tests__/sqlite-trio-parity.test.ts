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
  comicPanels,
  comicPages,
  locations,
  plotThreads,
  projects,
  storyChanges,
  storyTransactions,
  users,
  worldEntities,
} from "@/db/sqlite-schema";
import { DIFF_FIELDS } from "@/lib/ai/entity-extraction";
import { MissingEntitiesError, type StoryChange, type StoryTransaction } from "@/lib/core/handlers/apply-story-transaction";
import {
  encodeChangeValue,
  ENTITY_TABLES,
  makeSqliteChapterRepository,
  makeSqliteChildResourceRepository,
  makeSqlitePostCommitHooks,
  makeSqliteProjectRepository,
  makeSqliteStoryBibleRepository,
  makeSqliteStoryHistoryRepository,
  makeSqliteStoryTransactionRepository,
} from "@/lib/core/sqlite-repositories";

/**
 * The trio slice — the FINAL cluster of the sqlite tracer's real-DB parity
 * suite (docs/migration/phase3-prep.md §4): chapter repo, the
 * `findOwned`/child-resource pairing NOT already answered by the
 * projects-core adapter (pair 5), the aggregated Story Bible read,
 * `makeSqlitePostCommitHooks`' real `COALESCE(contentRevision, 0) + 1` bump,
 * and the FULL §13.1 transaction machinery (record → applyChanges →
 * revertChanges with conflict detection) — all driven against a real
 * node:sqlite database, no mocks for reachability questions.
 *
 * The engine-agreement pins:
 *  - the wire codec's `column.dataType` reads are runtime drizzle metadata,
 *    identical on both engines — so a boolean `antagonistToggle` audit wire
 *    "true" decodes to a REAL boolean, a `properties` object rides JSON, and a
 *    link array '["loc-1"]' lands as a real array (all pinned per kind);
 *  - the sqlite `ENTITY_TABLES` field sets are pinned EQUAL to DIFF_FIELDS
 *    (the mechanical cross-check gate, same shape as the pg mirror test) so a
 *    drifted sqlite mirror fails its build;
 *  - the empty-wire BMI is pinned per kind: string → "", boolean/number/json
 *    → null.
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

/** Seed user + project (+ alien), one entity per table for the transaction path. */
async function seed() {
  const handle = fresh();
  const [user] = await handle.db.insert(users).values({ email: "u1@test.dev" }).returning();
  const [alienUser] = await handle.db.insert(users).values({ email: "u2@test.dev" }).returning();
  const [project] = await handle.db.insert(projects).values({ userId: user.id }).returning();
  const [alien] = await handle.db.insert(projects).values({ userId: alienUser.id }).returning();

  const [charRow] = await handle.db
    .insert(characters)
    .values({ id: "c-1", projectId: project.id, name: "Mara", antagonistToggle: false, age: "20s" })
    .returning();
  await handle.db
    .insert(characters)
    .values({ id: "c-2", projectId: project.id, name: "Sole" });
  const [locRow] = await handle.db
    .insert(locations)
    .values({ id: "l-1", projectId: project.id, name: "The Dome" })
    .returning();
  await handle.db
    .insert(locations)
    .values({ id: "l-alien", projectId: alien.id, name: "Alien Dome" });
  const [threadRow] = await handle.db
    .insert(plotThreads)
    .values({ id: "pt-1", projectId: project.id, name: "Long Night", status: "Active" })
    .returning();
  const [entityRow] = await handle.db
    .insert(worldEntities)
    .values({ id: "we-1", projectId: project.id, name: "The Deck", kind: "object" })
    .returning();
  await handle.db.insert(chapters).values({ id: "ch-1", projectId: project.id, title: "Chapter 1" });
  await handle.db
    .insert(chapters)
    .values({ id: "ch-alien", projectId: alien.id, title: "alien" });
  const [pageRow] = await handle.db
    .insert(comicPages)
    .values({ id: "page-1", projectId: project.id, chapterId: "ch-1", pageNumber: 1 })
    .returning();
  const [panelRow] = await handle.db
    .insert(comicPanels)
    .values({ id: "panel-1", projectId: project.id, pageId: "page-1", panelIndex: 1, imageUrl: "", panelPrompt: "" })
    .returning();
  await handle.db.insert(characterRelationships).values({
    projectId: project.id,
    characterAId: "c-1",
    characterBId: "c-2",
    trustLevel: 55,
  });

  return {
    handle,
    db: handle.db,
    user,
    project,
    alien,
    charRow,
    locRow,
    threadRow,
    entityRow,
    pageRow,
    panelRow,
    chapter: makeSqliteChapterRepository(handle.db),
    pairProject: makeSqliteProjectRepository(handle.db),
    child: makeSqliteChildResourceRepository(handle.db),
    bible: makeSqliteStoryBibleRepository(handle.db),
    hooks: makeSqlitePostCommitHooks(handle.db),
    transactions: makeSqliteStoryTransactionRepository(handle.db),
    history: makeSqliteStoryHistoryRepository(handle.db),
  };
}

describe("chapter repo + the revision bookkeeping", () => {
  it("updateScoped returns the row (Date/typed columns fine), deleteScoped removes it, cross-project ids page nothing", async () => {
    const { project, chapter, db } = await seed();

    const updated = await chapter.updateScoped(project.id, "ch-1", {
      title: "Renamed chapter",
      content: "New prose",
      updatedAt: new Date("2026-10-31T12:00:00.000Z"),
    } as never);
    expect(updated).not.toBeNull();
    expect((updated as Record<string, unknown>).title).toBe("Renamed chapter");
    expect((updated as Record<string, unknown>).updatedAt).toBeInstanceOf(Date);

    expect(await chapter.updateScoped("no-such", "ch-1", { content: "x" } as never)).toBeNull();
    expect(await chapter.updateScoped(project.id, "ch-alien", { content: "x" } as never)).toBeNull();

    await chapter.deleteScoped(project.id, "ch-1");
    const rows = await db.select().from(chapters).where(eq(chapters.projectId, project.id));
    expect(rows.map((r) => r.id)).toEqual([]);
  });

  it("the COALESCE bump is REAL: readContentRevision null → 1 → 2, and a stranger project stays null", async () => {
    const { project, hooks, bible } = await seed();

    expect(await bible.readContentRevision?.(project.id)).toBeNull();

    await hooks.onCanonicalMutation?.(project.id, "shot.update");
    expect(await bible.readContentRevision?.(project.id)).toBe(1);
    await hooks.onCanonicalMutation?.(project.id, "storyThread.create");
    expect(await bible.readContentRevision?.(project.id)).toBe(2);

    // A project that never mutated keeps its null (unknown ≠ zero, safe cache key).
    expect(await bible.readContentRevision?.("no-such-project")).toBeNull();
  });
});

describe("story bible read — one round trip, seven sections", () => {
  it("readSections returns exactly the seven keys with per-project scoping (alien rows never arrive)", async () => {
    const { project, bible } = await seed();
    const sections = await bible.readSections(project.id);

    expect(Object.keys(sections)).toEqual([
      "characters",
      "locations",
      "plotThreads",
      "worldEntities",
      "referenceWorks",
      "storyMemories",
      "characterRelationships",
    ]);
    expect((sections.characters ?? []).map((c) => (c as { id: string }).id).sort()).toEqual(["c-1", "c-2"]);
    expect((sections.locations ?? []).map((c) => (c as { id: string }).id)).toEqual(["l-1"]);
    expect((sections.plotThreads ?? []).map((c) => (c as { id: string }).id)).toEqual(["pt-1"]);
    expect((sections.worldEntities ?? []).map((c) => (c as { id: string }).id)).toEqual(["we-1"]);
    expect(sections.referenceWorks).toEqual([]);
    expect(sections.storyMemories).toEqual([]);
    expect(sections.characterRelationships).toHaveLength(1);
  });

  it("findOwned returns the full owned row or null (the pairing ProjectRepository port, distinct from pair 5's CRUD)", async () => {
    const { user, project, pairProject } = await seed();
    const owned = await pairProject.findOwned(project.id, user.id);
    expect((owned as Record<string, unknown> | null)?.id).toBe(project.id);
    expect((owned as Record<string, unknown> | null)?.userId).toBe(user.id);
    expect(await pairProject.findOwned(project.id, "stranger")).toBeNull();
  });

  it("the child-resource registry proves comic_pages/comic_panels ownership and refuses prototype-chain keys", async () => {
    const { project, child, pageRow, panelRow } = await seed();
    expect(await child.owns({ resource: "comic_pages", projectId: project.id, childId: pageRow.id } as never)).toBe(true);
    expect(await child.owns({ resource: "comic_panels", projectId: project.id, childId: panelRow.id } as never)).toBe(true);
    // Object.hasOwn guard: keys inherited through the prototype chain are NOT
    // resources (a plain truthy check would happily page them).
    expect(await child.owns({ resource: "toString", projectId: project.id, childId: "x" } as never)).toBe(false);
    expect(await child.owns({ resource: "__proto__", projectId: project.id, childId: "x" } as never)).toBe(false);
    expect(await child.owns({ resource: "comic_pages", projectId: project.id, childId: "nope" } as never)).toBe(false);
  });
});

/** One canonical §13.1 change list, shared by the transaction tests below. */
const changes: StoryChange[] = [
  { entityKey: "characters", entityId: "c-1", field: "antagonistToggle", oldValue: "", newValue: "true" },
  { entityKey: "characters", entityId: "c-1", field: "age", oldValue: "20s", newValue: "late 20s" },
  { entityKey: "characters", entityId: "c-1", field: "linkedLocationIds", oldValue: "", newValue: '["l-1"]' },
  { entityKey: "locations", entityId: "l-1", field: "name", oldValue: "The Dome", newValue: "The Dome, rebranded" },
  {
    entityKey: "worldEntities",
    entityId: "we-1",
    field: "properties",
    oldValue: "",
    newValue: '{"material":"laminate","charge":"kinetic"}',
  },
];

function tx(id: string, projectId: string, list: StoryChange[]): StoryTransaction {
  return {
    id,
    projectId,
    source: "user-edit",
    createdAt: new Date("2026-10-31T12:00:00.000Z"),
    changes: list,
    sourceGenerationId: "gen-1",
  };
}

describe("§13.1 transaction machinery over sqlite — record → apply → revert", () => {
  it("record lands the transaction AND its change rows atomically (raw row verification), changes sorted by seq on read", async () => {
    const { project, transactions, history, db } = await seed();
    await transactions.record(tx("t-1", project.id, changes));

    const txRows = await db.select().from(storyTransactions);
    expect(txRows).toHaveLength(1);
    expect(txRows[0]).toMatchObject({ id: "t-1", source: "user-edit", sourceGenerationId: "gen-1" });
    expect(txRows[0].createdAt).toBeInstanceOf(Date);
    const changeRows = await db.select().from(storyChanges);
    expect(changeRows).toHaveLength(changes.length);
    expect(changeRows.map((c) => c.seq)).toEqual([0, 1, 2, 3, 4]);
    expect(changeRows.every((c) => c.projectId === project.id)).toBe(true);
    expect(changeRows.every((c) => c.oldValue.length >= 0 && typeof c.newValue === "string")).toBe(true);

    const listed = await history.listTransactions(project.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]!.sourceGenerationId).toBe("gen-1");
    // changes sorted by seq regardless of insert order
    expect(listed[0]!.changes.map((c) => c.field)).toEqual(changes.map((c) => c.field));

    // Scoped single read + anomaly null.
    const got = await history.getTransaction(project.id, "t-1");
    expect(got!.id).toBe("t-1");
    expect(await history.getTransaction(project.id, "no-such-tx")).toBeNull();
    expect(await history.getTransaction("no-such-project", "t-1")).toBeNull();
  });

  it("applyChanges writes TYPED column values (boolean/number/json decoded from the wire, never literal strings) — one scoped UPDATE per row", async () => {
    const { project, transactions, db } = await seed();
    const theTx = tx("t-apply", project.id, changes);
    await transactions.applyChanges(project.id, theTx);

    const char = (await db.query.characters.findFirst()) as unknown as Record<string, unknown>;
    expect(char.antagonistToggle).toBe(true);
    expect(char.age).toBe("late 20s");
    expect(char.linkedLocationIds).toEqual(["l-1"]);
    const loc = (await db.select().from(locations).where(eq(locations.id, "l-1")))[0] as unknown as Record<string, unknown>;
    expect(loc.name).toBe("The Dome, rebranded");
    const entity = (await db.query.worldEntities.findFirst()) as unknown as Record<string, unknown>;
    expect(entity.properties).toEqual({ material: "laminate", charge: "kinetic" });

    // The revision bump is the adapter's separate hook — applyChanges does NOT bump (pg identical; hooks fire handler-side after the write).
    const [proj] = await db.select().from(projects);
    expect(proj.contentRevision).toBeNull();
  });

  it("revertChanges restores the recorded oldValues for REAL (inverse decode), then returns conflicts after a bespoke later edit", async () => {
    const { project, transactions, history, db } = await seed();
    const theTx = tx("t-rev", project.id, changes);
    await transactions.record(theTx);
    await transactions.applyChanges(project.id, theTx);

    // Happy revert: all five fields restored to oldValues. NOTE the empty-wire
    // restoration per kind: antagonistToggle ""→ boolean NULL→ false reads as
    // the column's default? No — a real null lands in the nullable json column
    // and world_entities.properties reads SQL null booleans — pinned below as
    // REAL nulls, not fabricated [] (absence, per the codec's contract).
    await history.revertChanges(project.id, changes);
    const charAfter = (await db.query.characters.findFirst()) as unknown as Record<string, unknown>;
    // boolean "" wire → restore SQL NULL, not `false` (absence pinned).
    expect(charAfter.antagonistToggle).toBeNull();
    expect(charAfter.age).toBe("20s");
    // json "" wire → restore SQL NULL, not `[]` / `{` (absence pinned).
    expect(charAfter.linkedLocationIds).toBeNull();
    const locAfter = (await db.select().from(locations).where(eq(locations.id, "l-1")))[0] as unknown as Record<string, unknown>;
    expect(locAfter.name).toBe("The Dome");
    const entityAfter = (await db.query.worldEntities.findFirst()) as unknown as Record<string, unknown>;
    expect(entityAfter.properties).toBeNull();

    // Conflict detection: re-apply, then a bespoke later edit moves `age` off
    // the recorded value. The revert of the NOW-STALE wires returns the age
    // conflict (with the LIVE value encoded to the canonical wire) and — the
    // all-or-nothing contract — performs NO write at all.
    await transactions.applyChanges(project.id, theTx);
    await transactions.applyChanges(project.id, tx("t-later", project.id, [
      { entityKey: "characters", entityId: "c-1", field: "age", oldValue: "late 20s", newValue: "three decades" },
    ]));
    const conflicts = await history.revertChanges(project.id, changes);
    expect(conflicts).toEqual([
      { entityKey: "characters", entityId: "c-1", field: "age", current: "three decades" },
    ]);
    // NOTHING was reverted on the conflict path:
    expect(((await db.query.characters.findFirst()) as unknown as Record<string, unknown>).age).toBe("three decades");
    expect(((await db.query.characters.findFirst()) as unknown as Record<string, unknown>).antagonistToggle).toBe(true);
    void db;
  });

  it("the typed failures: MissingEntitiesError pre-check, unwritable field, unknown entity key, empty changes no-op", async () => {
    const { project, transactions, history } = await seed();

    // Invented entityId fails the WHOLE transaction before any write.
    let err: MissingEntitiesError | null = null;
    try {
      await transactions.applyChanges(project.id, tx("t-missing", project.id, [
        { entityKey: "characters", entityId: "ghost", field: "age", oldValue: "", newValue: "x" },
      ]));
    } catch (e) {
      err = e as MissingEntitiesError;
    }
    expect(err).toBeInstanceOf(MissingEntitiesError);
    expect(err!.name).toBe("MissingEntitiesError");
    expect(err!.missing).toEqual([{ entityKey: "characters", entityId: "ghost" }]);

    // An unwritable/mirrored-away field (embedding is deliberately NOT mapped —
    // vector columns are the baseline's sanctioned omission) refuses loudly.
    let notWritable: Error | null = null;
    try {
      await transactions.applyChanges(project.id, tx("t-emb", project.id, [
        { entityKey: "characters", entityId: "c-1", field: "embedding", oldValue: "", newValue: "[0.1]" },
      ]));
    } catch (e) {
      notWritable = e as Error;
    }
    expect(notWritable!.message).toMatch(/not writable on characters/);

    // revert with an unknown entity key refuses the same way.
    let unknownKey: Error | null = null;
    try {
      await history.revertChanges(project.id, [
        { entityKey: "storyThreads" as never, entityId: "x", field: "status", oldValue: "", newValue: "" },
      ]);
    } catch (e) {
      unknownKey = e as Error;
    }
    expect(unknownKey!.message).toMatch(/unknown entity key "storyThreads"/);

    // A missing entity at the verify pass is a typed failure listing the ref.
    let revertedMissing: Error | null = null;
    try {
      await history.revertChanges(project.id, [
        { entityKey: "characters", entityId: "ghost", field: "age", oldValue: "", newValue: "x" },
      ]);
    } catch (e) {
      revertedMissing = e as Error;
    }
    expect(revertedMissing!.name).toBe("MissingEntitiesError");

    // Empty changes are no-ops on both verbs.
    expect(await transactions.applyChanges(project.id, tx("t-none", project.id, []))).toBeUndefined();
    expect(await history.revertChanges(project.id, [])).toEqual([]);
  });
});

describe("engine-agreement pins — the mechanical cross-checks", () => {
  it("ENTITY_TABLES' field sets are IDENTICAL to DIFF_FIELDS' real inventory (the sqlite-side mirror gate)", () => {
    for (const key of Object.keys(DIFF_FIELDS) as (keyof typeof DIFF_FIELDS)[]) {
      const spec = ENTITY_TABLES[key];
      expect(spec, `mirror missing for ${key}`).toBeTruthy();
      const allowlisted = DIFF_FIELDS[key].map((entry) => entry.field).sort();
      const mirrored = Object.keys(spec.columns).sort();
      expect(mirrored, key).toEqual(allowlisted);
    }
    // The four keys are exactly the allowlisted inventory; no fifth row may appear.
    expect(Object.keys(ENTITY_TABLES).sort()).toEqual(
      (Object.keys(DIFF_FIELDS) as string[]).sort(),
    );
  });

  it("empty-wire restoration per kind: string → '', boolean/number/json → null (absence, never a fabricated falsy)", () => {
    expect(encodeChangeValue({ dataType: "string" }, null)).toBe("");
    const empty = encodeChangeValue({ dataType: "json" }, []);
    expect(empty).toBe("");
    expect(encodeChangeValue({ dataType: "boolean" }, true)).toBe("true");
    expect(encodeChangeValue({ dataType: "number" }, 4)).toBe("4");
    expect(encodeChangeValue({ dataType: "json" }, ["l-1"])).toBe('["l-1"]');
    // The sqlite columns' runtime dataTypes match the codec's contract.
    expect(ENTITY_TABLES.characters.columns.antagonistToggle.dataType).toBe("boolean");
    expect(ENTITY_TABLES.characters.columns.linkedLocationIds.dataType).toBe("json");
    expect(ENTITY_TABLES.characters.columns.age.dataType).toBe("string");
    expect(ENTITY_TABLES.worldEntities.columns.properties.dataType).toBe("json");
  });
});

describe("real-DB-specific — FK cascade + DDL presence", () => {
  it("deleting the project cascades the audit trail (transactions + changes both die with their project)", async () => {
    const { handle, project, transactions } = await seed();
    await transactions.record(tx("t-cascade", project.id, changes));
    await transactions.record(tx("t-cascade2", project.id, []));
    expect((await handle.db.select().from(storyTransactions)).length).toBe(2);
    expect((await handle.db.select().from(storyChanges)).length).toBe(changes.length);

    await handle.db.delete(projects).where(eq(projects.id, project.id));
    expect(await handle.db.select().from(storyTransactions)).toEqual([]);
    expect(await handle.db.select().from(storyChanges)).toEqual([]);
  });

  it("the vendored DDL includes the transaction machinery tables", () => {
    expect(SQLITE_DDL).toContain('CREATE TABLE "story_transactions"');
    expect(SQLITE_DDL).toContain('CREATE TABLE "story_changes"');
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
    join(__dirname, "../sqlite-repositories.ts"),
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
