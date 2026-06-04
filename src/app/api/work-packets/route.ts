export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { workPackets } from "@/db/schema";
import { or, isNull, eq, ilike, and } from "drizzle-orm";

export async function GET(req: Request) {
  const s = await getRequiredSession();
  const url = new URL(req.url);
  const titleQuery = url.searchParams.get('title')?.trim();

  const packets = await db.query.workPackets.findMany({
    where: titleQuery
      ? and(
          or(isNull(workPackets.userId), eq(workPackets.userId, s.user.id)),
          ilike(workPackets.title, `%${titleQuery}%`)
        )
      : or(isNull(workPackets.userId), eq(workPackets.userId, s.user.id)),
    columns: {
      id: true,
      title: true,
      creator: true,
      medium: true,
      genres: true,
      thematicCore: true,
      isPublic: true,
      userId: true,
      craftPrinciples: true,
      structuralNotes: true,
      characterNotes: true,
      dialogueNotes: true,
      status: true,
    },
    orderBy: (wp, { asc }) => [asc(wp.title)],
  });

  // If title search returns one clear match, return as `packet` (singular)
  // so InfluencePanel can use it directly without the research agent
  if (titleQuery && packets.length === 1) {
    return NextResponse.json({ packet: packets[0], packets });
  }

  return NextResponse.json({ packets });
}
