import { NextResponse } from "next/server";
import { db } from "@/db";
import { workPackets } from "@/db/schema";
import { SEEDED_WORK_PACKETS } from "@/db/seeds/work-packets";

export async function POST(req: Request) {
  if (!process.env.ADMIN_SECRET)
    return new Response("Misconfigured", { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${process.env.ADMIN_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
