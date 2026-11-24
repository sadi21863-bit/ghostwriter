import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";

import { createSqliteDb, type SqliteDbHandle } from "@/db/sqlite";
import { characters, locations, projects, semanticCache, users } from "@/db/sqlite-schema";
import {
  createCharacter,
  deleteCharacter,
  updateCharacter,
  type CharacterCrudRepository,
} from "@/lib/core/handlers/characters";
import { createLocation } from "@/lib/core/handlers/locations";
import type { PostCommitHooks } from "@/lib/core/repositories";
import { cloudContext } from "@/lib/core/request-context";
import {
  makeSqliteCharacterCrudRepository,
  makeSqliteLocationCrudRepository,
} from "@/lib/core/sqlite-character-location-repos";

/**
 * The sqlite tracer's real-DB parity suite (docs/migration/phase3-prep.md §4):
 * the same handler functions as `character-location-crud.test.ts`, driven against
 * a real node:sqlite database through the sqlite-proxy drizzle baseline — no
 * mocks for reachability questions. Mirrors the contract assertions with real
 * observables (row counts instead of call spies where the DB can answer), plus
 * DB-specific cases the contract mock cannot express (FK cascade, semantic_cache
 * composite unique, embedding-strip degradation, source purity).
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

const charData = (name = "Mara") => ({
  name,
  role: "Protagonist",
  appearance: "scarred",
  personality: "stubborn",
});
const locData = (name = "The Old Mill") => ({ name, description: "Abandoned" });

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
    charRepo: makeSqliteCharacterCrudRepository(handle.db),
    locRepo: makeSqliteLocationCrudRepository(handle.db),
  };
}

describe("sqlite baseline — ownership + relational-query API", () => {
  it("ownsProject/findProjectFormat work through db.query.findFirst over the relation-less schema", async () => {
    const { user, project, charRepo } = await seed();

    expect(await charRepo.ownsProject(project.id, user.id)).toBe(true);
    expect(await charRepo.ownsProject(project.id, "stranger")).toBe(false);
    expect(await charRepo.findProjectFormat(project.id, user.id)).toBe("Novel");
    expect(await charRepo.findProjectFormat("no-such-project", user.id)).toBe(null);
  });
});

describe("createCharacter through the real adapter", () => {
  it("happy path — uuid id, returning fidelity (defaults + patch fields + Date timestamps), hook fires", async () => {
    const log: string[] = [];
    const { user, project, charRepo } = await seed();
    const result = await createCharacter(
      cloudContext(user.id),
      { projectId: project.id, data: charData() },
      charRepo,
      hooks(log),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.similarEntities).toEqual([]);
    // Ids are client-generated uuids ($defaultFn in sqlite-schema.ts).
    expect(result.character.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.character.projectId).toBe(project.id);
    expect(result.character.name).toBe("Mara");
    expect(result.character.role).toBe("Protagonist");
    expect(result.character.appearance).toBe("scarred");
    expect(result.character.personality).toBe("stubborn");
    // epoch-ms integer columns surface as real Date objects (timestamp_ms mode).
    expect(result.character.createdAt).toBeInstanceOf(Date);
    expect(result.character.updatedAt).toBeInstanceOf(Date);
    expect(result.character).not.toHaveProperty("embedding");
    expect(log).toEqual(["hook:character.create"]);
  });

  it("the embedText-computed embedding is stripped before insert, not written (degraded baseline)", async () => {
    const { user, project, charRepo } = await seed();
    const result = await createCharacter(
      cloudContext(user.id),
      { projectId: project.id, data: charData("Sarah") },
      charRepo,
      undefined,
      async () => [1, 0],
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.character.name).toBe("Sarah");
    // If the strip were missing, the insert would reject (no such column).
    expect(result.character).not.toHaveProperty("embedding");
  });

  it("duplicate scan threads excludeId+onlyWithEmbedding exactly like pg, degrades to no matches, and exclusion really filters rows", async () => {
    const { user, project, charRepo } = await seed();
    // A pre-existing row (as a real user's project would have) — created BEFORE
    // the new one so the freshly-created row's id is the one excluded.
    const preExisting = await charRepo.create(project.id, { name: "Sara", role: "Rival" });
    expect(preExisting).not.toBeNull();

    // Call-tracking pass-through spy (handler -> adapter arg threading).
    const calls: Array<Parameters<CharacterCrudRepository["findScoped"]>> = [];
    const findScoped: CharacterCrudRepository["findScoped"] = async (projectId, query) => {
      calls.push([projectId, query]);
      return charRepo.findScoped(projectId, query);
    };

    const result = await createCharacter(
      cloudContext(user.id),
      { projectId: project.id, data: charData("Sarah") },
      { ...charRepo, findScoped },
      undefined,
      async () => [1, 0],
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(calls).toEqual([
      [project.id, { excludeId: result.character.id, onlyWithEmbedding: true }],
    ]);
    // §4.2 degrade: no embeddings stored locally -> the scan pool is empty ->
    // no similar entities, no crash.
    expect(result.similarEntities).toEqual([]);

    // Adapter-level SQL pins: the ne() exclusion really filters on real rows
    // (probed without the onlyWithEmbedding flag so both rows are in scope).
    const excludingNew = await charRepo.findScoped(project.id, { excludeId: result.character.id });
    expect(excludingNew.map((r) => r.name)).toEqual(["Sara"]);
    const excludingOld = await charRepo.findScoped(project.id, { excludeId: preExisting!.id });
    expect(excludingOld.map((r) => r.name)).toEqual(["Sarah"]);
  });

  it("403/404 refusals write nothing and fire nothing", async () => {
    const { handle, user, project, charRepo } = await seed();
    const log: string[] = [];
    const before = await handle.db.select().from(characters).where(eq(characters.projectId, project.id));

    const r403 = await createCharacter(
      cloudContext(user.id, { projectScope: "other-project" }),
      { projectId: project.id, data: charData() },
      charRepo,
      hooks(log),
    );
    const r404 = await createCharacter(
      cloudContext("stranger"),
      { projectId: project.id, data: charData() },
      charRepo,
      hooks(log),
    );

    expect(r403).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(r404).toEqual({ ok: false, status: 404, reason: "Not found" });
    const after = await handle.db.select().from(characters).where(eq(characters.projectId, project.id));
    expect(after).toEqual(before);
    expect(log).toEqual([]);
  });
});

describe("updateCharacter / deleteCharacter through the real adapter", () => {
  it("update honors the patch at column level and fires hook:character.update; adapter-level no-match returns null", async () => {
    const log: string[] = [];
    const { user, project, charRepo } = await seed();
    const created = await createCharacter(
      cloudContext(user.id),
      { projectId: project.id, data: charData() },
      charRepo,
    );
    if (!created.ok) throw new Error("seed failed");
    const cid = created.character.id;

    const result = await updateCharacter(
      cloudContext(user.id),
      { projectId: project.id, characterId: cid, patch: { name: "Mara Voss" } },
      charRepo,
      hooks(log),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.character.name).toBe("Mara Voss");
    expect(result.character.updatedAt).toBeInstanceOf(Date);
    expect(log).toEqual(["hook:character.update"]);

    // Adapter-level parity pin: no matching row -> null (the handler 404s on it).
    expect(await charRepo.updateScoped(project.id, "no-such-character", { name: "x" })).toBe(null);
  });

  it("handler 404 on a wrong id: no write, no hook", async () => {
    const { user, project, charRepo } = await seed();
    const log: string[] = [];
    const result = await updateCharacter(
      cloudContext(user.id),
      { projectId: project.id, characterId: "no-such-character", patch: { name: "Mara Voss" } },
      charRepo,
      hooks(log),
    );

    expect(result).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(log).toEqual([]);
  });

  it("empty patch — touch only, no canon hook", async () => {
    const { user, project, charRepo } = await seed();
    const created = await createCharacter(
      cloudContext(user.id),
      { projectId: project.id, data: charData() },
      charRepo,
    );
    if (!created.ok) throw new Error("seed failed");
    const log: string[] = [];

    const result = await updateCharacter(
      cloudContext(user.id),
      { projectId: project.id, characterId: created.character.id, patch: {} },
      charRepo,
      hooks(log),
    );

    expect(result.ok).toBe(true);
    expect(log).toEqual([]);
  });

  it("delete — scoped delete is idempotent, hook fires each call, real row vanishes", async () => {
    const { handle, user, project, charRepo } = await seed();
    const created = await createCharacter(
      cloudContext(user.id),
      { projectId: project.id, data: charData() },
      charRepo,
    );
    if (!created.ok) throw new Error("seed failed");
    const cid = created.character.id;
    const log: string[] = [];

    const first = await deleteCharacter(
      cloudContext(user.id),
      { projectId: project.id, characterId: cid },
      charRepo,
      hooks(log),
    );
    const second = await deleteCharacter(
      cloudContext(user.id),
      { projectId: project.id, characterId: cid },
      charRepo,
      hooks(log),
    );

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(log).toEqual(["hook:character.delete", "hook:character.delete"]);
    const left = await handle.db.select().from(characters).where(eq(characters.id, cid));
    expect(left).toEqual([]);
  });
});

describe("createLocation through the real adapter", () => {
  it("happy path — round-trips the patch fields, fires hook:location.create", async () => {
    const log: string[] = [];
    const { user, project, locRepo } = await seed();
    const result = await createLocation(
      cloudContext(user.id),
      { projectId: project.id, data: locData() },
      locRepo,
      hooks(log),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.location.name).toBe("The Old Mill");
    expect(result.location.description).toBe("Abandoned");
    expect(result.location).not.toHaveProperty("embedding");
    expect(log).toEqual(["hook:location.create"]);
  });
});

describe("real-DB-specific — FK cascade + semantic_cache parity", () => {
  it("deleting a project cascades its characters and locations", async () => {
    const { handle, project, charRepo, locRepo } = await seed();
    await charRepo.create(project.id, charData());
    await locRepo.create(project.id, locData());

    await handle.db.delete(projects).where(eq(projects.id, project.id));

    expect(await handle.db.select().from(characters)).toEqual([]);
    expect(await handle.db.select().from(locations)).toEqual([]);
  });

  it("semantic_cache duplicates the pg composite unique: plain insert rejects, onConflictDoNothing tolerates", async () => {
    const { handle } = await seed();
    const row = { cacheType: "typeA", inputKey: "k1", cachedOutput: { ok: true } };
    const [first] = await handle.db.insert(semanticCache).values(row).returning();
    expect(first.id).toMatch(/^[0-9a-f-]{36}$/);

    // Same (cache_type, input_key), different auto id — only the appended
    // composite unique index in sqlite-ddl.ts can reject this. Drizzle wraps
    // the driver error (`Failed query: …`); the real SQLite message is the cause.
    const err = (await handle.db.insert(semanticCache).values(row).catch((e: unknown) => e)) as Error & {
      cause?: { message?: string };
    };
    expect(err).toBeInstanceOf(Error);
    expect(`${err.message}\n${err.cause?.message ?? ""}`).toMatch(/UNIQUE constraint failed/);
    expect(`${err.cause?.message ?? ""}`).toContain("cache_type");
    const again = await handle.db.insert(semanticCache).values(row).onConflictDoNothing().returning();
    expect(again).toEqual([]);
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
      // sqlite layer's legitimate imports are `@/db/sqlite` / `@/db/sqlite-schema` /
      // `@/db/sqlite-ddl`, which these regexes deliberately do not match.
      expect(source, file).not.toMatch(/"@\/db"|'@\/db'|"@\/db\/schema"|'@\/db\/schema'/);
      expect(source, file).not.toMatch(/"next(\/|-auth)?"/);
      expect(source, file).not.toMatch(/@neondatabase\/serverless/);
    }
  }, 20000);
});
