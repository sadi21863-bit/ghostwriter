export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { db } from "@/db";
import { workPackets } from "@/db/schema";
import { SEEDED_WORK_PACKETS } from "@/db/seeds/work-packets";
import { requireBearer } from "@/lib/auth-secret";

export async function POST(req: Request) {
  const denied = requireBearer(req.headers.get("authorization"), "ADMIN_SECRET");
  if (denied) return denied;

  let inserted = 0;
  let skipped = 0;

  for (const packet of SEEDED_WORK_PACKETS) {
    const existing = await db.query.workPackets.findFirst({
      where: (wp, { eq }) => eq(wp.title, packet.title),
      columns: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await db.insert(workPackets).values({
      userId: null,
      title: packet.title,
      creator: packet.creator,
      medium: packet.medium,
      genres: packet.genres,
      thematicCore: packet.thematicCore,
      craftPrinciples: packet.craftPrinciples,
      isPublic: true,
      status: "active",
    });
    inserted++;
  }

  return NextResponse.json({
    inserted,
    skipped,
    total: SEEDED_WORK_PACKETS.length,
  });
}
