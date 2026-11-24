export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { generations, projects } from '@/db/schema';
import { gte, eq, sql } from 'drizzle-orm';
import { requireBearer } from '@/lib/auth-secret';
import { costForTokens } from '@/lib/admin/cost-model';

export async function GET(req: Request) {
  const denied = requireBearer(req.headers.get('authorization'), "ADMIN_SECRET");
  if (denied) return denied;

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Per (user, model) token totals — drives topUsers cost ranking.
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

  // Per-model token totals — drives costByModel and the platform total.
  const modelTotals = await db
    .select({
      model: generations.model,
      tokens: sql<number>`sum(${generations.tokensUsed})`,
    })
    .from(generations)
    .innerJoin(projects, eq(generations.projectId, projects.id))
    .where(gte(generations.createdAt, since))
    .groupBy(generations.model);

  // Per-mode token totals — drives topModes.
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
    costByModel[row.model ?? 'unknown'] = { tokens, costUSD: Number(costUSD.toFixed(4)) };
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
    .map((row) => ({ mode: row.mode ?? 'unknown', tokens: Number(row.tokens) || 0 }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 15);

  return NextResponse.json({
    period: '30d',
    since,
    totalEstimatedCostUSD: Number(totalEstimatedCostUSD.toFixed(4)),
    costByModel,
    topUsers,
    topModes,
    note: 'Estimates use blended per-token rates (combined input+output, since tokensUsed does not separate them) and do not account for prompt-caching discounts (~90% cheaper for cached input tokens). Treat as directional, not exact billing figures.',
  });
}
