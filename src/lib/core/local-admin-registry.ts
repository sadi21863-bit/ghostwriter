/**
 * The loopback ADMIN side-registry â€” core-migration Phase 3 stage (c), built
 * per `docs/migration/phase3-prep.md` Â§3.3's option (b) recommendation
 * (settled Â§5.2): keep admin a SEPARATE transport-domain registry, not a
 * RequestContext fork.
 *
 * What this is NOT:
 *  - NOT a set of RequestContext handlers. `LocalAdminRoute` never carries an
 *    actor/project context â€” Â§3.1's code reading settled why: every admin
 *    operation is cross-user by definition or infrastructural, so the
 *    user-scoped ownership vocabulary (`ownsProject`/`projectScope`) has
 *    nothing to own here. A handler receives only `{ params, body }`.
 *  - NOT reachable with the loopback owner token. `dispatchLocalAdmin`
 *    authorizes ONLY against `requireBearer(â€¦, "ADMIN_SECRET")` (the same
 *    constant-time bearer gate the six cloud admin routes open with) â€” the
 *    owner token is a different credential for a different surface, so one
 *    credential can never reach the other's authorization path, and an admin
 *    path can never be mistaken for a user path.
 *
 * What IS here, mirroring Â§3.1's fail-closed contract verbatim: the bearer
 * gate runs BEFORE route lookup (an unset/wrong secret answers 500/401 even
 * for a path that does not exist â€” a missing env var must never accidentally
 * authorize anything), then 404 for an unregistered path, then the handler,
 * with a throw â†’ 500 `{error:"internal_error"}` exactly like the cloud
 * dispatcher shape.
 *
 * Honest scope (Â§3.3's own note): on a single-owner local host most of the
 * admin domain loses its raison d'Ãªtre â€” cross-user aggregates have one user,
 * moderation touches showcases one owner wrote. So the registry mounts ONLY
 * the two observability reads a local operator plausibly wants (`cost-report`,
 * `cache-stats`, bodies twinâ€™d over the sqlite baseline) and leaves the rest
 * cloud-only. "Admin parity" is not a goal; adding a THIRD route here should
 * be justified by a named local operator need, not symmetry.
 */

import { eq, gte, sql } from "drizzle-orm";

import { requireBearer } from "@/lib/auth-secret";
import { costForTokens } from "@/lib/admin/cost-model";
import type { DrizzleSqliteDb } from "@/db/sqlite";
import { sqliteDb } from "@/db/sqlite";
import { generations, projects } from "@/db/sqlite-schema";

export interface LocalAdminRoute {
  /**
   * A compile-time marker so an admin route can never be fed into the
   * user-scoped local ROUTES (which expect a RequestContext-carrying handler)
   * and vice versa â€” the two registries are incompatible by type.
   */
  readonly _kind: "local-admin";
  readonly method: "GET" | "POST";
  /** Static path, no params â€” matching the cloud admin routes' shapes. */
  readonly path: string;
  handle(input: { params: Record<string, string>; body: unknown }): Promise<unknown>;
}

export type LocalAdminDispatchResult = { status: number; body: unknown };

/**
 * Authorize + route + execute one admin request. Denial hierarchy fixed â€”
 * bearer gate (500 unset fail-closed / 401 wrong) BEFORE routing, then 404,
 * then the handler. Mirrors the cloud routes' exact gate (`requireBearer` on
 * the `ADMIN_SECRET` var; the Response's body/status are carried through so
 * the phrasing stays identical).
 */
export async function dispatchLocalAdmin(
  req: { method: string; path: string; authorization: string | null },
  registry: readonly LocalAdminRoute[],
): Promise<LocalAdminDispatchResult> {
  const denied = requireBearer(req.authorization, "ADMIN_SECRET");
  if (denied) {
    // The cloud route returns the Response verbatim; this dispatcher flattens
    // its body/status into the local DispatchResult so the phrasing stays
    // identical to the cloud admin gate.
    const text = await denied.text();
    return { status: denied.status, body: text };
  }
  const method = req.method.toUpperCase();
  const norm = (p: string) => p.replace(/^\/+|\/+$/g, "");
  const path = norm(req.path);
  const route = registry.find((r) => r.method === method && norm(r.path) === path);
  if (!route) return { status: 404, body: { error: "not_found" } };
  try {
    const body = await route.handle({ params: {}, body: {} });
    return { status: 200, body };
  } catch (err) {
    console.error("[local-admin] handler threw:", err);
    return { status: 500, body: { error: "internal_error" } };
  }
}

/**
 * `GET /admin/cost-report` â€” the cloud route's 30d blended-cost aggregate,
 * twinâ€™d over the sqlite baseline (same joins, same keys, same note). Reads
 * join `generations` â†’ `projects` to attribute spend per owner id exactly as
 * the cloud route attributes per user; on a single-owner host the ranking is
 * at most one entry, by design.
 */
