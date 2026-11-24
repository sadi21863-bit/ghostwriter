export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { showcases } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireBearer } from '@/lib/auth-secret';

function checkAdmin(req: Request): Response | null {
  const denied = requireBearer(req.headers.get('authorization'), "ADMIN_SECRET");
  if (denied) return denied;
  return null;
}

export async function GET(req: Request) {
  const denied = checkAdmin(req);
  if (denied) return denied;

  const flagged = await db.query.showcases.findMany({
    where: eq(showcases.flagged, true),
    with: { project: { columns: { name: true } } },
  });

  return NextResponse.json({
    showcases: flagged.map((sc: any) => ({
      slug: sc.slug, title: sc.title || sc.project?.name, flagReason: sc.flagReason, visibility: sc.visibility,
    })),
  });
}

// action: "unpublish" (visibility -> private, clears flagged) or "dismiss"
// (clears flagged only, stays at its current visibility).
export async function POST(req: Request) {
  const denied = checkAdmin(req);
  if (denied) return denied;

  const { slug, action } = await req.json();
  if (!slug || !["unpublish", "dismiss"].includes(action)) {
    return NextResponse.json({ error: "slug and a valid action are required" }, { status: 400 });
  }

  const update: Record<string, any> = { flagged: false, flagReason: "", updatedAt: new Date() };
  if (action === "unpublish") update.visibility = "private";

  await db.update(showcases).set(update).where(eq(showcases.slug, slug));
  return NextResponse.json({ success: true });
}
