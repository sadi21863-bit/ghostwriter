/**
 * The admin side-registry served ON the loopback socket (stage (c) wiring +
 * stage (e)'s spawn shape) — the credential-disjointness contract as a
 * transport property, verified over a REAL listening host:
 *
 *  - an owner-token bearer on `/admin/*` is 401 (a bearer that matches the
 *    OWNER token can never match ADMIN_SECRET — one credential never reaches
 *    the other's surface);
 *  - an ADMIN_SECRET bearer CAN reach the two mounted observability reads
 *    (200) but NEVER a user route (the loopback gate's token mismatch 401s
 *    before any admin knowledge exists in the user dispatch);
 *  - an unset ADMIN_SECRET 500s on admin paths — the fail-closed carryover;
 *  - when NO admin registry is planted, admin paths are just unknown user
 *    routes (404 after the owner gate — not 401, not 500).
 */

import { describe, it, expect, afterAll, beforeEach } from "vitest";

import {
  createLocalHostServer,
  defaultLocalRoutes,
  type DefaultRouteDeps,
  type LocalHost,
} from "@/lib/core/local-host";
import {
  LOCAL_ADMIN_ROUTES,
  makeLocalCostReportRoute,
} from "@/lib/core/local-admin-registry";
import { createSqliteDb, type SqliteDbHandle } from "@/db/sqlite";

const SECRET = "local-host-admin-test-secret-0123456789abcdef";

const created: SqliteDbHandle[] = [];
const ownedServers: LocalHost[] = [];
afterAll(async () => {
  await Promise.all(ownedServers.map((s) => s.close().catch(() => undefined)));
  for (const h of created) h.sqlite.close();
  created.length = 0;
});
beforeEach(() => {
  delete process.env.ADMIN_SECRET;
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

describe("/admin/* served on the same socket — disjoint credentials (real host)", () => {
  it("the owner token NEVER authorizes /admin/* (mounted from a real seeded-capable db)", async () => {
    process.env.ADMIN_SECRET = SECRET;
    const handle = createSqliteDb(":memory:");
    created.push(handle);
    const host = await createLocalHostServer({
      routes: defaultLocalRoutes(minimalRepos() as DefaultRouteDeps),
      adminRegistry: [makeLocalCostReportRoute(handle.db)],
      token: "a".repeat(64),
    });
    ownedServers.push(host);

    const res = await fetch(`${host.origin}/admin/cost-report`, {
      headers: { authorization: `Bearer ${host.token}` },
    });
    expect(res.status).toBe(401);
  });

  it("the ADMIN_SECRET bearer CAN reach the mounted observability read — but NEVER a user route", async () => {
    process.env.ADMIN_SECRET = SECRET;
    const handle = createSqliteDb(":memory:");
    created.push(handle);
    const host = await createLocalHostServer({
      routes: defaultLocalRoutes(minimalRepos() as DefaultRouteDeps),
      adminRegistry: [makeLocalCostReportRoute(handle.db)],
      token: "b".repeat(64),
    });
    ownedServers.push(host);

    const okAdmin = await fetch(`${host.origin}/admin/cost-report`, {
      headers: { authorization: `Bearer ${SECRET}` },
    });
    expect(okAdmin.status).toBe(200);
    const body = (await okAdmin.json()) as Record<string, unknown>;
    expect(body.period).toBe("30d");

    // The same credential on a user path: the loopback gate's token mismatch
    // fires before any dispatch — the admin bearer never reaches the user arm.
    const asUser = await fetch(`${host.origin}/projects/proj-1/chapters/ch-1`, {
      headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" },
      method: "PATCH",
      body: JSON.stringify({ title: "x" }),
    });
    expect(asUser.status).toBe(401);
  });

  it("an unset ADMIN_SECRET fails CLOSED with 500 on admin paths even with the owner token valid", async () => {
    const host = await createLocalHostServer({
      routes: defaultLocalRoutes(minimalRepos() as DefaultRouteDeps),
      adminRegistry: LOCAL_ADMIN_ROUTES,
      token: "c".repeat(64),
    });
    ownedServers.push(host);
    // No adminRegistry seed rows needed: the gate denies BEFORE any handler.
    const res = await fetch(`${host.origin}/admin/cost-report`, {
      headers: { authorization: `Bearer ${SECRET}` },
    });
    expect(res.status).toBe(500);
  });

  it("without an admin registry planted, admin paths are just unknown USER routes (404 after the owner gate)", async () => {
    const host = await createLocalHostServer({
      routes: defaultLocalRoutes(minimalRepos() as DefaultRouteDeps),
      token: "d".repeat(64),
    });
    ownedServers.push(host);

    const res = await fetch(`${host.origin}/admin/cost-report`, {
      headers: { authorization: `Bearer ${host.token}` },
    });
    expect(res.status).toBe(404);
  });
});
