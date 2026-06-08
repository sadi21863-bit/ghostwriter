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

// GET — current subscription info (returns tier, status, currentPeriodEnd for settings UI)
export async function GET() {
  const session = await getRequiredSession();
  const { db } = await import('@/db');
  const { subscriptions } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, session.user.id),
    columns: { tier: true, status: true, currentPeriodEnd: true },
  });

  return NextResponse.json({
    tier: sub?.tier ?? 'free',
    status: sub?.status ?? 'active',
    currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
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
  const subscription = await razorpay.subscriptions.create({
    plan_id: planId,
    customer_notify: 1,
    total_count: period === 'annual' ? 10 : 120,
    notes: { userId: session.user.id, tier, billingPeriod: period },
  });

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

  await razorpay.subscriptions.cancel(sub.razorpaySubscriptionId, true);

  return NextResponse.json({ success: true, cancelledAtPeriodEnd: true });
}
