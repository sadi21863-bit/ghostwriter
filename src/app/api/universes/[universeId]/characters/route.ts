export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { universes, universeCharacters } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type Ctx = { params: Promise<{ universeId: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const s = await getRequiredSession();
  const { universeId } = await params;
  const universe = await db.query.universes.findFirst({
    where: and(eq(universes.id, universeId), eq(universes.userId, s.user.id)),
  });
  if (!universe) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const chars = await db.query.universeCharacters.findMany({
    where: eq(universeCharacters.universeId, universeId),
    with: { states: true },
  });
  return NextResponse.json(chars);
}

export async function POST(req: Request, { params }: Ctx) {
  const s = await getRequiredSession();
  const { universeId } = await params;
  const universe = await db.query.universes.findFirst({
    where: and(eq(universes.id, universeId), eq(universes.userId, s.user.id)),
  });
  if (!universe) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { name, baseProfile, isAlive } = await req.json();
  const [c] = await db.insert(universeCharacters).values({
    universeId,
    name: name || "Unnamed Character",
    baseProfile: baseProfile || {},
    isAlive: isAlive ?? true,
  }).returning();
  return NextResponse.json(c, { status: 201 });
}
