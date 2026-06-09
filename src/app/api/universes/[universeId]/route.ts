export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { universes, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type Ctx = { params: Promise<{ universeId: string }> };

async function verifyOwnership(universeId: string, userId: string) {
  return db.query.universes.findFirst({ where: and(eq(universes.id, universeId), eq(universes.userId, userId)) });
}

export async function GET(_: Request, { params }: Ctx) {
  const s = await getRequiredSession();
  const { universeId } = await params;
  const u = await db.query.universes.findFirst({
    where: and(eq(universes.id, universeId), eq(universes.userId, s.user.id)),
    with: {
      characters: true,
      events: { orderBy: (e, { asc }) => [asc(e.timelineSort)] },
    },
  });
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(u);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const s = await getRequiredSession();
  const { universeId } = await params;
  if (!await verifyOwnership(universeId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { name, premise, tone, sharedRules } = await req.json();
  const [u] = await db.update(universes).set({
    ...(name !== undefined && { name }),
    ...(premise !== undefined && { premise }),
    ...(tone !== undefined && { tone }),
    ...(sharedRules !== undefined && { sharedRules }),
    updatedAt: new Date(),
  }).where(and(eq(universes.id, universeId), eq(universes.userId, s.user.id))).returning();
  return NextResponse.json(u);
}

export async function DELETE(_: Request, { params }: Ctx) {
  const s = await getRequiredSession();
  const { universeId } = await params;
  if (!await verifyOwnership(universeId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Orphan linked projects back to standalone
  await db.update(projects)
    .set({ universeId: null, storyType: "linear" })
    .where(eq(projects.universeId, universeId));
  await db.delete(universes).where(and(eq(universes.id, universeId), eq(universes.userId, s.user.id)));
  return NextResponse.json({ ok: true });
}
