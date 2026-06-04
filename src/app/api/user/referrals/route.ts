export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/auth-helpers';
import { db } from '@/db';
import { referrals, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const session = await getRequiredSession();

  const [userRecord, userReferrals] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { id: true, referralCode: true, name: true, email: true },
    }),
    db.query.referrals.findMany({
      where: eq(referrals.referrerId, session.user.id),
      columns: { id: true, status: true, rewardApplied: true, createdAt: true },
    }),
  ]);

  return NextResponse.json({ user: userRecord, referrals: userReferrals });
}
