import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";

import { createSqliteDb, type SqliteDbHandle } from "@/db/sqlite";
import { SQLITE_DDL } from "@/db/sqlite-ddl";
import { projects, users, worldEntities } from "@/db/sqlite-schema";
import { cloudContext } from "@/lib/core/request-context";
import type { PostCommitHooks } from "@/lib/core/repositories";
import {
  createWorldEntity,
  deleteWorldEntity,
  listWorldEntities,
  updateWorldEntity,
  type WorldEntityCrudRepository,
} from "@/lib/core/handlers/world-entities";
import {
  readIntentionalViolations,
  recordIntentionalViolation,
} from "@/lib/core/handlers/intentional-violations";
import { encodeWorldEntityProperties } from "@/lib/types/story";
import {
  makeSqliteIntentionalViolationRepository,
  makeSqliteWorldEntityCrudRepository,
} from "@/lib/core/sqlite-world-entity-repos";

/**
 * The world-entity / intentional-violation slice of the sqlite tracer's
 * real-DB parity suite (docs/migration/phase3-prep.md §4): the same handler
 * functions as `world-entity-violation-crud.test.ts`, driven against a real
 * node:sqlite database through the sqlite-proxy drizzle baseline — no mocks
 * for reachability questions. Mirrors the pg adapters' contract with real
 * observables (row counts instead of call spies where the DB can answer),
 * plus the pair's specific cases: the embedding degradation (create/update
 * strip the column, `onlyWithEmbedding` honestly empties the scan pool, and
 * `findSimilarEntities` therefore finds nothing — no soft crash), the
 * zod-shaped `properties` blob round-tripping through TEXT storage, and — the
 * violation side — the acknowledgement map living on the projects row (no
 * second table), keyed by violationType with overwrite dedupe.
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

// `properties` is built through the SAME route-side helper the real route
// hits (`encodeWorldEntityProperties` — normalization at the transport edge,
// not a reimplementation of it).
const entityProperties = () =>
  encodeWorldEntityProperties({
    origin: "forged in payroll season",
    material: "iron",
    powers: ["never dulls"],
    // `bogus` is deliberately invalid: the helper strips unknown keys, so the
    // typed blob below is what both adapters store, exactly like the route.
    bogus: 1,
  });

const entityData = (name = "The Ledger Blade") => ({
  kind: "weapon",
  name,
  summary: "A blade that cuts the budget",
  description: "Kept behind the counter",
  properties: entityProperties(),
  linkedCharacterIds: ["c1"],
  linkedLocationIds: ["l1"],
  linkedPlotThreadIds: ["t1"],
  linkedEntityIds: ["w1"],
  alwaysInContext: true,
  sortOrder: 2,
});

/** Seed one user + one project, and return repos wired to that database. */
async function seed() {
  const handle = fresh();
  const [user] = await handle.db.insert(users).values({ email: "u1@test.dev" }).returning();
  const [project] = await handle.db.insert(projects).values({ userId: user.id }).returning();
  return {
    handle,
    db: handle.db,
    sqlite: handle.sqlite,
    user,
    project,
    entityRepo: makeSqliteWorldEntityCrudRepository(handle.db),
    violationRepo: makeSqliteIntentionalViolationRepository(handle.db),
  };
}

