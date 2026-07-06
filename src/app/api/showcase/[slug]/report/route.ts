export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { showcases } from "@/db/schema";
import { eq } from "drizzle-orm";

// Requires auth (not fully anonymous) to discourage spam reports — the
// researched "publish-then-flag" moderation approach for a platform this
// size: content stays live, a flag surfaces it for an admin to act on.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  await getRequiredSession();
  const { slug } = await params;
  const { reason } = await req.json().catch(() => ({ reason: "" }));

  const showcase = await db.query.showcases.findFirst({ where: eq(showcases.slug, slug) });
  if (!showcase || showcase.visibility === "private") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.update(showcases)
    .set({ flagged: true, flagReason: reason || "No reason given", updatedAt: new Date() })
    .where(eq(showcases.slug, slug));

  return NextResponse.json({ success: true });
}
