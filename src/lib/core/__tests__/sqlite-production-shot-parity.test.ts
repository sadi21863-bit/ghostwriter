import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";

import { createSqliteDb, type SqliteDbHandle } from "@/db/sqlite";
import { SQLITE_DDL } from "@/db/sqlite-ddl";
import {
  characters,
  chapters,
  productionShots,
  projects,
  users,
} from "@/db/sqlite-schema";
import { cloudContext } from "@/lib/core/request-context";
import type { PostCommitHooks } from "@/lib/core/repositories";
import {
  listProductionShots,
  updateProductionShot,
  type ProductionShotCrudRepository,
} from "@/lib/core/handlers/production-shots";
import { makeSqliteProductionShotCrudRepository } from "@/lib/core/sqlite-production-shot-repos";

/**
 * The production-shot slice of the sqlite tracer's real-DB parity suite
 * (docs/migration/phase3-prep.md §4): the same handlers as
 * `production-shots handler` tests, driven against a real node:sqlite database
 * through the sqlite-proxy drizzle baseline — no mocks for reachability
 * questions. Covers the REAL verb surface (ownsProject/list/findById/
 * updateScoped — the port has no create verb; rows are seeded by
 * generate-package/preview-all at the route edge, or here by raw inserts),
 * the list ordering + the `primaryCharacter` sibling attach, the scoped
 * find-by-id, the PATCH-path update semantics (jsonb candidatePreviewUrls
 * TEXT round-trip, reals, Date stamps), the 403/404 orderings through the
 * real handlers, and the DB-specific cases the contract mock cannot express
 * (FK cascade, FK set-null on the character reference, FK-refused bogus
 * primaryCharacterId, DDL presence).
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
 * Seed one user + project (+ one alien project for cross-project scoping) and
 * a shot fixture whose ids/ordering/dates are all hand-set so assertions are
 * deterministic. Two characters belong to the owned project (one is a real
 * primaryCharacter target; one belongs to the alien project to pin the
 * attach's by-id-not-by-project read). Returns the repo wired to that db.
 */
async function seed() {
  const handle = fresh();
  const [user] = await handle.db.insert(users).values({ email: "u1@test.dev" }).returning();
  const [alienUser] = await handle.db.insert(users).values({ email: "u2@test.dev" }).returning();
  const [project] = await handle.db.insert(projects).values({ userId: user.id }).returning();
  const [alien] = await handle.db.insert(projects).values({ userId: alienUser.id }).returning();

  const [ownChar] = await handle.db
    .insert(characters)
    .values({ id: "c-own", projectId: project.id, name: "Mara" })
    .returning();
  const [alienChar] = await handle.db
    .insert(characters)
    .values({ id: "c-alien", projectId: alien.id, name: "Outsider" })
    .returning();

  await handle.db.insert(chapters).values({ id: "ch-1", projectId: project.id, title: "ch1" });

  // Insert order is the scrambled order; the adapter must return list()
  // ordered (sceneNumber, shotNumber) — the pre-migration GET's exact order.
  const [shotB] = await handle.db
    .insert(productionShots)
    .values({
      id: "shot-b",
      projectId: project.id,
      chapterId: "ch-1",
      sceneNumber: 1,
      shotNumber: 2,
      subject: "wide alley",
      primaryCharacterId: "c-own",
    })
    .returning();
  const [shotA] = await handle.db
    .insert(productionShots)
    .values({
      id: "shot-a",
      projectId: project.id,
      sceneNumber: 1,
      shotNumber: 1,
      subject: "dome establishing",
      mood: "radioactive beige",
    })
    .returning();
  const [shotC] = await handle.db
    .insert(productionShots)
    .values({
      id: "shot-c",
      projectId: project.id,
      sceneNumber: 2,
      shotNumber: 10,
      subject: "close on hands",
    })
    .returning();
  await handle.db.insert(productionShots).values({
    id: "shot-alien",
    projectId: alien.id,
    sceneNumber: 1,
    shotNumber: 1,
  });

  return {
    handle,
    db: handle.db,
    user,
    project,
    alien,
    ownChar,
    alienChar,
    shots: { a: shotA, b: shotB },
    repo: makeSqliteProductionShotCrudRepository(handle.db),
  };
}

describe("list through the real adapter — the exact GET body", () => {
  it("ordered (sceneNumber, shotNumber) — NOT insertion order and NOT (sortOrder, shotNumber) — with primaryCharacter attached under pg's relation field name", async () => {
    const { project, ownChar, repo } = await seed();

    const shots = await repo.list(project.id);

    expect(shots.map((s) => s.id)).toEqual(["shot-a", "shot-b", "shot-c"]);
    // The relation attach — full character row under `primaryCharacter`,
    // exactly what pg's relational read emitted. Field presence pins:
    const withChar = shots[1]! as Record<string, unknown>;
    expect(withChar.primaryCharacter).toEqual({
      ...ownChar,
      id: "c-own",
      name: "Mara",
    });
    expect(Object.keys(withChar)).toContain("primaryCharacter");
    expect((shots[0] as Record<string, unknown>).primaryCharacter).toBeNull();
    expect((shots[2] as Record<string, unknown>).primaryCharacter).toBeNull();
  });

  it("every shot belongs to exactly one project — the alien project's shot never arrives here (scope predicate)", async () => {
    const { project, repo } = await seed();
    const alienShot = await repo.findById(project.id, "shot-alien");
    expect(alienShot).toBeNull();
    const list = await repo.list(project.id);
    expect(list.map((s) => s.id)).not.toContain("shot-alien");
  });
});

