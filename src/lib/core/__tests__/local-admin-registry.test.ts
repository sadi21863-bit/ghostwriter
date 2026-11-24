import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createSqliteDb, type SqliteDbHandle } from "@/db/sqlite";
import { generations, projects, semanticCache, users } from "@/db/sqlite-schema";
import {
  dispatchLocalAdmin,
  makeLocalCacheStatsRoute,
  makeLocalCostReportRoute,
  LOCAL_ADMIN_ROUTES,
  type LocalAdminRoute,
} from "@/lib/core/local-admin-registry";
import { costForTokens } from "@/lib/admin/cost-model";

/**
 * The loopback ADMIN side-registry test (stage (c), §3.3's option (b) —
 * settled §5.2): the bearer gate's fail-closed hierarchy (500 unset BEFORE
 * anything, 401 wrong/absent BEFORE routing), the credential-disjointness
 * pins (an admin path is reachable ONLY via the ADMIN_SECRET bearer, never
 * the owner token), the two observability routes' bodies over a real
 * node:sqlite db seeded with real rows, and the compile-time incompatibility
 * marker (`_kind: "local-admin"`) that keeps the admin registry out of the
 * user-scoped local ROUTES.
 */

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

const SECRET = "local-admin-registry-test-secret-0123456789abcdef";
const okBearer = { method: "GET", path: "/admin/cost-report", authorization: `Bearer ${SECRET}` };
const wrongBearer = { method: "GET", path: "/admin/cost-report", authorization: "Bearer wrong-secret" };
const noBearer = { method: "GET", path: "/admin/cost-report", authorization: null };
const ownerTokenAsBearer = {
  method: "GET",
  path: "/admin/cost-report",
  // The loopback owner token format is a 64-hex random token; presenting it as
  // an admin bearer must NEVER authorize (different environment variable).
  authorization: `Bearer ${"a".repeat(64)}`,
};

async function seed() {
  const handle = fresh();
  const [user] = await handle.db.insert(users).values({ email: "owner@test.dev" }).returning();
  const [alienUser] = await handle.db.insert(users).values({ email: "other@test.dev" }).returning();
  const [project] = await handle.db.insert(projects).values({ userId: user.id }).returning();
  const [alienProject] = await handle.db.insert(projects).values({ userId: alienUser.id }).returning();

  // 1,000,000 sonnet-5 tokens on the owner's project → 3.6 blended USD.
  await handle.db.insert(generations).values({
    projectId: project.id,
    mode: "write",
    prompt: "p",
    output: "o",
    model: "claude-sonnet-5",
    tokensUsed: 1_000_000,
  });
  // 500,000 haiku tokens on the other user's project (cross-user is the point
  // — the aggregate is cross-user BY DESIGN, §3.1).
  await handle.db.insert(generations).values({
    projectId: alienProject.id,
    mode: "write",
    prompt: "p2",
    output: "o2",
    model: "claude-haiku-4-5-20251001",
    tokensUsed: 500_000,
  });

  // Cache rows for the stats route.
  await handle.db.insert(semanticCache).values([
    { cacheType: "static", inputKey: "k1", cachedOutput: { v: 1 }, hitCount: 7 },
    { cacheType: "dynamic", inputKey: "k2", cachedOutput: { v: 2 }, hitCount: 3 },
    { cacheType: "static", inputKey: "k3", cachedOutput: { v: 3 }, hitCount: null },
  ]);

  return {
    handle,
    user,
    alienUser,
    routes: [
      makeLocalCostReportRoute(handle.db),
      makeLocalCacheStatsRoute(handle.db),
    ] as readonly LocalAdminRoute[],
  };
}

describe("the fail-closed credential hierarchy (§3.3 verbatim)", () => {
  beforeEach(() => {
    delete process.env.ADMIN_SECRET;
  });

  it("an unset ADMIN_SECRET fails CLOSED with 500 — even a valid-looking bearer and an unregistered path must never authenticate", async () => {
    const { routes } = await seed();
    const unsetSecret = await dispatchLocalAdmin(
      { ...okBearer, path: "/admin/cost-report" },
      routes,
    );
    expect(unsetSecret.status).toBe(500);

    const notSelfMissing = await dispatchLocalAdmin(
      { method: "GET", path: "/admin/no-such-admin-path", authorization: null },
      routes,
    );
    expect(notSelfMissing.status).toBe(500);
  });

  it("a wrong or absent bearer is 401 BEFORE routing (the caller never learns which admin routes exist)", async () => {
    process.env.ADMIN_SECRET = SECRET;
    const { routes } = await seed();
    for (const bad of [wrongBearer, noBearer, ownerTokenAsBearer]) {
      const res = await dispatchLocalAdmin(bad, routes);
      expect(res.status).toBe(401);
    }
    // AND for a bogus path — the 401 comes before the 404.
    const bogus = await dispatchLocalAdmin(
      { ...wrongBearer, path: "/admin/no-such-admin-path" },
      routes,
    );
    expect(bogus.status).toBe(401);
  });
});

