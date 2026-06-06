export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { universes } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const s = await getRequiredSession();
  const list = await db.query.universes.findMany({
    where: eq(universes.userId, s.user.id),
    with: { characters: true, events: { orderBy: (e, { asc }) => [asc(e.timelineSort)] } },
    orderBy: (u, { desc }) => [desc(u.updatedAt)],
  });
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const s = await getRequiredSession();
  const { name, premise, tone, sharedRules } = await req.json();
  const [u] = await db.insert(universes).values({
    userId: s.user.id,
    name: name || "Untitled Universe",
    premise: premise || "",
    tone: tone || "",
    sharedRules: sharedRules || [],
  }).returning();
  return NextResponse.json(u, { status: 201 });
}
