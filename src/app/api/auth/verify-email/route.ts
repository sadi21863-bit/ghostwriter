export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, emailVerificationTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const dashboardUrl = new URL('/dashboard', req.url);

  if (!token) {
    dashboardUrl.searchParams.set('email_verified', 'error');
    return NextResponse.redirect(dashboardUrl);
  }

  const verificationToken = await db.query.emailVerificationTokens.findFirst({
    where: eq(emailVerificationTokens.token, token),
  });

  if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt < new Date()) {
    dashboardUrl.searchParams.set('email_verified', 'error');
    return NextResponse.redirect(dashboardUrl);
  }

  await db.update(users)
    .set({ emailVerified: new Date() })
    .where(eq(users.id, verificationToken.userId));

  await db.update(emailVerificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(emailVerificationTokens.id, verificationToken.id));

  dashboardUrl.searchParams.set('email_verified', '1');
  return NextResponse.redirect(dashboardUrl);
}
