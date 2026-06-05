export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { referenceWorks, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
export async function DELETE(_: Request, { params }: { params: Promise<{ projectId: string; refId: string }> }){
  const session = await getRequiredSession();
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, (await params).projectId), eq(projects.userId, session.user.id)) });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.delete(referenceWorks).where(and(eq(referenceWorks.id, (await params).refId), eq(referenceWorks.projectId, (await params).projectId)));
  return NextResponse.json({ ok: true });
}