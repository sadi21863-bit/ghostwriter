// src/lib/subscription.ts
// Server-side subscription helpers. Used in API routes.

import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { FeatureGate, SubscriptionTier } from "@/types/subscription";
import { FEATURE_ACCESS } from "@/types/subscription";

export const MONTHLY_GENERATION_LIMITS: Record<string, number> = {
  free:        30,
  story_pro:   500,
  creator_pro: 500,
  all_access:  -1, // unlimited
};

const tierCache = new Map<string, { tier: SubscriptionTier; expiresAt: number }>();

export function invalidateTierCache(userId: string) {
  tierCache.delete(userId);
}

/**
 * Returns the user's current subscription tier.
 * Falls back to "free" if no subscription record exists.
 * Cached in memory for 5 minutes to reduce DB load.
 */
export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  const cached = tierCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.tier;

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  let tier: SubscriptionTier = "free";

  if (sub) {
    if (sub.status === "cancelled" && sub.currentPeriodEnd) {
      tier = new Date(sub.currentPeriodEnd) > new Date() ? sub.tier as SubscriptionTier : "free";
    } else if (sub.status === "past_due") {
      tier = "free";
    } else if (sub.status === "active" || sub.status === "trialing") {
      tier = sub.tier as SubscriptionTier;
    }
  }

  tierCache.set(userId, { tier, expiresAt: Date.now() + 5 * 60 * 1000 });
  return tier;
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
