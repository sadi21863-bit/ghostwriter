export const dynamic = 'force-dynamic';

// src/app/api/subscription/verify/route.ts
// Verifies the Razorpay checkout signature once the overlay completes payment,
// then activates the subscription in our database.

import crypto from "crypto";
import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { db } from "@/db";
import { subscriptions, referrals } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getRequiredSession } from "@/lib/auth-helpers";
import { track } from "@/lib/analytics";
import { sendEmail } from "@/lib/email";
import { subscriptionConfirmedEmail } from "@/lib/email/templates";
import { invalidateTierCache } from "@/lib/subscription";
import type { SubscriptionTier } from "@/types/subscription";

export async function POST(req: Request) {
  const session = await getRequiredSession();

  if (!process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json({
      error: 'Payment verification not configured.',
    }, { status: 503 });
  }

  const {
    razorpay_payment_id,
    razorpay_subscription_id,
    razorpay_signature,
  } = await req.json() as {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
  };

  if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing verification fields" }, { status: 400 });
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
    .digest("hex");

  const expected = Buffer.from(expectedSignature);
  const actual = Buffer.from(razorpay_signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
  const razorpaySub = await razorpay.subscriptions.fetch(razorpay_subscription_id);

  // CRITICAL: tier comes from the Razorpay subscription's notes (set server-side at
  // creation in POST /api/subscription), never from the client request body.
  if (razorpaySub.notes?.userId !== session.user.id) {
    return NextResponse.json({ error: "Subscription does not belong to this user" }, { status: 403 });
  }
  const tier = (razorpaySub.notes?.tier ?? "free") as SubscriptionTier;

  await db.insert(subscriptions).values({
    userId: session.user.id,
    razorpaySubscriptionId: razorpay_subscription_id,
    razorpayPaymentId: razorpay_payment_id,
    tier,
    status: "active",
    currentPeriodEnd: razorpaySub.current_end ? new Date(razorpaySub.current_end * 1000) : null,
  }).onConflictDoUpdate({
    target: subscriptions.userId,
    set: {
      razorpaySubscriptionId: razorpay_subscription_id,
      razorpayPaymentId: razorpay_payment_id,
      tier,
      status: "active",
      currentPeriodEnd: razorpaySub.current_end ? new Date(razorpaySub.current_end * 1000) : null,
      updatedAt: new Date(),
    },
  });

  invalidateTierCache(session.user.id);
  await track(session.user.id, 'subscription_activated', { tier });

  const { subject, html, text } = subscriptionConfirmedEmail(session.user.name ?? '', tier);
  sendEmail({ to: session.user.email!, subject, html, text }).catch(() => {});

  // Referral reward: extend referrer's current period by 30 days once their referee subscribes
  try {
    const pendingReferral = await db.query.referrals.findFirst({
      where: and(eq(referrals.refereeId, session.user.id), eq(referrals.status, 'pending')),
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

  return NextResponse.json({ success: true, tier });
}
