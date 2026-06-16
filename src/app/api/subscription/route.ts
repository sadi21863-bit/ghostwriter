export const dynamic = 'force-dynamic';

// src/app/api/subscription/route.ts
// GET    — returns current subscription tier
// POST   — creates a Razorpay subscription, returns its id for the checkout overlay
// DELETE — cancels subscription at the end of the current billing cycle

import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { getRequiredSession } from "@/lib/auth-helpers";
import { RAZORPAY_PLANS } from "@/types/subscription";
import type { SubscriptionTier } from "@/types/subscription";
import { track } from "@/lib/analytics";

function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return null;
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

// The Razorpay test-mode API intermittently returns a 401 "Authentication failed"
// (~30% of calls) for reasons unrelated to the actual credentials — a short retry
// loop with backoff resolves it almost every time.
async function withAuthRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const e = err as { statusCode?: number; error?: { code?: string } };
      const isAuthGlitch = e?.statusCode === 401 && e?.error?.code === 'BAD_REQUEST_ERROR';
      if (!isAuthGlitch || i === attempts - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 250 * (i + 1)));
    }
  }
  throw new Error('unreachable');
}

// GET — current subscription info (returns tier, status, currentPeriodEnd, emailVerified for settings UI)
export async function GET() {
  const session = await getRequiredSession();
  const { db } = await import('@/db');
  const { subscriptions, users } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, session.user.id),
    columns: { tier: true, status: true, currentPeriodEnd: true },
  });

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { trialEndAt: true, emailVerified: true },
  });
  const emailVerified = user?.emailVerified != null;

  const tier = sub?.tier ?? 'free';

  // 7-day Story Pro trial: report story_pro/trialing so the existing trial banner renders.
  if (tier === 'free' && user?.trialEndAt && new Date(user.trialEndAt) > new Date()) {
    return NextResponse.json({
      tier: 'story_pro',
      status: 'trialing',
      currentPeriodEnd: user.trialEndAt.toISOString(),
      emailVerified,
    });
  }

  return NextResponse.json({
    tier,
    status: sub?.status ?? 'active',
    currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
    emailVerified,
  });
}

// POST — create a Razorpay subscription; the client opens the checkout overlay with the returned id
export async function POST(req: Request) {
  const session = await getRequiredSession();

  const razorpay = getRazorpay();
  if (!razorpay) {
    return NextResponse.json({
      error: 'Payments not configured yet. Please try again later.',
    }, { status: 503 });
  }

  const { tier, billingPeriod } = await req.json() as {
    tier: SubscriptionTier;
    billingPeriod?: 'monthly' | 'annual';
  };

  const baseTiers = ["story_pro", "creator_pro", "all_access"];
  if (!baseTiers.includes(tier)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const period = billingPeriod === 'annual' ? 'annual' : 'monthly';
  const planId = RAZORPAY_PLANS[tier]?.[period];
  if (!planId) {
    return NextResponse.json({
      error: 'This plan is not available yet. Please try again later.',
    }, { status: 503 });
  }

  // total_count = number of billing cycles before the subscription auto-expires.
  // Set to ~10 years out — the subscription effectively renews until the user cancels.
  let subscription;
  try {
    subscription = await withAuthRetry(() => razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: period === 'annual' ? 10 : 120,
      notes: { userId: session.user.id, tier, billingPeriod: period },
    }));
  } catch (err) {
    const e = err as { statusCode?: number; error?: { code?: string; description?: string } };
    console.error('[subscription] Razorpay create failed:', JSON.stringify({
      statusCode: e?.statusCode,
      code: e?.error?.code,
      description: e?.error?.description,
      planId,
      tier,
      period,
    }));
    return NextResponse.json({
      error: 'Payment provider is temporarily unavailable. Please try again in a moment.',
    }, { status: 503 });
  }

  await track(session.user.id, 'checkout_started', { tier });
  return NextResponse.json({
    subscriptionId: subscription.id,
    keyId: process.env.RAZORPAY_KEY_ID,
  });
}

// DELETE — cancel subscription at the end of the current billing cycle
export async function DELETE() {
  const session = await getRequiredSession();

  const razorpay = getRazorpay();
  if (!razorpay) {
    return NextResponse.json({
      error: 'Payments not configured yet. Please try again later.',
    }, { status: 503 });
  }

  const { db } = await import("@/db");
  const { subscriptions } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, session.user.id),
  });

  if (!sub?.razorpaySubscriptionId) {
    return NextResponse.json({ error: "No active subscription" }, { status: 404 });
  }

  try {
    await withAuthRetry(() => razorpay.subscriptions.cancel(sub.razorpaySubscriptionId!, true));
  } catch {
    return NextResponse.json({
      error: 'Payment provider is temporarily unavailable. Please try again in a moment.',
    }, { status: 503 });
  }

  return NextResponse.json({ success: true, cancelledAtPeriodEnd: true });
}
