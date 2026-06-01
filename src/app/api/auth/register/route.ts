import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, referrals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/email/templates";

export async function POST(req: NextRequest) {
  const { email, name, password, ref } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }
  const hashedPassword = await bcrypt.hash(password, 12);
  const referralCode = randomBytes(6).toString("hex").toUpperCase();
  const [user] = await db
    .insert(users)
    .values({ email, name: name?.trim() || null, hashedPassword, referralCode })
    .returning({ id: users.id, email: users.email, name: users.name });

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

  return NextResponse.json(user, { status: 201 });
}