export function makeLocalCostReportRoute(db: DrizzleSqliteDb): LocalAdminRoute {
  return {
    _kind: "local-admin",
    method: "GET",
    path: "/admin/cost-report",
    handle: async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Per (owner, model) token totals â€” drives topUsers cost ranking.
      const userModelTotals = await db
        .select({
          userId: projects.userId,
          model: generations.model,
          tokens: sql<number>`sum(${generations.tokensUsed})`,
        })
        .from(generations)
        .innerJoin(projects, eq(generations.projectId, projects.id))
        .where(gte(generations.createdAt, since))
        .groupBy(projects.userId, generations.model);

      // Per-model totals â€” drives costByModel and the platform total.
      const modelTotals = await db
        .select({
          model: generations.model,
          tokens: sql<number>`sum(${generations.tokensUsed})`,
        })
        .from(generations)
        .innerJoin(projects, eq(generations.projectId, projects.id))
        .where(gte(generations.createdAt, since))
        .groupBy(generations.model);

      // Per-mode totals â€” drives topModes.
      const modeTotals = await db
        .select({
          mode: generations.mode,
          tokens: sql<number>`sum(${generations.tokensUsed})`,
        })
        .from(generations)
        .innerJoin(projects, eq(generations.projectId, projects.id))
        .where(gte(generations.createdAt, since))
        .groupBy(generations.mode);

      const costByModel: Record<string, { tokens: number; costUSD: number }> = {};
      let totalEstimatedCostUSD = 0;
      for (const row of modelTotals) {
        const tokens = Number(row.tokens) || 0;
        const costUSD = costForTokens(row.model, tokens);
        costByModel[row.model ?? "unknown"] = { tokens, costUSD: Number(costUSD.toFixed(4)) };
        totalEstimatedCostUSD += costUSD;
      }

      const userCosts = new Map<string, number>();
      for (const row of userModelTotals) {
        const tokens = Number(row.tokens) || 0;
        const cost = costForTokens(row.model, tokens);
        userCosts.set(row.userId, (userCosts.get(row.userId) ?? 0) + cost);
      }
      const topUsers = [...userCosts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([userId, costUSD]) => ({ userId, costUSD: Number(costUSD.toFixed(4)) }));

      const topModes = modeTotals
        .map((row) => ({ mode: row.mode ?? "unknown", tokens: Number(row.tokens) || 0 }))
        .sort((a, b) => b.tokens - a.tokens)
        .slice(0, 15);

      return {
        period: "30d",
        since,
        totalEstimatedCostUSD: Number(totalEstimatedCostUSD.toFixed(4)),
        costByModel,
        topUsers,
        topModes,
        note: "Estimates use blended per-token rates (combined input+output, since tokensUsed does not separate them) and do not account for prompt-caching discounts (~90% cheaper for cached input tokens). Treat as directional, not exact billing figures.",
      };
    },
  };
}

/**
 * `GET /admin/cache-stats` â€” the cloud route's semantic-cache observability
 * read over the sqlite baseline (top 50 rows by hitCount, same response
 * shape). The matcher keeps the exact `columns` projection the cloud body
 * uses, so an operator reads the same numbers from either surface.
 */
export function makeLocalCacheStatsRoute(db: DrizzleSqliteDb): LocalAdminRoute {
  return {
    _kind: "local-admin",
    method: "GET",
    path: "/admin/cache-stats",
    handle: async () => {
      const entries = await db.query.semanticCache.findMany({
        columns: { cacheType: true, inputKey: true, hitCount: true, createdAt: true, lastHitAt: true },
        orderBy: (c, { desc }) => [desc(c.hitCount)],
        limit: 50,
      });

      const totalHits = entries.reduce((sum, e) => sum + (e.hitCount ?? 0), 0);
      const byType = entries.reduce((acc, e) => {
        acc[e.cacheType] = (acc[e.cacheType] ?? 0) + (e.hitCount ?? 0);
        return acc;
      }, {} as Record<string, number>);

      return { totalHits, byType, topEntries: entries.slice(0, 10) };
    },
  };
}

/**
 * The default registry over the lazy `sqliteDb` proxy — the composition the
 * local host serves unless its root supplies a custom db. Two routes, per
 * §3.3's honest scope note: cost-report + cache-stats observability only;
 * moderation and infra ops stay cloud-only.
 */
export const LOCAL_ADMIN_ROUTES: readonly LocalAdminRoute[] = [
  makeLocalCostReportRoute(sqliteDb),
  makeLocalCacheStatsRoute(sqliteDb),
];