describe("findById / updateScoped — the PATCH-path verbs", () => {
  it("scoped find: own shot found, cross-project shotId is a silent null (IDOR kept verbatim — no projectLeak)", async () => {
    const { project, repo } = await seed();
    expect((await repo.findById(project.id, "shot-b"))!.id).toBe("shot-b");
    expect(await repo.findById("no-such-project", "shot-b")).toBeNull();
  });

  it("updateScoped returns the full updated row: candidatePreviewUrls jsonb round-trips TEXT, reals stay reals, updatedAt surfaces an actual Date, scope mismatch pages nothing", async () => {
    const { project, repo } = await seed();

    const updated = await repo.updateScoped(project.id, "shot-c", {
      reviewStatus: "approved",
      candidatePreviewUrls: ["http://img/first", "http://img/second"],
      trimStartSec: 1.5,
      trimEndSec: 2.25,
      sortOrder: 7,
      updatedAt: new Date("2026-10-31T12:00:00.000Z"),
    } as never);
    expect(updated).not.toBeNull();
    const row = updated as Record<string, unknown>;
    expect(row.reviewStatus).toBe("approved");
    // jsonb → TEXT json discipline — the adapter hands drizzle the typed array
    // and reads the typed array back.
    expect(row.candidatePreviewUrls).toEqual(["http://img/first", "http://img/second"]);
    expect(row.trimStartSec).toBe(1.5);
    expect(row.trimEndSec).toBe(2.25);
    expect(row.sortOrder).toBe(7);
    expect(row.updatedAt).toBeInstanceOf(Date);
    expect((row.updatedAt as Date).toISOString()).toBe("2026-10-31T12:00:00.000Z");

    // No-match (alien project's shot, wrong project scope) pages nothing.
    expect(await repo.updateScoped(project.id, "shot-alien", { subject: "x" } as never)).toBeNull();
    expect(await repo.updateScoped("no-such-project", "shot-c", { subject: "x" } as never)).toBeNull();
  });
});

