// src/lib/subscription.ts
// Server-side subscription helpers. Used in API routes.

import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { FeatureGate, SubscriptionTier } from "@/types/subscription";
import { FEATURE_ACCESS } from "@/types/subscription";

export const MONTHLY_GENERATION_LIMITS: Record<string, number> = {
  free:        10,   // Haiku-routed — habit-forming, low cost (~$0.08/month)
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

