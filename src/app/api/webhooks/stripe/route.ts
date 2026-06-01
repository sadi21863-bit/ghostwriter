// src/app/api/webhooks/stripe/route.ts
// Handles Stripe webhook events to keep subscription state in sync.
// Endpoint URL to configure in Stripe dashboard: https://yourdomain.com/api/webhooks/stripe
// Events to enable: checkout.session.completed, customer.subscription.updated,
//   customer.subscription.deleted, invoice.payment_failed, invoice.payment_succeeded

import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { track } from "@/lib/analytics";

const TIER_MAP: Record<string, string> = {
  [process.env.STRIPE_STORY_PRO_PRICE_ID   ?? "price_story_pro"]:   "story_pro",
  [process.env.STRIPE_CREATOR_PRO_PRICE_ID ?? "price_creator_pro"]: "creator_pro",
  [process.env.STRIPE_ALL_ACCESS_PRICE_ID  ?? "price_all_access"]:  "all_access",
};

export async function POST(req: Request) {
  const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY!);
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature") ?? "";

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature failed: ${err.message}` }, { status: 400 });
  }

  const sub = event.data.object as any;

  switch (event.type) {

    case "checkout.session.completed": {
      const session = sub;
      if (session.mode !== "subscription") break;
      const stripeSub = await stripe.subscriptions.retrieve(session.subscription);
      const priceId = stripeSub.items.data[0]?.price?.id;
      const tier = TIER_MAP[priceId] ?? "story_pro";
      const userId = session.metadata?.userId;
      if (!userId) break;

      await db.update(subscriptions).set({
        stripeSubscriptionId: stripeSub.id,
        tier,
        status: "active",
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        updatedAt: new Date(),
      }).where(eq(subscriptions.userId, userId));
      await track(userId, 'subscription_activated', { tier });
      break;
    }

    case "customer.subscription.updated": {
      const priceId = sub.items.data[0]?.price?.id;
      const tier    = TIER_MAP[priceId] ?? "story_pro";
      await db.update(subscriptions).set({
        tier,
        status: sub.status,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        updatedAt: new Date(),
      }).where(eq(subscriptions.stripeSubscriptionId, sub.id));
      break;
    }

    case "customer.subscription.deleted": {
      await db.update(subscriptions).set({
        status: "cancelled",
        tier: "free",
        updatedAt: new Date(),
      }).where(eq(subscriptions.stripeSubscriptionId, sub.id));
      break;
    }

    case "invoice.payment_failed": {
      await db.update(subscriptions).set({
        status: "past_due",
        updatedAt: new Date(),
      }).where(eq(subscriptions.stripeCustomerId, sub.customer));
      break;
    }

    case "invoice.payment_succeeded": {
      await db.update(subscriptions).set({
        status: "active",
        updatedAt: new Date(),
      }).where(eq(subscriptions.stripeCustomerId, sub.customer));
      break;
    }
  }

  return NextResponse.json({ received: true });
}
