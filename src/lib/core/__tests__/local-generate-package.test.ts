/**
 * Phase 3 §2.5 stage (d) part 2 — `POST /projects/:projectId/production/
 * generate-package` on the loopback transport.
 *
 * Driven through a REAL listening host (the same open-socket discipline as
 * local-host.test.ts / local-run-plan.test.ts — no mocked transport), with
 * seeded REAL sqlite rows wherever the write half writes and a STUB Director
 * provider (the port IS the composition root's seam — the Anthropic client
 * stays cloud-owned, and the stage brief tests the write half + the mount's
 * local formatting only):
 *
 *  - the route 501s in the default surface (OFF until `generatePackage` is
 *    planted), mirroring `generation`/`runPlan`;
 *  - success twins the cloud route's write half exactly: a verbatim payload
 *    (`{brief, characterSheets, locationSheets, shotCount}`), the sheet→row
 *    creations (the routes' exact 4/3 allowlist-subset fields, existing names
 *    skipped and a same-name sheet pair deduped by the map short-circuit), the
 *    chapter/character id resolutions (title keys lowercased: "CHAPTER ONE"
 *    resolves like the route's toLowerCase map), every `??` default applied,
 *    the multiShotScript attach per sceneNumber, the fresh-slate wipe of the
 *    pre-seeded stale shot row, and sortOrder faithful to the package's
 *    array positions;
 *  - ownership is through `findOwned` against §5.6's `localOwnerId`
 *    convention (the loopback actor is NOT a users row — the bundle carries
 *    the one users-row id); a wrong `localOwnerId` 404s the owner's own
 *    project, and NO refused path pages the provider (no spend, no writes);
 *  - the hook-census parity is pinned behaviorally: after a full successful
 *    run the project's `contentRevision` is STILL null — the cloud route
 *    bumps no revisions, so the local twin invents none;
 *  - refusals: a package without `shots` → the route's exact 500 body with
 *    NOTHING written (the gate runs before the wipe), a provider failure →
 *    verbatim passthrough (the meter-response analog), `stream: true` → the
 *    stage-(a) non-streaming 400, scope mismatch → 403 BEFORE the port.
 */

import { describe, it, expect, afterAll } from "vitest";
import { eq } from "drizzle-orm";

import {
  createLocalHostServer,
  defaultLocalRoutes,
  dispatchLoopback,
  type DefaultRouteDeps,
  type LocalHost,
} from "@/lib/core/local-host";
import type {
  DirectorPackage,
  DirectorPackagePort,
} from "@/lib/core/handlers/generate-package";
import { makeSqliteProjectRepository } from "@/lib/core/sqlite-repositories";
import {
  makeSqliteCharacterCrudRepository,
  makeSqliteLocationCrudRepository,
} from "@/lib/core/sqlite-character-location-repos";
import { makeSqliteGeneratePackageWriteSeams } from "@/lib/core/sqlite-generate-package-repos";
import { createSqliteDb, type SqliteDbHandle } from "@/db/sqlite";
import {
  characters,
  chapters,
  locations,
  productionShots,
  projects,
  users,
} from "@/db/sqlite-schema";

const ownedServers: LocalHost[] = [];
const created: SqliteDbHandle[] = [];
afterAll(async () => {
  await Promise.all(ownedServers.map((s) => s.close().catch(() => undefined)));
  for (const h of created) h.sqlite.close();
  created.length = 0;
});

const minimalRepos = (): Partial<DefaultRouteDeps> => ({
  chapterRepo: {
    ownsProject: async () => true,
    updateScoped: async () => null,
    deleteScoped: async () => undefined,
  },
  storyBibleRepo: {
    ownsProject: async () => true,
    readSections: async () => ({}),
  },
  storyTransactionRepo: {
    ownsProject: async () => true,
    record: async () => undefined,
    applyChanges: async () => undefined,
  },
});

// -------------------------------------------------------------- the fixture
// A realistic Director package — the parsed shape, exactly what the port
// contract carries (the cloud route's safeParseJson output class).

const BRIEF = {
  title: "The Signal",
  logline: "One sentence.",
  format: "Novel",
  genres: ["thriller"],
  tone: "tense",
  styleNotes: "photoreal",
};

