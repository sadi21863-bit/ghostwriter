export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, emailVerificationTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { sendEmail } from '@/lib/email';
import { verificationEmail } from '@/lib/email/templates';
import { getRequiredSession } from '@/lib/auth-helpers';

export async function POST() {
  const session = await getRequiredSession();

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { id: true, name: true, email: true, emailVerified: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ ok: true, alreadyVerified: true });

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(emailVerificationTokens).values({ userId: user.id, token, expiresAt });

  const verifyUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}`;
  const { subject, html, text } = verificationEmail(user.name ?? '', verifyUrl);
  await sendEmail({ to: user.email, subject, html, text });

  return NextResponse.json({ ok: true });
}
