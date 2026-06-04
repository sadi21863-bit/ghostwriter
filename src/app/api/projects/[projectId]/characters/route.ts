export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { characters, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
export async function POST(req: Request, { params }: { params: { projectId: string } }){
  const session = await getRequiredSession();
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)) });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json();
  const [r] = await db.insert(characters).values({ projectId: params.projectId, ...b }).returning();
  return NextResponse.json(r, { status: 201 });
}