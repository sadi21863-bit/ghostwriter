export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { requireBearer } from '@/lib/auth-secret';

export async function POST(req: Request) {
  const denied = requireBearer(req.headers.get('authorization'), "ADMIN_SECRET");
  if (denied) return denied;

  const sql = neon(process.env.DATABASE_URL!);
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    return NextResponse.json({ ok: true, message: 'pgvector extension enabled' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
