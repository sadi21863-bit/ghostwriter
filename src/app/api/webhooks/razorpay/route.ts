export const dynamic = 'force-dynamic';

// src/app/api/webhooks/razorpay/route.ts
// Handles Razorpay webhook events to keep subscription state in sync.
// Endpoint URL to configure in the Razorpay dashboard: https://yourdomain.com/api/webhooks/razorpay
// Events to enable: subscription.activated, subscription.charged, subscription.halted,
//   subscription.cancelled, subscription.completed

import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptions, referrals, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { track } from "@/lib/analytics";
import { sendEmail } from "@/lib/email";
import { subscriptionConfirmedEmail } from "@/lib/email/templates";
import { invalidateTierCache } from "@/lib/subscription";
import type { SubscriptionTier } from "@/types/subscription";

interface RazorpaySubscriptionEntity {
  id: string;
  status: string;
  current_end?: number | null;
  notes?: { userId?: string; tier?: string } | null;
}

function verifySignature(body: string, signature: string): boolean {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest("hex");

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  return expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);
}

async function activateSubscription(sub: RazorpaySubscriptionEntity) {
  const userId = sub.notes?.userId;
  const tier = (sub.notes?.tier ?? "story_pro") as SubscriptionTier;
  if (!userId) return;

  await db.update(subscriptions).set({
    razorpaySubscriptionId: sub.id,
    tier,
    status: "active",
    currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
    updatedAt: new Date(),
  }).where(eq(subscriptions.userId, userId));
  invalidateTierCache(userId);
  await track(userId, 'subscription_activated', { tier });

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { email: true, name: true },
  });
  if (user) {
    const { subject, html, text } = subscriptionConfirmedEmail(user.name ?? '', tier);
    sendEmail({ to: user.email, subject, html, text }).catch(() => {});
  }

  // Referral reward: extend referrer's current period by 30 days once their referee subscribes
  try {
    const pendingReferral = await db.query.referrals.findFirst({
      where: and(eq(referrals.refereeId, userId), eq(referrals.status, 'pending')),
    });
    if (pendingReferral) {
      await db.update(referrals)
        .set({ status: 'subscribed' })
        .where(eq(referrals.id, pendingReferral.id));

      const referrerSub = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, pendingReferral.referrerId),
      });
      if (referrerSub?.currentPeriodEnd) {
        await db.update(subscriptions)
          .set({ currentPeriodEnd: new Date(referrerSub.currentPeriodEnd.getTime() + 30 * 24 * 60 * 60 * 1000) })
          .where(eq(subscriptions.id, referrerSub.id));
        await db.update(referrals)
          .set({ status: 'rewarded', rewardApplied: true })
          .where(eq(referrals.id, pendingReferral.id));
        invalidateTierCache(pendingReferral.referrerId);
        await track(pendingReferral.referrerId, 'referral_rewarded');
      }
    }
  } catch { /* referral reward failure must never break the main flow */ }
}

async function invalidateCacheFor(razorpaySubscriptionId: string) {
  const dbSub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.razorpaySubscriptionId, razorpaySubscriptionId),
    columns: { userId: true },
  });
  if (dbSub) invalidateTierCache(dbSub.userId);
  return dbSub;
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  const event = JSON.parse(body) as { event: string; payload: Record<string, any> };
  const subEntity = event.payload?.subscription?.entity as RazorpaySubscriptionEntity | undefined;

  switch (event.event) {

    case "subscription.activated": {
      if (subEntity) await activateSubscription(subEntity);
      break;
    }

    case "subscription.charged": {
      if (!subEntity) break;
      await db.update(subscriptions).set({
        status: "active",
        currentPeriodEnd: subEntity.current_end ? new Date(subEntity.current_end * 1000) : null,
        updatedAt: new Date(),
      }).where(eq(subscriptions.razorpaySubscriptionId, subEntity.id));

      const dbSub = await invalidateCacheFor(subEntity.id);
      if (dbSub) await track(dbSub.userId, 'subscription_renewed');
      break;
    }

    case "subscription.halted": {
      if (!subEntity) break;
      await db.update(subscriptions).set({
        status: "past_due",
        updatedAt: new Date(),
      }).where(eq(subscriptions.razorpaySubscriptionId, subEntity.id));
      await invalidateCacheFor(subEntity.id);
      break;
    }

    case "subscription.cancelled":
    case "subscription.completed": {
      if (!subEntity) break;
      await db.update(subscriptions).set({
        status: "cancelled",
        tier: "free",
        updatedAt: new Date(),
      }).where(eq(subscriptions.razorpaySubscriptionId, subEntity.id));
      await invalidateCacheFor(subEntity.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
