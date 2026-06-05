export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { characters, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const CharacterPatch = z.object({
  name: z.string().min(1).optional(),
  role: z.string().optional(),
  age: z.string().optional(),
  appearance: z.string().optional(),
  personality: z.string().optional(),
  thinkingStyle: z.string().optional(),
  behavior: z.string().optional(),
  habits: z.string().optional(),
  fears: z.string().optional(),
  desires: z.string().optional(),
  speechPattern: z.string().optional(),
  backstory: z.string().optional(),
  arc: z.string().optional(),
  portraitUrl: z.string().optional(),
  linkedLocationIds: z.array(z.string().uuid()).optional(),
  linkedPlotThreadIds: z.array(z.string().uuid()).optional(),
  alwaysInContext: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.userId, userId)) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ projectId: string; characterId: string }> }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership((await params).projectId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = CharacterPatch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
  const [u] = await db.update(characters).set(parsed.data).where(eq(characters.id, (await params).characterId)).returning();
  return NextResponse.json(u);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ projectId: string; characterId: string }> }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership((await params).projectId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.delete(characters).where(eq(characters.id, (await params).characterId));
  return NextResponse.json({ ok: true });
}
