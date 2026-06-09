export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { locations, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }){
  const session = await getRequiredSession();
  const { projectId } = await params;
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)) });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { name, description, atmosphere, history, sensoryDetails, alwaysInContext, sortOrder } = await req.json();
  if (!name || typeof name !== "string") return NextResponse.json({ error: "name is required" }, { status: 400 });
  const [r] = await db.insert(locations).values({
    projectId, name, description, atmosphere, history, sensoryDetails, alwaysInContext, sortOrder,
  }).returning();
  return NextResponse.json(r, { status: 201 });
}