export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, referrals, subscriptions, emailVerificationTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { sendEmail } from "@/lib/email";
import { welcomeEmail, verificationEmail } from "@/lib/email/templates";
import { checkAuthRateLimit } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'anonymous';
  const rl = await checkAuthRateLimit(ip);
  if (rl) return rl;

  const { email, name, password, ref } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await db.query.users.findFirst({ where: eq(users.email, normalizedEmail) });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }
  const hashedPassword = await bcrypt.hash(password, 12);
  const referralCode = randomBytes(6).toString("hex").toUpperCase();
  const trialEndAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const [user] = await db
    .insert(users)
    .values({ email: normalizedEmail, name: name?.trim() || null, hashedPassword, referralCode, trialEndAt })
    .returning({ id: users.id, email: users.email, name: users.name });

  await db.insert(subscriptions).values({ userId: user.id });

  // Link referrer if a valid ref code was provided
  if (ref) {
    try {
      const referrer = await db.query.users.findFirst({
        where: eq(users.referralCode, ref.toUpperCase()),
        columns: { id: true },
      });
      if (referrer && referrer.id !== user.id) {
        await db.insert(referrals).values({
          referrerId: referrer.id,
          refereeId: user.id,
          status: "pending",
        });
      }
    } catch { /* referral failure must never block registration */ }
  }

  // Send welcome email (non-blocking)
  const { subject, html, text } = welcomeEmail(name ?? "");
  sendEmail({ to: email, subject, html, text }).catch(() => {});

  // Issue an email-verification token (non-blocking — never blocks registration)
  const verifyToken = randomBytes(32).toString('hex');
  const verifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(emailVerificationTokens).values({ userId: user.id, token: verifyToken, expiresAt: verifyExpiresAt });
  const verifyUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${verifyToken}`;
  const verification = verificationEmail(name ?? "", verifyUrl);
  sendEmail({ to: email, subject: verification.subject, html: verification.html, text: verification.text }).catch(() => {});

  return NextResponse.json(user, { status: 201 });
}