const OPTIONS_PKG: DirectorPackage = {
  brief: BRIEF,
  // "Ada" exists → skipped, never overwritten; "Boone" twice → ONE row (the
  // route's map short-circuit dedupes same-name sheets mid-package).
  characterSheets: [
    { name: "Ada", role: "Protagonist", soulIdPrompt: "ADA LOCK", voiceNotes: "ADA VOICE" },
    { name: "Boone", role: "Engineer", soulIdPrompt: "BOONE LOCK one", voiceNotes: "BOONE VOICE" },
    { name: "Boone", soulIdPrompt: "BOONE LOCK two", voiceNotes: "second sheet" },
  ],
  locationSheets: [
    { name: "The Studio", visualDescription: "STUDIO LOCK", moodKeywords: ["cold"] },
    { name: "The Receiving Bay", visualDescription: "BAY LOCK", moodKeywords: ["fluorescent", "damp"] },
  ],
  scenes: [
    { sceneNumber: 1, multiShotScript: "Shot 1: Ada at the console. Shot 2: wide." },
    { sceneNumber: 2, multiShotScript: "Shot 3: the bay door." },
  ],
  shots: [
    {
      sceneNumber: 1,
      chapterTitle: "CHAPTER ONE", // resolves via the lowercase title key
      shotNumber: 1,
      shotType: "Medium shot",
      subject: "Ada at the console",
      action: "types a frantic burst",
      location: "The Studio",
      mood: "tense",
      primaryCharacterName: "Ada",
      soulPrompt: "ADA LOCK types",
      videoPrompt: "slow push",
      dialogue: "Hold on",
      speaker: "Ada",
    },
    {
      // Minimal shot: everything absent takes the route's ?? defaults.
      sceneNumber: 1,
      chapterTitle: "Ghost Chapter", // no such title → chapterId null
      shotNumber: 2,
      subject: "wide of the room",
      primaryCharacterName: "Boone",
    },
    {
      sceneNumber: 2,
      shotNumber: 1,
      subject: "the bay door",
      primaryCharacterName: "Unseen Entity", // resolves to nothing → null
    },
  ],
};

type DirectorScript = { pkg: DirectorPackage } | { ok: false; status: number; reason: string };

type BundleShape = NonNullable<DefaultRouteDeps["generatePackage"]>;

interface Boot {
  host: LocalHost;
  handle: SqliteDbHandle;
  ownerId: string;
  calls: [string, string][];
}

/** The stub provider: records (projectId, localOwnerId) call receipts. */
function stubDirector(
  script: DirectorScript | undefined,
  calls: [string, string][],
): DirectorPackagePort {
  return async (args) => {
    calls.push([args.projectId, args.localOwnerId]);
    if (script && "ok" in script && script.ok === false) return script;
    return { ok: true, pkg: script && "pkg" in script ? script.pkg : {} };
  };
}

/** Seed user + project + the pre-existing rows the write half resolves against. */
async function seed(handle: SqliteDbHandle): Promise<string> {
  const [owner] = await handle.db.insert(users).values({ email: "u1@test.dev" }).returning();
  await handle.db.insert(projects).values({ id: "proj-1", userId: owner.id, format: "Novel" });
  await handle.db.insert(characters).values({ id: "ch-ada", projectId: "proj-1", name: "Ada" });
  await handle.db
    .insert(locations)
    .values({ id: "loc-studio", projectId: "proj-1", name: "The Studio", description: "old desc" });
  await handle.db
    .insert(chapters)
    .values({ id: "chap-1", projectId: "proj-1", title: "Chapter One" });
  // A stale shot row from a previous package run: proves the fresh-slate wipe.
  await handle.db
    .insert(productionShots)
    .values({ id: "shot-stale", projectId: "proj-1", subject: "stale" });
  return owner.id;
}

/**
 * Boot a host around a real in-memory sqlite db. Without `script`/`bundle`
 * options the bundle is fully assembled ( sqlite adapters + the recording stub
 * provider); `bundle: null` plants nothing (the 501 default surface); `script`
 * swaps the provider's canned outcome.
 */
async function boot(
  opts: {
    bundle?: Partial<BundleShape> | null;
    script?: DirectorScript;
  } = {},
): Promise<Boot> {
  const handle = createSqliteDb(":memory:");
  created.push(handle);
  const ownerId = await seed(handle);

  const calls: [string, string][] = [];
  const bundle =
    opts.bundle === null
      ? null
      : ({
          projectRepository: makeSqliteProjectRepository(handle.db),
          localOwnerId: ownerId,
          characterRepo: makeSqliteCharacterCrudRepository(handle.db),
          locationRepo: makeSqliteLocationCrudRepository(handle.db),
          ...makeSqliteGeneratePackageWriteSeams(handle.db),
          directorPackage: stubDirector(opts.script, calls),
          ...(opts.bundle ?? {}),
        } as BundleShape);

  const routes = defaultLocalRoutes({
    ...minimalRepos(),
    ...(bundle ? { generatePackage: bundle } : {}),
  } as DefaultRouteDeps);
  const host = await createLocalHostServer({ routes });
  ownedServers.push(host);
  return { host, handle, ownerId, calls };
}

