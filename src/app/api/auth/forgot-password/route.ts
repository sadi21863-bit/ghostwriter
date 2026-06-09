export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, passwordResetTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { sendEmail } from '@/lib/email';
import { passwordResetEmail } from '@/lib/email/templates';
import { checkAuthRateLimit } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'anonymous';
  const rl = await checkAuthRateLimit(ip);
  if (rl) return rl;

  const { email } = await req.json();
  if (!email?.trim()) return NextResponse.json({ ok: true });

  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase().trim()),
    columns: { id: true, name: true, email: true },
  });

  if (user) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.insert(passwordResetTokens).values({ userId: user.id, token, expiresAt });

    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
    const { subject, html, text } = passwordResetEmail(user.name ?? '', resetUrl);
    await sendEmail({ to: user.email, subject, html, text });
  }

  return NextResponse.json({ ok: true });
}