describe("the two mounted observability routes over real rows", () => {
  beforeEach(() => {
    process.env.ADMIN_SECRET = SECRET;
  });

  it("cost-report: the exact cloud shape and blurred-cost math attributed cross-user (both seeded generations count; sonnet-5 @1M tokens = 3.6, haiku @500k = 0.9)", async () => {
    const { routes, user, alienUser } = await seed();
    const res = await dispatchLocalAdmin(okBearer, routes);
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.period).toBe("30d");
    expect(body.since).toBeInstanceOf(Date);
    expect(body.costByModel).toEqual({
      "claude-sonnet-5": { tokens: 1_000_000, costUSD: 3.6 },
      "claude-haiku-4-5-20251001": { tokens: 500_000, costUSD: 0.9 },
    });
    expect(body.totalEstimatedCostUSD).toBe(4.5);
    const topUsers = body.topUsers as { userId: string; costUSD: number }[];
    expect(topUsers.some((u) => u.userId === user.id)).toBe(true);
    expect(topUsers.some((u) => u.userId === alienUser.id)).toBe(true);
    expect((body.topModes as { mode: string; tokens: number }[])[0]).toEqual({
      mode: "write",
      tokens: 1_500_000,
    });
    // The honesty note text survives verbatim (twin'd body, not a rewrite).
    expect(String(body.note)).toMatch(/prompt-caching discounts/);
  });

  it("cache-stats: top entries by hitCount desc, totals across types, null hitCount is 0 in totals", async () => {
    const { routes } = await seed();
    const res = await dispatchLocalAdmin(
      { method: "GET", path: "/admin/cache-stats", authorization: `Bearer ${SECRET}` },
      routes,
    );
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.totalHits).toBe(10);
    expect(body.byType).toEqual({ static: 7, dynamic: 3 });
    const top = body.topEntries as { inputKey: string; hitCount: number | null }[];
    expect(top.length).toBe(3);
    expect(top[0]!.inputKey).toBe("k1");
    expect(top.map((e) => e.hitCount)).toEqual([7, 3, null]);
  });

  it("an unregistered admin path with a VALID bearer is 404 (after the gate)", async () => {
    const { routes } = await seed();
    const res = await dispatchLocalAdmin(
      { method: "GET", path: "/admin/no-such-admin-path", authorization: `Bearer ${SECRET}` },
      routes,
    );
    expect(res.status).toBe(404);
  });

  it("the mounted default registry carries exactly the two settled observability routes with their compile-time marker", () => {
    expect(LOCAL_ADMIN_ROUTES.map((r) => r.path)).toEqual(["/admin/cost-report", "/admin/cache-stats"]);
    for (const r of LOCAL_ADMIN_ROUTES) {
      expect(r._kind).toBe("local-admin");
      expect(["GET", "POST"]).toContain(r.method);
    }
  });
});

describe("shared cost model (the single source both surfaces import)", () => {
  it("costForTokens is exact on the seeded shapes and prices unknown/null models at the default blend", () => {
    expect(costForTokens("claude-sonnet-5", 1_000_000)).toBe(3.6);
    expect(costForTokens("claude-haiku-4-5-20251001", 500_000)).toBeCloseTo(0.9, 10);
    expect(costForTokens("claude-opus-4-8", 2_000_000)).toBe(18);
    expect(costForTokens(null, 0)).toBe(0);
    expect(costForTokens("never-heard-of", 1_000_000)).toBe(5.4);
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
    join(__dirname, "../local-admin-registry.ts"),
  ];

  it("the sqlite layer + admin registry never import the Neon side or the Next runtime", () => {
    for (const file of FILES) {
      const source = readFileSync(file, "utf-8");
      // Exact `@/db` alias (quote-delimited) and the pg schema alias — the
      // sqlite layer's legitimate imports are `@/db/sqlite` /
      // `@/db/sqlite-schema` / `@/db/sqlite-ddl` / `@/lib/auth-secret` (built
      // only on node:crypto) / `@/lib/admin/cost-model` (pure), which these
      // regexes deliberately do not match.
      expect(source, file).not.toMatch(/"@\/db"|'@\/db'|"@\/db\/schema"|'@\/db\/schema'/);
      expect(source, file).not.toMatch(/"next(\/|-auth)?"/);
      expect(source, file).not.toMatch(/@neondatabase\/serverless/);
    }
  });
});
