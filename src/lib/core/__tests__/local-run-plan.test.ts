/**
 * Phase 3 §2.5 stage (d) — `POST /projects/:projectId/graph/run-plan` on the
 * loopback transport.
 *
 * Driven through a REAL listening host (the same open-socket discipline as
 * local-host.test.ts / local-generate.test.ts — no mocked transport):
 *
 *  - the route 501s in the default surface (OFF until `runPlan` is planted);
 *  - with a planted bundle the preflight is PURE (the cloud route's own
 *    contract): ownership through `findOwned` against the §5.6 `localOwnerId`
 *    convention (the bundle carries ONE users-row id; the loopback actor is
 *    NOT one, so the bundle must carry it — a wrong localOwnerId 404s the
 *    owner's own project, the adversarial pin), `{ plan }` for a
 *    capabilityId (cost × nodeIds, requiresConfirm intact), `{ options }`
 *    for a selection, "Unknown capability" → 400;
 *  - profile-derived provider availability gates the preflight (no segmind
 *    key → unavailable), and the PROJECT ROW's format flows through verbatim;
 *  - refusals page nothing: stranger project → 404 over the socket; a
 *    `projectScope` mismatch → 403 BEFORE any verb (asserted via
 *    `dispatchLoopback`, since the wire-level ctx carries no scope).
 */

import { describe, it, expect, afterAll } from "vitest";

import {
  createLocalHostServer,
  defaultLocalRoutes,
  dispatchLoopback,
  type DefaultRouteDeps,
  type LocalHost,
} from "@/lib/core/local-host";
import { makeSqliteProjectRepository } from "@/lib/core/sqlite-repositories";
import { createSqliteDb, type SqliteDbHandle } from "@/db/sqlite";
import { projects, users } from "@/db/sqlite-schema";

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

/** Seed user + two Novel-format projects on a real in-memory db; boot a host. */
async function boot(
  runPlan?: Partial<NonNullable<DefaultRouteDeps["runPlan"]>> | null,
): Promise<{ host: LocalHost; handle: SqliteDbHandle; ownerId: string }> {
  const handle = createSqliteDb(":memory:");
  created.push(handle);
  const [user] = await handle.db.insert(users).values({ email: "u1@test.dev" }).returning();
  await handle.db
    .insert(projects)
    .values({ id: "proj-1", userId: user.id, format: "Novel" });
  await handle.db.insert(projects).values({ id: "other-proj", userId: user.id, format: "Novel" });

  const bundle =
    runPlan === null
      ? null
      : ({
          projectRepository: makeSqliteProjectRepository(handle.db),
          localOwnerId: user.id,
          tier: "all_access",
          hasSegmindKey: true,
          hasOpenAIKey: false,
          ...(runPlan ?? {}),
        } as NonNullable<DefaultRouteDeps["runPlan"]>);
  const routes = defaultLocalRoutes({
    ...minimalRepos(),
    ...(bundle ? { runPlan: bundle } : {}),
  } as DefaultRouteDeps);
  const host = await createLocalHostServer({ routes });
  ownedServers.push(host);
  return { host, handle, ownerId: user.id };
}

function post(host: LocalHost, path: string, body: unknown): Promise<Response> {
  return fetch(`${host.origin}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${host.token}`, "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

describe("POST /projects/:projectId/graph/run-plan — the stage-(d) mount", () => {
  it("501s before anything when the composition plants no run-plan bundle", async () => {
    const { host } = await boot(null);
    const res = await post(host, "/projects/proj-1/graph/run-plan", { kinds: ["chapter"] });
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({
      ok: false,
      status: 501,
      reason: "The run-plan preflight is not configured for this host.",
    });
  });

  it("a planted bundle preflights with the profile context: one capabilityId → one plan (cost × nodeIds, requiresConfirm intact)", async () => {
    const { host } = await boot();
    const res = await post(host, "/projects/proj-1/graph/run-plan", {
      capabilityId: "comic_generate",
      nodeIds: ["c1", "c2"],
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { plan: Record<string, unknown> };
    expect(body.plan.capabilityId).toBe("comic_generate");
    expect(body.plan.available).toBe(true);
    expect(body.plan.requiresConfirm).toBe(true);
    expect(body.plan.costUsd).toBeCloseTo(0.58, 5);
  });

  it("without a capabilityId it enumerates the runnable capabilities for the selection (the chapter ladder, incl. comic_generate + refine + beta_read)", async () => {
    const { host } = await boot();
    const res = await post(host, "/projects/proj-1/graph/run-plan", {
      kinds: ["chapter"],
      nodeIds: ["c1"],
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { options: { capabilityId: string }[] };
    const ids = body.options.map((o) => o.capabilityId);
    expect(ids).toContain("comic_generate");
    expect(ids).toContain("refine");
    expect(ids).toContain("beta_read");
  });

  it("the profile's key PRESENCE gates availability (no segmind key → comic_generate unavailable)", async () => {
    const { host } = await boot({ hasSegmindKey: false });
    const res = await post(host, "/projects/proj-1/graph/run-plan", {
      capabilityId: "comic_generate",
      nodeIds: ["c1"],
    });
    const body = (await res.json()) as { plan: { available: boolean } };
    expect(body.plan.available).toBe(false);
  });

  it("a WRONG localOwnerId 404s the owner's own project — the ownership predicate is real, not theater", async () => {
    const { host } = await boot({ localOwnerId: "no-such-user" });
    const res = await post(host, "/projects/proj-1/graph/run-plan", {
      capabilityId: "comic_generate",
      nodeIds: ["c1"],
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, status: 404, reason: "Not found" });
  });

  it("unknown-capability → 400; stranger project → 404 pages nothing (over the socket)", async () => {
    const { host } = await boot();
    const unknown = await post(host, "/projects/proj-1/graph/run-plan", {
      capabilityId: "nope",
      nodeIds: [],
    });
    expect(unknown.status).toBe(400);

    const stranger = await post(host, "/projects/no-such-proj/graph/run-plan", {
      kinds: ["chapter"],
    });
    expect(stranger.status).toBe(404);
    expect(await stranger.json()).toEqual({ ok: false, status: 404, reason: "Not found" });
  });

  it("a projectScope mismatch 403s BEFORE the port pages any verb (asserted through dispatchLoopback — the wire-level ctx carries no scope)", async () => {
    const { host, handle } = await boot();
    const [user] = await Promise.all([
      handle.db.select().from(users),
    ]);
    const routes = defaultLocalRoutes({
      ...minimalRepos(),
      runPlan: {
        projectRepository: makeSqliteProjectRepository(handle.db),
        localOwnerId: user[0]!.id,
        tier: "all_access",
        hasSegmindKey: true,
        hasOpenAIKey: false,
      },
    } as DefaultRouteDeps);
    const result = await dispatchLoopback(
      {
        method: "POST",
        path: "/projects/proj-1/graph/run-plan",
        headers: { authorization: `Bearer ${host.token}`, origin: null },
        body: null,
      },
      {
        expectedToken: host.token,
        routes,
        projectScope: "other-project",
      },
    );
    expect(result.status).toBe(403);
    expect(result.body).toEqual({
      ok: false,
      status: 403,
      reason: "Context is not scoped to this project.",
    });
  });
});
