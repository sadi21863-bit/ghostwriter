// src/lib/subscription.ts
// Server-side subscription helpers. Used in API routes.

import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { FeatureGate, SubscriptionTier } from "@/types/subscription";
import { FEATURE_ACCESS } from "@/types/subscription";

/**
 * Returns the user's current subscription tier.
 * Falls back to "free" if no subscription record exists.
 * Cancelled subscriptions retain access until currentPeriodEnd.
 */
export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (!sub) return "free";

  // Cancelled but still within paid period
  if (sub.status === "cancelled" && sub.currentPeriodEnd) {
    if (new Date(sub.currentPeriodEnd) > new Date()) {
      return sub.tier as SubscriptionTier;
    }
    return "free";
  }

  // Past due — restrict to free
  if (sub.status === "past_due") return "free";

  if (sub.status === "active" || sub.status === "trialing") {
    return sub.tier as SubscriptionTier;
  }

  return "free";
}

/**
 * Returns true if the given tier has access to the given feature.
 */
export function canAccessFeature(tier: SubscriptionTier, feature: FeatureGate): boolean {
  return FEATURE_ACCESS[feature]?.includes(tier) ?? false;
}

/**
 * Creates or retrieves a Stripe customer ID for a user.
 * Call this before creating a Stripe checkout session.
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name: string | null
): Promise<string> {
  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { ghostwriterUserId: userId },
  });

  await db.insert(subscriptions).values({
    userId,
    stripeCustomerId: customer.id,
    tier: "free",
    status: "active",
  }).onConflictDoUpdate({
    target: subscriptions.userId,
    set: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

function getStripe() {
  const Stripe = require("stripe");
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-04-10" });
}
