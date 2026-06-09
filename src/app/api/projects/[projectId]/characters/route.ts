export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { characters, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }){
  const session = await getRequiredSession();
  const { projectId } = await params;
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)) });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const { name, role, age, appearance, personality, thinkingStyle, behavior, habits, fears, desires,
    speechPattern, backstory, arc, alwaysInContext, sortOrder, contextVisibility } = body;
  if (!name || typeof name !== "string") return NextResponse.json({ error: "name is required" }, { status: 400 });
  const [r] = await db.insert(characters).values({
    projectId, name, role, age, appearance, personality, thinkingStyle, behavior, habits, fears,
    desires, speechPattern, backstory, arc, alwaysInContext, sortOrder, contextVisibility,
  }).returning();
  return NextResponse.json(r, { status: 201 });
}