describe("handler wiring through the real adapter — refusals and hooks", () => {
  it("happy PATCH fires the canonical-mutation hook only after the real write (kind: shot.update); the prompt-rebuild branches run over the sqlite rows too", async () => {
    const log: string[] = [];
    const { user, project, repo } = await seed();

    const result = await updateProductionShot(
      cloudContext(user.id),
      {
        projectId: project.id,
        shotId: "shot-a",
        patch: { subject: "the dome at dusk" },
      },
      repo,
      hooks(log),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // SHOT_PROMPT_PARAM_FIELDS includes subject → soulPrompt/videoPrompt
    // auto-rebuild, with updatedAt LAST (server-owned stamp survives).
    expect(result.shot.subject).toBe("the dome at dusk");
    // soulPrompt = `${merged.subject}. ${merged.action}. ${merged.location}. ${fragment}. Photorealistic portrait quality.` — subject present, empty action/location read as the bare periods.
    expect(String((result.shot as Record<string, unknown>).soulPrompt)).toContain(
      "the dome at dusk. . . medium shot",
    );
    // videoPrompt = `${merged.action}. ${merged.location}. ${fragment}. Cinematic motion.` — by design it NEVER carries the subject (the merge's subject lands only in soulPrompt).
    expect(String((result.shot as Record<string, unknown>).videoPrompt)).toContain(
      "Cinematic motion.",
    );
    expect(log).toEqual(["hook:shot.update"]);

    // 404 refusal (stranger): no write, no additional hook.
    const refused = await updateProductionShot(
      cloudContext("stranger"),
      { projectId: project.id, shotId: "shot-a", patch: { subject: "hijack" } },
      repo,
      hooks(log),
    );
    expect(refused).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(log).toEqual(["hook:shot.update"]);
    const after = await repo.findById(project.id, "shot-a");
    expect(after!.subject).toBe("the dome at dusk");
  });

  it("403/404 orderings on both verbs on real rows — scope mismatch pages no verb, non-owned project reaches ownsProject only; refusal shadows 'Shot not found' behind 'Not found'", async () => {
    const { handle, user, project, repo } = await seed();
    const calls: string[] = [];
    const watched: ProductionShotCrudRepository = {
      ownsProject: async (projectId, actorId) => {
        calls.push("ownsProject");
        return repo.ownsProject(projectId, actorId);
      },
      list: async (projectId) => {
        calls.push("list");
        return repo.list(projectId);
      },
      findById: async (projectId, shotId) => {
        calls.push("findById");
        return repo.findById(projectId, shotId);
      },
      updateScoped: async (projectId, shotId, patch) => {
        calls.push("updateScoped");
        return repo.updateScoped(projectId, shotId, patch);
      },
    };

    const raw = await handle.db.select().from(productionShots);

    // READ: 403 (context scoped elsewhere) pages ZERO verbs (the handler's
    // scope check runs before any repository call); 404 (stranger) pages
    // ownsProject only, before `list`.
    const r403 = await listProductionShots(
      cloudContext(user.id, { projectScope: "other-project" }),
      { projectId: project.id },
      watched,
    );
    const r404 = await listProductionShots(cloudContext("stranger"), { projectId: project.id }, watched);
    expect(r403).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(r404).toEqual({ ok: false, status: 404, reason: "Not found" });

    // PATCH: the same two orderings.
    const patchInput = { projectId: project.id, shotId: "shot-a", patch: { subject: "y" } };
    const u403 = await updateProductionShot(
      cloudContext(user.id, { projectScope: "other-project" }),
      patchInput,
      watched,
    );
    const u404 = await updateProductionShot(cloudContext("stranger"), patchInput, watched);
    expect(u403).toEqual({ ok: false, status: 403, reason: "Context is not scoped to this project." });
    expect(u404).toEqual({ ok: false, status: 404, reason: "Not found" });

    // Only the two 404s reached a verb.
    expect(calls).toEqual(["ownsProject", "ownsProject"]);

    // Exact "Shot not found" refusal: owned project + a bogus shotId reaches
    // ownsProject + findById, then refuses with the PATCH-specific reason.
    const bogus = await updateProductionShot(
      cloudContext(user.id),
      { projectId: project.id, shotId: "shot-nope", patch: { subject: "z" } },
      repo,
    );
    expect(bogus).toEqual({ ok: false, status: 404, reason: "Shot not found" });

    // Promote-branch refusal: a URL that is not a known candidate 400s with the
    // handler's exact reason (business rule over the CURRENT row).
    const promote = await updateProductionShot(
      cloudContext(user.id),
      { projectId: project.id, shotId: "shot-a", patch: {}, promoteCandidateUrl: "http://img/unknown" },
      repo,
    );
    expect(promote).toEqual({ ok: false, status: 400, reason: "Not a known candidate for this shot." });

    const after = await handle.db.select().from(productionShots);
    expect(after.length).toBe(raw.length);
  });
});

describe("real-DB-specific — FK cascade + set-null + declared-baseline pins", () => {
  it("deleting the project cascades every shot; deleting a character SET-NULLs primaryCharacterId on its shots (declared FK, enforced by foreign_keys=ON)", async () => {
    const { handle, project, repo } = await seed();
    await repo.updateScoped(
      project.id,
      "shot-a",
      { primaryCharacterId: "c-own" } as never,
    );
    await handle.db.delete(characters).where(eq(characters.id, "c-own"));
    const afterDelete = await handle.db.select().from(productionShots);
    const shotA = afterDelete.find((s) => s.id === "shot-a")!;
    expect(shotA.primaryCharacterId).toBeNull();

    await handle.db.delete(projects).where(eq(projects.id, project.id));
    // Only the alien project's shot survives this project's delete — its rows
    // are in the same table (a scoped select asserts OUR cascade, not absence).
    const survivors = await handle.db.select().from(productionShots);
    expect(survivors.map((s) => s.id)).toEqual(["shot-alien"]);
  });

  it("a link to a character that does not exist is refused by the FK (foreign_keys=ON reproduces pg's behaviour instead of silently storing an orphan)", async () => {
    const { project, repo } = await seed();
    // The REFUSAL lives at the seeding edge (generate-package inserts through
    // the same drizzle baseline); the adapter's updateScoped exercising the
    // same constraint proves the enforced path locally.
    const err = (await repo
      .updateScoped(project.id, "shot-a", { primaryCharacterId: "ghost-char" } as never)
      .catch((e: unknown) => e)) as Error & { cause?: { message?: string } };
    expect(err).toBeInstanceOf(Error);
    // Drizzle wraps the driver error (`Failed query: …`); the real SQLite
    // message is the cause.
    expect(`${err.message}\n${err.cause?.message ?? ""}`).toMatch(/FOREIGN KEY constraint failed/);
  });

  it("the vendored DDL includes the production_shots table with its candidate + trim columns", () => {
    expect(SQLITE_DDL).toContain('CREATE TABLE "production_shots"');
    expect(SQLITE_DDL).toContain("candidate_preview_urls");
    expect(SQLITE_DDL).toContain("trim_start_sec");
    expect(SQLITE_DDL).toContain("scene_audio_track_url");
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

// Fixtures note: the `list` read is join-free by design (sibling attach), so
// there is deliberately NO fabricated duplicate-column raw-join pin here —
// the pin exists in the files whose reads actually join (relationship's
// setReturnArrays pin). Saying so here instead of inventing a fake join keeps
// the purity suite honest.
