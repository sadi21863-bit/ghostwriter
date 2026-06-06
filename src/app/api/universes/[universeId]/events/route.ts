export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { universes, universeEvents } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type Ctx = { params: Promise<{ universeId: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const s = await getRequiredSession();
  const { universeId } = await params;
  const universe = await db.query.universes.findFirst({
    where: and(eq(universes.id, universeId), eq(universes.userId, s.user.id)),
  });
  if (!universe) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const events = await db.query.universeEvents.findMany({
    where: eq(universeEvents.universeId, universeId),
    orderBy: (e, { asc }) => [asc(e.timelineSort)],
  });
  return NextResponse.json(events);
}

export async function POST(req: Request, { params }: Ctx) {
  const s = await getRequiredSession();
  const { universeId } = await params;
  const universe = await db.query.universes.findFirst({
    where: and(eq(universes.id, universeId), eq(universes.userId, s.user.id)),
  });
  if (!universe) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { name, description, timelineSort, projectId, isCanon } = await req.json();
  const [e] = await db.insert(universeEvents).values({
    universeId,
    name: name || "Unnamed Event",
    description: description || "",
    timelineSort: timelineSort ?? 1,
    isCanon: isCanon ?? true,
    ...(projectId && { projectId }),
  }).returning();
  return NextResponse.json(e, { status: 201 });
}