function post(host: LocalHost, path: string, body: unknown): Promise<Response> {
  return fetch(`${host.origin}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${host.token}`, "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

const NOT_CONFIGURED = {
  ok: false,
  status: 501,
  reason: "The Director package surface is not configured for this host.",
} as const;
const ANALYZE_FAILED = {
  ok: false,
  status: 500,
  reason: "Failed to analyze story. Try adding chapter content first.",
} as const;

describe("POST /projects/:projectId/production/generate-package — the stage-(d) part 2 mount", () => {
  it("501s before anything when the composition plants no generate-package bundle", async () => {
    const { host } = await boot({ bundle: null });
    const res = await post(host, "/projects/proj-1/production/generate-package", {});
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual(NOT_CONFIGURED);
  });

  it("twins the cloud write half: verbatim payload, sheet→rows, id resolutions, defaults, fresh slate, dedupe", async () => {
    const { host, handle, ownerId, calls } = await boot({ script: { pkg: OPTIONS_PKG } });
    const res = await post(host, "/projects/proj-1/production/generate-package", {});
    expect(res.status).toBe(200);

    // The payload verbatim — the same body `NextResponse.json(result.payload)`
    // produced (a local client cannot tell the hosts apart).
    expect(await res.json()).toEqual({
      brief: BRIEF,
      characterSheets: OPTIONS_PKG.characterSheets,
      locationSheets: OPTIONS_PKG.locationSheets,
      shotCount: 3,
    });

    // The provider got the bundle's ids (its only inputs, per §5.6).
    expect(calls).toEqual([["proj-1", ownerId]]);

    // --- shots: fresh slate (the stale row is GONE) + three seeded rows.
    const shots = await handle.db.select().from(productionShots);
    expect(shots).toHaveLength(3);
    expect(shots.map((s) => s.id)).not.toContain("shot-stale");
    const bySubject = new Map(shots.map((s) => [s.subject, s] as const));
    const consoleShot = bySubject.get("Ada at the console")!;
    const booneShot = bySubject.get("wide of the room")!;
    const bayShot = bySubject.get("the bay door")!;
    expect(consoleShot).toBeDefined();
    expect(booneShot).toBeDefined();
    expect(bayShot).toBeDefined();

    const boone = await handle.db
      .select()
      .from(characters)
      .where(eq(characters.name, "Boone"));
    expect(boone).toHaveLength(1);

    // Resolutions: lowercased chapterTitle → the existing chapter's id; existing
    // character name → its row; unknown name → null; sceneNumber → its script.
    expect(consoleShot.chapterId).toBe("chap-1");
    expect(consoleShot.primaryCharacterId).toBe("ch-ada");
    expect(consoleShot.multiShotScript).toBe("Shot 1: Ada at the console. Shot 2: wide.");
    expect(consoleShot.dialogue).toBe("Hold on");
    expect(consoleShot.sortOrder).toBe(0);
    expect(booneShot.chapterId).toBeNull(); // "Ghost Chapter" resolves to nothing
    expect(booneShot.primaryCharacterId).toBe(boone[0]!.id);
    // The route's ?? defaults, verbatim, for everything the shot omitted.
    expect(booneShot.subject).toBe("wide of the room");
    expect(booneShot.cameraMovement).toBe("Static");
    expect(booneShot.lightingMood).toBe("Golden hour");
    expect(booneShot.timeOfDay).toBe("Afternoon");
    expect(booneShot.action).toBe("");
    expect(booneShot.location).toBe("");
    expect(booneShot.mood).toBe("");
    expect(booneShot.soulPrompt).toBe("");
    expect(booneShot.videoPrompt).toBe("");
    expect(booneShot.dialogue).toBe("");
    expect(booneShot.speaker).toBe("");
    expect(booneShot.multiShotScript).toBe("Shot 1: Ada at the console. Shot 2: wide.");
    expect(booneShot.sortOrder).toBe(1);
    expect(bayShot.primaryCharacterId).toBeNull();
    expect(bayShot.multiShotScript).toBe("Shot 3: the bay door.");
    expect(bayShot.sortOrder).toBe(2);

    // --- characters: new rows created with the route's exact 4-field mapping.
    expect(boone[0]!.role).toBe("Engineer");
    expect(boone[0]!.appearance).toBe("BOONE LOCK one");
    expect(boone[0]!.speechPattern).toBe("BOONE VOICE");
    // The pre-existing "Ada" is never duplicated nor overwritten by its sheet.
    const adas = await handle.db
      .select()
      .from(characters)
      .where(eq(characters.name, "Ada"));
    expect(adas).toHaveLength(1);
    expect(adas[0]!.id).toBe("ch-ada");
    expect(adas[0]!.role).toBe("");

    // --- locations: new row with the moodKeywords join; existing untouched.
    const bays = await handle.db
      .select()
      .from(locations)
      .where(eq(locations.name, "The Receiving Bay"));
    expect(bays).toHaveLength(1);
    expect(bays[0]!.description).toBe("BAY LOCK");
    expect(bays[0]!.atmosphere).toBe("fluorescent, damp");
    const studios = await handle.db
      .select()
      .from(locations)
      .where(eq(locations.name, "The Studio"));
    expect(studios).toHaveLength(1);
    expect(studios[0]!.description).toBe("old desc");

    // --- hook-census parity: the cloud route bumps NO revisions, so the §11
    // counter stays untouched through a fully successful write pass.
    const [proj] = await handle.db
      .select()
      .from(projects)
      .where(eq(projects.id, "proj-1"));
    expect(proj!.contentRevision).toBeNull();
  });

  it("the package gate runs BEFORE any write: no shots → the route's exact 500 and NOTHING wiped", async () => {
    const { host, handle, calls } = await boot({ script: { pkg: { brief: { title: "x" } } } });
    const res = await post(host, "/projects/proj-1/production/generate-package", {});
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual(ANALYZE_FAILED);
    // The provider WAS called (this is post-Director), but the write half
    // never started: the pre-existing stale shot row survives the gate, and no
    // sheet row was created.
    expect(calls).toHaveLength(1);
    const stale = await handle.db
      .select()
      .from(productionShots)
      .where(eq(productionShots.id, "shot-stale"));
    expect(stale).toHaveLength(1);
    const allChars = await handle.db.select().from(characters);
    expect(allChars.map((c) => c.name)).toEqual(["Ada"]);
  });

  it("a provider failure passes through VERBATIM (the meter-response analog) and writes nothing", async () => {
    const refusal: DirectorScript = { ok: false, status: 429, reason: "the provider said no" };
    const { host, handle, calls } = await boot({ script: refusal });
    const res = await post(host, "/projects/proj-1/production/generate-package", {});
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, status: 429, reason: "the provider said no" });
    expect(calls).toHaveLength(1);
    const stale = await handle.db
      .select()
      .from(productionShots)
      .where(eq(productionShots.id, "shot-stale"));
    expect(stale).toHaveLength(1);
  });

  it("a WRONG localOwnerId 404s the owner's own project and pages NOTHING (no spend, no writes)", async () => {
    const { host, handle, calls } = await boot({
      bundle: { localOwnerId: "no-such-user" },
      script: { pkg: OPTIONS_PKG },
    });
    const res = await post(host, "/projects/proj-1/production/generate-package", {});
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(calls).toEqual([]);
    // Not even the fresh-slate wipe runs on an unauthorized caller.
    const stale = await handle.db
      .select()
      .from(productionShots)
      .where(eq(productionShots.id, "shot-stale"));
    expect(stale).toHaveLength(1);
  });

  it("a stranger project 404s without paging the provider", async () => {
    const { host, calls } = await boot({ script: { pkg: OPTIONS_PKG } });
    const res = await post(host, "/projects/no-such-proj/production/generate-package", {});
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, status: 404, reason: "Not found" });
    expect(calls).toEqual([]);
  });

  it("stream:true is refused BEFORE the bundle with the stage-(a) 400 (§5.4 deferral is explicit)", async () => {
    const { host, calls } = await boot({ script: { pkg: OPTIONS_PKG } });
    const res = await post(host, "/projects/proj-1/production/generate-package", { stream: true });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      status: 400,
      reason: "Streaming is not supported on the local host.",
    });
    expect(calls).toEqual([]);
  });

  it("a projectScope mismatch 403s BEFORE any port verb (asserted through dispatchLoopback — the wire-level ctx carries no scope)", async () => {
    const { host, handle, ownerId } = await boot({ script: { pkg: OPTIONS_PKG } });
    // The dispatch route set carries the SAME real bundle over the SAME sqlite
    // handle (no throwaway adapter) — only the ctx's projectScope differs.
    const outcome = await dispatchLoopback(
      {
        method: "POST",
        path: "/projects/proj-1/production/generate-package",
        headers: { authorization: `Bearer ${host.token}`, origin: null },
        body: null,
      },
      {
        expectedToken: host.token,
        routes: defaultLocalRoutes({
          ...minimalRepos(),
          generatePackage: {
            projectRepository: makeSqliteProjectRepository(handle.db),
            localOwnerId: ownerId,
            characterRepo: makeSqliteCharacterCrudRepository(handle.db),
            locationRepo: makeSqliteLocationCrudRepository(handle.db),
            ...makeSqliteGeneratePackageWriteSeams(handle.db),
            directorPackage: async () => ({ ok: true, pkg: OPTIONS_PKG }),
          } as BundleShape,
        } as DefaultRouteDeps),
        projectScope: "other-project",
      },
    );
    expect(outcome.status).toBe(403);
    expect(outcome.body).toEqual({
      ok: false,
      status: 403,
      reason: "Context is not scoped to this project.",
    });
  });
});
