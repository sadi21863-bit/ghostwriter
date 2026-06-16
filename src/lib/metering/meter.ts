import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, generations } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { getUserTier, MONTHLY_GENERATION_LIMITS } from "@/lib/subscription";
import { creditsFor } from "./costs";

async function resetMonthlyIfNeeded(userId: string): Promise<void> {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  // Conditional UPDATE: only resets if resetAt is null or before the first of this calendar month.
  await db.update(users)
    .set({ monthlyGenerations: 0, monthlyGenerationsResetAt: firstOfMonth })
    .where(
      and(
        eq(users.id, userId),
        sql`(${users.monthlyGenerationsResetAt} IS NULL OR ${users.monthlyGenerationsResetAt} < ${firstOfMonth.toISOString()}::timestamptz)`
      )
    );
}

/**
 * Gate every AI route through this helper BEFORE making the AI call.
 * Returns null if the request is allowed (credits reserved).
 * Returns a NextResponse (429/403) if the user is over limit or unverified.
 *
 * On AI call FAILURE, call refundCredits() to return the reserved credits.
 */
export async function meterAndGate(
  userId: string,
  operation: string
): Promise<NextResponse | null> {
  const cost = creditsFor(operation);
  const tier = await getUserTier(userId);
  const limit = MONTHLY_GENERATION_LIMITS[tier] ?? 10;

  // 1. Calendar-aligned monthly reset
  await resetMonthlyIfNeeded(userId);

  // 2. Read current user state for email gate
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { monthlyGenerations: true, emailVerified: true },
  });

  // 3. Email soft-gate: allow 3 grace generations, then require verification.
  if (!user?.emailVerified && (user?.monthlyGenerations ?? 0) >= 3) {
    return NextResponse.json(
      { error: "Verify your email to continue", verifyEmail: true },
      { status: 403 }
    );
  }

  // 4. Unlimited tier: still record usage so cost-report sees 100% of spend
  if (limit === -1) {
    await db.update(users)
      .set({ monthlyGenerations: sql`${users.monthlyGenerations} + ${cost}` })
      .where(eq(users.id, userId));
    db.insert(generations).values({ projectId: null, mode: operation, prompt: "", output: "" }).catch(() => {});
    return null;
  }

  // 5. Atomic conditional increment: succeeds only if (current + cost) fits within limit.
  const [row] = await db.update(users)
    .set({ monthlyGenerations: sql`${users.monthlyGenerations} + ${cost}` })
    .where(
      and(
        eq(users.id, userId),
        sql`${users.monthlyGenerations} + ${cost} <= ${limit}`
      )
    )
    .returning({ used: users.monthlyGenerations });

  if (!row) {
    const now = new Date();
    const resetsAt = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    return NextResponse.json(
      { error: "Monthly generation limit reached", upgrade: true, resetsAt },
      { status: 429 }
    );
  }

  db.insert(generations).values({ projectId: null, mode: operation, prompt: "", output: "" }).catch(() => {});
  return null;
}

/**
 * Refund credits after an AI call failure.
 * Call from the catch block of each route that uses meterAndGate.
 */
export async function refundCredits(userId: string, operation: string): Promise<void> {
  const cost = creditsFor(operation);
  await db.update(users)
    .set({ monthlyGenerations: sql`GREATEST(0, ${users.monthlyGenerations} - ${cost})` })
    .where(eq(users.id, userId));
}