describe("createWorldEntity through the real adapter", () => {
  it("happy path — uuid id, column-level round-trip of every supplied field, Date timestamps, hook fires", async () => {
    const log: string[] = [];
    const { user, project, entityRepo } = await seed();
    const result = await createWorldEntity(
      cloudContext(user.id),
      { projectId: project.id, entity: entityData() },
      entityRepo,
      hooks(log),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Ids are client-generated uuids ($defaultFn in sqlite-schema.ts).
    expect(result.entity.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.entity.projectId).toBe(project.id);
    expect(result.entity.kind).toBe("weapon");
    expect(result.entity.name).toBe("The Ledger Blade");
    expect(result.entity.summary).toBe("A blade that cuts the budget");
    expect(result.entity.description).toBe("Kept behind the counter");
    // The zod-typed blob came back as the same typed object the route built.
    expect(result.entity.properties).toEqual(entityProperties());
    expect(result.entity.linkedCharacterIds).toEqual(["c1"]);
    expect(result.entity.linkedLocationIds).toEqual(["l1"]);
    expect(result.entity.linkedPlotThreadIds).toEqual(["t1"]);
    expect(result.entity.linkedEntityIds).toEqual(["w1"]);
    expect(result.entity.alwaysInContext).toBe(true);
    expect(result.entity.sortOrder).toBe(2);
    // epoch-ms integer columns surface as real Date objects (timestamp_ms mode).
    expect(result.entity.createdAt).toBeInstanceOf(Date);
    expect(result.entity.updatedAt).toBeInstanceOf(Date);
    // The degraded column never appears, whatever the handler threaded — and
    // the default no-embed seam (embedding: null) is stripped by the adapter
    // too: the insert below would reject on an unknown column otherwise.
    expect(result.entity).not.toHaveProperty("embedding");
    expect(result.similarEntities).toEqual([]);
    expect(log).toEqual(["hook:worldEntity.create"]);
  });

  it("a name-only create keeps the handler's column defaults, exactly where pg applied its schema defaults", async () => {
    const { user, project, entityRepo } = await seed();
    const result = await createWorldEntity(
      cloudContext(user.id),
      { projectId: project.id, entity: { kind: "concept", name: "Debt Gravity", properties: {} } },
      entityRepo,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entity.summary).toBe("");
    expect(result.entity.description).toBe("");
    expect(result.entity.properties).toEqual({});
    expect(result.entity.linkedCharacterIds).toEqual([]);
    expect(result.entity.linkedLocationIds).toEqual([]);
    expect(result.entity.linkedPlotThreadIds).toEqual([]);
    expect(result.entity.linkedEntityIds).toEqual([]);
    expect(result.entity.alwaysInContext).toBe(false);
    expect(result.entity.sortOrder).toBe(0);
  });

  it("the embedText-computed embedding is stripped before insert, not written (degraded baseline)", async () => {
    const { user, project, entityRepo } = await seed();
    // A real array this time — if the strip were missing, the insert would
    // reject (no such column: embedding) and this would fail loudly.
    const result = await createWorldEntity(
      cloudContext(user.id),
      { projectId: project.id, entity: entityData("Second Blade") },
      entityRepo,
      undefined,
      async () => [1, 0],
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entity.name).toBe("Second Blade");
    expect(result.entity).not.toHaveProperty("embedding");
  });
});

describe("the zod properties blob round-trips through TEXT storage", () => {
  it("the column on disk is TEXT json; the typed object is decoded by the same mode:\"json\" translation", async () => {
    const { sqlite, user, project, entityRepo } = await seed();
    const result = await createWorldEntity(
      cloudContext(user.id),
      { projectId: project.id, entity: entityData() },
      entityRepo,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Core's typed object was JSON-encoded at the adapter boundary and parsed
    // back on read (verified against code: the pg adapter does NO zod decode
    // either — pass-through on a typed json column is the parity contract).
    const raw = sqlite
      .prepare("SELECT properties FROM world_entities WHERE id = ?")
      .get(result.entity.id) as { properties: string } | undefined;
    expect(typeof raw?.properties).toBe("string");
    expect(JSON.parse(raw!.properties)).toEqual(entityProperties());
    // The helpers' decode catches the raw TEXT too — one shape, both sides.
    expect(result.entity.properties).toEqual(entityProperties());
  });
});

describe("findScoped through the real adapter — filtering, ordering, degradation", () => {
  it("the duplicate scan threads kind+excludeId+onlyWithEmbedding exactly like pg, degrades to no matches, no row ever carries an embedding", async () => {
    const { user, project, entityRepo } = await seed();
    // A pre-existing row of the SAME kind, created BEFORE the new one so the
    // freshly-created row's id is the one excluded (the route-identical pool).
    const preExisting = await entityRepo.create(project.id, {
      kind: "weapon",
      name: "Forked Ledger",
    });
    expect(preExisting).not.toBeNull();

    // Call-tracking pass-through spy (handler -> adapter arg threading).
    const calls: Array<Parameters<WorldEntityCrudRepository["findScoped"]>> = [];
    const findScoped: WorldEntityCrudRepository["findScoped"] = async (projectId, query) => {
      calls.push([projectId, query]);
      return entityRepo.findScoped(projectId, query);
    };

    const result = await createWorldEntity(
      cloudContext(user.id),
      { projectId: project.id, entity: entityData() },
      { ...entityRepo, findScoped },
      undefined,
      async () => [1, 0],
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The kind scoping is world-entity-specific (characters/locations have no
    // kind column): same-kind scan excluding the new row itself.
    expect(calls).toEqual([
      [project.id, { kind: "weapon", excludeId: result.entity.id, onlyWithEmbedding: true }],
    ]);
    // §4.2 degrade: no embeddings stored locally -> the scan pool is empty ->
    // findSimilarEntities filters everything out -> no matches, no crash.
    expect(result.similarEntities).toEqual([]);

    // Adapter-level pins on real rows: the pool the scan WOULD see is
    // honestly empty, and every readable row lacks the pg-only column entirely.
    const pool = await entityRepo.findScoped(project.id, {
      kind: "weapon",
      onlyWithEmbedding: true,
    });
    expect(pool).toEqual([]);
    const rows = await entityRepo.findScoped(project.id);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => !("embedding" in r))).toBe(true);
  });

  it("kind filter and exclusion really filter rows; (kind, sortOrder) is the order the Story Bible groups by", async () => {
    const { user, project, entityRepo } = await seed();
    // Two weapons (the sortOrder tiebreak), an object, a concept.
    const wLow = await entityRepo.create(project.id, { kind: "weapon", name: "W low", sortOrder: 4 });
    const wHigh = await entityRepo.create(project.id, { kind: "weapon", name: "W high", sortOrder: 9 });
    const obj = await entityRepo.create(project.id, { kind: "object", name: "O", sortOrder: 3 });
    const concept = await entityRepo.create(project.id, { kind: "concept", name: "C", sortOrder: 1 });
    if (!wLow || !wHigh || !obj || !concept) throw new Error("seed failed");

    // kind asc, then sortOrder asc — the pg ORDER BY verbatim.
    const all = await entityRepo.findScoped(project.id);
    expect(all.map((r) => r.name)).toEqual(["C", "O", "W low", "W high"]);

    const onlyWeapons = await entityRepo.findScoped(project.id, { kind: "weapon" });
    expect(onlyWeapons.map((r) => r.name)).toEqual(["W low", "W high"]);

    const excludingHigh = await entityRepo.findScoped(project.id, {
      kind: "weapon",
      excludeId: wHigh.id,
    });
    expect(excludingHigh.map((r) => r.name)).toEqual(["W low"]);

    // Cross-kind rows never leak through a kind-scoped pool.
    const onlyObjects = await entityRepo.findScoped(project.id, { kind: "object" });
    expect(onlyObjects.map((r) => r.id)).toEqual([obj.id]);
  });

  it("project isolation — a second project's rows never leak into another project's list", async () => {
    const { handle, user, project, entityRepo } = await seed();
    const [other] = await handle.db.insert(projects).values({ userId: user.id }).returning();

    await entityRepo.create(project.id, entityData());
    const otherRow = await entityRepo.create(other.id, { kind: "weapon", name: "Foreign Blade" });
    expect(otherRow).not.toBeNull();
    expect(otherRow!.projectId).toBe(other.id);

    const mine = await listWorldEntities(
      cloudContext(user.id),
      { projectId: project.id },
      entityRepo,
    );
    expect(mine.ok).toBe(true);
    if (!mine.ok) return;
    expect(mine.entities).toHaveLength(1);
    expect(mine.entities[0]!.projectId).toBe(project.id);
  });
});

describe("updateWorldEntity / deleteWorldEntity through the real adapter", () => {
  it("update honors the patch at column level (properties changes round-trip through TEXT), stamps updatedAt, fires hook:worldEntity.update", async () => {
    const log: string[] = [];
    const { user, project, entityRepo } = await seed();
    const created = await createWorldEntity(
      cloudContext(user.id),
      { projectId: project.id, entity: entityData() },
      entityRepo,
    );
    if (!created.ok) throw new Error("seed failed");
    const eid = created.entity.id;

    const result = await updateWorldEntity(
      cloudContext(user.id),
      {
        projectId: project.id,
        entityId: eid,
        patch: {
          name: "The Ledger Blade II",
          properties: encodeWorldEntityProperties({ material: "steel" }),
        },
      },
      entityRepo,
      hooks(log),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entity.name).toBe("The Ledger Blade II");
    expect(result.entity.summary).toBe("A blade that cuts the budget"); // untouched fields stay
    expect(result.entity.properties).toEqual(encodeWorldEntityProperties({ material: "steel" }));
    // The handler owns updatedAt — a real Date, stamped server-side.
    expect(result.entity.updatedAt).toBeInstanceOf(Date);
    expect(log).toEqual(["hook:worldEntity.update"]);
  });

  it("update can never write an embedding even if one arrives in the patch; no-match returns null", async () => {
    const { user, project, entityRepo } = await seed();
    const created = await createWorldEntity(
      cloudContext(user.id),
      { projectId: project.id, entity: entityData() },
      entityRepo,
    );
    if (!created.ok) throw new Error("seed failed");

    // The adapter strips pg-only keys: this write would reject with
    // "no such column: embedding" if the strip were missing.
    const row = await entityRepo.updateScoped(project.id, created.entity.id, {
      name: "Still No Vector",
      embedding: [1, 0],
    });
    expect(row).not.toBeNull();
    expect(row!.name).toBe("Still No Vector");
    expect(row!).not.toHaveProperty("embedding");

    // Adapter-level parity pin: no matching row -> null (the handler 404s on it).
    expect(await entityRepo.updateScoped(project.id, "no-such-entity", { name: "x" })).toBe(null);
  });

  it("handler 404 on a wrong id: no write, no hook (IDOR shape, real rows)", async () => {
    const { handle, user, project, entityRepo } = await seed();
    const log: string[] = [];
    const before = await handle.db.select().from(worldEntities).where(eq(worldEntities.projectId, project.id));

    const result = await updateWorldEntity(
      cloudContext(user.id),
      { projectId: project.id, entityId: "no-such-entity", patch: { name: "Twist" } },
      entityRepo,
      hooks(log),
    );

    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(log).toEqual([]);
    const after = await handle.db.select().from(worldEntities).where(eq(worldEntities.projectId, project.id));
    expect(after).toEqual(before);
  });

  it("delete — scoped delete is idempotent, hook fires each call, real row vanishes", async () => {
    const { handle, user, project, entityRepo } = await seed();
    const created = await createWorldEntity(
      cloudContext(user.id),
      { projectId: project.id, entity: entityData() },
      entityRepo,
    );
    if (!created.ok) throw new Error("seed failed");
    const eid = created.entity.id;
    const log: string[] = [];

    const first = await deleteWorldEntity(
      cloudContext(user.id),
      { projectId: project.id, entityId: eid },
      entityRepo,
      hooks(log),
    );
    const second = await deleteWorldEntity(
      cloudContext(user.id),
      { projectId: project.id, entityId: eid },
      entityRepo,
      hooks(log),
    );

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(log).toEqual(["hook:worldEntity.delete", "hook:worldEntity.delete"]);
    const left = await handle.db.select().from(worldEntities).where(eq(worldEntities.id, eid));
    expect(left).toEqual([]);
  });
});

describe("intentional violations through the real adapter — the projects-row acknowledgement map", () => {
  it("a fresh project reads as the empty map (the '{}' column default decodes on read)", async () => {
    const { user, project, violationRepo } = await seed();
    const result = await readIntentionalViolations(
      cloudContext(user.id),
      { projectId: project.id },
      violationRepo,
    );
    expect(result).toEqual({ ok: true, violations: {} });
    // Adapter-level parity pin: a non-owned project is 404, not an empty map.
    const stranger = await readIntentionalViolations(
      cloudContext("stranger"),
      { projectId: project.id },
      violationRepo,
    );
    expect(stranger).toEqual({ ok: false, status: 404, reason: "Not found" });
  });

  it("record -> read back: normalized entry (purpose || \"\"), timestamp stamped at write, hook fires violation.acknowledge", async () => {
    const log: string[] = [];
    const { user, project, violationRepo } = await seed();

    const result = await recordIntentionalViolation(
      cloudContext(user.id),
      { projectId: project.id, violationType: "safety_violation", purpose: undefined },
      violationRepo,
      hooks(log),
    );

    expect(result).toEqual({ ok: true });
    expect(log).toEqual(["hook:violation.acknowledge"]);

    const read = await readIntentionalViolations(
      cloudContext(user.id),
      { projectId: project.id },
      violationRepo,
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const entry = read.violations.safety_violation!;
    expect(entry.confirmed).toBe(true);
    expect(entry.purpose).toBe(""); // the route's `purpose || ""` fallback
    expect(typeof entry.timestamp).toBe("string");
    expect(Number.isNaN(new Date(entry.timestamp).getTime())).toBe(false);
  });

  it("re-acknowledging one violationType REPLACES its entry (the single-record dedupe); other keys coexist; the map is TEXT json on disk", async () => {
    const { sqlite, user, project, violationRepo } = await seed();

    await recordIntentionalViolation(
      cloudContext(user.id),
      { projectId: project.id, violationType: "safety_violation", purpose: "dark ending" },
      violationRepo,
    );
    await recordIntentionalViolation(
      cloudContext(user.id),
      { projectId: project.id, violationType: "knowledge_violation", purpose: "narrator omniscience" },
      violationRepo,
    );
    await recordIntentionalViolation(
      cloudContext(user.id),
      { projectId: project.id, violationType: "safety_violation", purpose: "dark ending, sharper" },
      violationRepo,
    );

    const read = await readIntentionalViolations(
      cloudContext(user.id),
      { projectId: project.id },
      violationRepo,
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    // Two distinct keys survive; the first key holds only its LATEST entry.
    expect(Object.keys(read.violations).sort()).toEqual(["knowledge_violation", "safety_violation"]);
    expect(read.violations.safety_violation!.purpose).toBe("dark ending, sharper");
    expect(read.violations.knowledge_violation!.purpose).toBe("narrator omniscience");

    // The column really is TEXT json on disk — core's typed map was encoded
    // at the adapter boundary, exactly the §4.2 discipline.
    const raw = sqlite
      .prepare("SELECT intentional_violations FROM projects WHERE id = ?")
      .get(project.id) as { intentional_violations?: string | null } | undefined;
    expect(typeof raw?.intentional_violations).toBe("string");
    expect(JSON.parse(raw!.intentional_violations!).safety_violation.purpose).toBe(
      "dark ending, sharper",
    );
  });

  it("keeps the route's error order on real rows: scope 403 -> ownership 404 beats the missing-violationType 400", async () => {
    const { user, project, violationRepo } = await seed();

    // Scope mismatch — 403 before anything else.
    expect(
      await recordIntentionalViolation(
        cloudContext(user.id, { projectScope: "other-project" }),
        { projectId: project.id },
        violationRepo,
      ),
    ).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    // Non-owner + missing violationType: 404 wins (the route checked ownership
    // BEFORE reading the body) — an unauthorized caller learns nothing.
    expect(
      await recordIntentionalViolation(cloudContext("stranger"), { projectId: project.id }, violationRepo),
    ).toEqual({ ok: false, status: 404, reason: "Not found" });
    // Owner + missing violationType: the real 400, now that ownership passed.
    expect(
      await recordIntentionalViolation(cloudContext(user.id), { projectId: project.id }, violationRepo),
    ).toEqual({ ok: false, status: 400, reason: "violationType required" });
  });
});

describe("403/404 orderings through the real adapter (world-entity CRUD)", () => {
  it("scope mismatch 403s before the port, non-owned project 404s at the port; refusals write nothing and fire nothing", async () => {
    const { handle, user, project, entityRepo } = await seed();
    const log: string[] = [];
    const before = await handle.db.select().from(worldEntities).where(eq(worldEntities.projectId, project.id));

    const c403 = await createWorldEntity(
      cloudContext(user.id, { projectScope: "other-project" }),
      { projectId: project.id, entity: entityData() },
      entityRepo,
      hooks(log),
    );
    const c404 = await createWorldEntity(
      cloudContext("stranger"),
      { projectId: project.id, entity: entityData() },
      entityRepo,
      hooks(log),
    );
    const d403 = await deleteWorldEntity(
      cloudContext(user.id, { projectScope: "other-project" }),
      { projectId: project.id, entityId: "no-such-entity" },
      entityRepo,
      hooks(log),
    );
    const d404 = await deleteWorldEntity(
      cloudContext("stranger"),
      { projectId: project.id, entityId: "no-such-entity" },
      entityRepo,
      hooks(log),
    );
    const l403 = await listWorldEntities(
      cloudContext(user.id, { projectScope: "other-project" }),
      { projectId: project.id },
      entityRepo,
    );
    const l404 = await listWorldEntities(cloudContext("stranger"), { projectId: project.id }, entityRepo);

    expect(c403).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(c404).toEqual({ ok: false, status: 404, reason: "Not found" });
    // deleteWorldEntity returns the reason-less status-only shape.
    expect(d403).toEqual({ ok: false, status: 403 });
    expect(d404).toEqual({ ok: false, status: 404 });
    expect(l403).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(l404).toEqual({ ok: false, status: 404, reason: "Not found" });

    const after = await handle.db.select().from(worldEntities).where(eq(worldEntities.projectId, project.id));
    expect(after).toEqual(before);
    expect(log).toEqual([]);
  });
});

describe("real-DB-specific — FK cascade + DDL presence", () => {
  it("deleting a project cascades its world entities; other projects' rows survive", async () => {
    const { handle, user, project, entityRepo } = await seed();
    const [other] = await handle.db.insert(projects).values({ userId: user.id }).returning();
    await entityRepo.create(project.id, entityData());
    const foreign = await entityRepo.create(other.id, { kind: "weapon", name: "Foreign Blade" });
    expect(foreign).not.toBeNull();

    await handle.db.delete(projects).where(eq(projects.id, project.id));

    const left = await handle.db.select().from(worldEntities);
    expect(left).toHaveLength(1);
    expect(left[0]!.projectId).toBe(other.id);
  });

  it("the vendored DDL includes both halves (the 43-table baseline already carried them)", () => {
    expect(SQLITE_DDL).toContain('CREATE TABLE "world_entities"');
    // The acknowledgement store lives on the projects row — its TEXT default
    // is the '{}' the read side decodes into the empty map.
    expect(SQLITE_DDL).toContain('"intentional_violations" text DEFAULT \'{}\'');
  });
});

describe("source purity of the sqlite layer (live-shell-reachability convention)", () => {
  // Deliberately a COPY of the character-location parity test's FILES array
  // rather than an edit of it: each new parity file carries its own purity
  // check so pair-by-pair integration never touches the already-landed suite.
  const FILES = [
    join(__dirname, "../../../db/sqlite.ts"),
    join(__dirname, "../../../db/sqlite-schema.ts"),
    join(__dirname, "../../../db/sqlite-ddl.ts"),
    join(__dirname, "../sqlite-character-location-repos.ts"),
    join(__dirname, "../sqlite-thread-reference-repos.ts"),
    join(__dirname, "../sqlite-world-entity-repos.ts"),
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
