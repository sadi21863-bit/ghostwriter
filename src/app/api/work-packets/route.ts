import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { workPackets } from "@/db/schema";
import { or, isNull, eq } from "drizzle-orm";

export async function GET(_: Request) {
  const s = await getRequiredSession();

  const packets = await db.query.workPackets.findMany({
    where: or(
      isNull(workPackets.userId),
      eq(workPackets.userId, s.user.id)
    ),
    columns: {
      id: true,
      title: true,
      creator: true,
      medium: true,
      genres: true,
      thematicCore: true,
      isPublic: true,
      userId: true,
    },
    orderBy: (wp, { asc }) => [asc(wp.title)],
  });

  return NextResponse.json({ packets });
}
