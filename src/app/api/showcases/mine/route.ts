export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { showcases } from "@/db/schema";
import { eq } from "drizzle-orm";

// Feeds the dashboard's ShowcaseShelf — the current user's own showcases
// across all their projects, regardless of visibility (owner always sees
// their own private/unlisted/public entries here).
export async function GET() {
  const s = await getRequiredSession();

  const mine = await db.query.showcases.findMany({
    where: eq(showcases.userId, s.user.id),
  });

  return NextResponse.json({
    showcases: mine.map(sc => ({
      projectId: sc.projectId, slug: sc.slug, title: sc.title, visibility: sc.visibility,
    })),
  });
}
