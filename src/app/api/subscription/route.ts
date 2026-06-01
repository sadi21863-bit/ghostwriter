// src/app/api/subscription/route.ts
// GET  — returns current subscription tier
// POST — creates a Stripe Checkout session and returns the URL
// DELETE — cancels subscription at period end

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { getOrCreateStripeCustomer } from "@/lib/subscription";
import { STRIPE_PRICES } from "@/types/subscription";
import type { SubscriptionTier } from "@/types/subscription";
import { track } from "@/lib/analytics";

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

// POST — create Stripe Checkout session
export async function POST(req: Request) {
  const session = await getRequiredSession();
  const { tier, billingPeriod, successUrl, cancelUrl } = await req.json() as {
    tier: SubscriptionTier;
    billingPeriod?: 'monthly' | 'annual';
    successUrl: string;
    cancelUrl: string;
  };

  const baseTiers = ["story_pro", "creator_pro", "all_access"];
  if (!baseTiers.includes(tier)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const priceKey = billingPeriod === 'annual' ? `${tier}_annual` : tier;
  const priceId = STRIPE_PRICES[priceKey as keyof typeof STRIPE_PRICES];
  if (!priceId) {
    return NextResponse.json({ error: "Price not configured. Add STRIPE_*_PRICE_ID to environment variables." }, { status: 500 });
  }

  const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY!);

  const customerId = await getOrCreateStripeCustomer(
    session.user.id,
    session.user.email!,
    session.user.name ?? null
  );

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId: session.user.id },
    subscription_data: {
      trial_period_days: 7,
      metadata: { userId: session.user.id },
    },
    allow_promotion_codes: true,
  });

  await track(session.user.id, 'checkout_started', { tier });
  return NextResponse.json({ url: checkoutSession.url });
}

// DELETE — cancel subscription at period end
export async function DELETE() {
  const session = await getRequiredSession();
  const stripe   = require("stripe")(process.env.STRIPE_SECRET_KEY!);
  const { db }   = await import("@/db");
  const { subscriptions } = await import("@/db/schema");
  const { eq }   = await import("drizzle-orm");

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, session.user.id),
  });

  if (!sub?.stripeSubscriptionId) {
    return NextResponse.json({ error: "No active subscription" }, { status: 404 });
  }

  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  return NextResponse.json({ success: true, cancelledAtPeriodEnd: true });
}
