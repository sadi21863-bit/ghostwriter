export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { generations, projects } from '@/db/schema';
import { gte, eq, sql } from 'drizzle-orm';

// Blended USD per million tokens (tokensUsed = input + output combined, so a
// single blended rate is used rather than separate input/output pricing).
// Sonnet 5 (claude-sonnet-5, released 2026-06-30) is priced at an introductory
// $2/$10 per MTok (in/out) through 2026-08-31, then reverts to standard $3/$15
// (same as the prior Sonnet 4.6 rate) — bump 3.6 -> 5.4 for sonnet-5 after that date.
const BLENDED_COST_PER_MTOK: Record<string, number> = {
  'claude-haiku-4-5-20251001': 1.6,
  'claude-sonnet-4-6':         5.4, // historical rows predating the Sonnet 5 switch
  'claude-sonnet-5':           3.6, // introductory rate through 2026-08-31
  'claude-opus-4-6':           27.0,
  'claude-opus-4-8':           27.0,
};
const DEFAULT_COST_PER_MTOK = 5.4;

function costForTokens(model: string | null, tokens: number): number {
  const rate = BLENDED_COST_PER_MTOK[model ?? ''] ?? DEFAULT_COST_PER_MTOK;
  return (tokens / 1_000_000) * rate;
}

export async function GET(req: Request) {
  if (!process.env.ADMIN_SECRET) {
    return new Response('Server misconfigured: ADMIN_SECRET not set', { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
