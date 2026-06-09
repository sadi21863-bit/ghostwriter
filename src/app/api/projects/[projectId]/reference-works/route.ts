export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { referenceWorks, projects } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getRequiredSession();
  const { projectId } = await params;

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
    columns: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { title, attributes } = await req.json();
  if (!title || typeof title !== "string") return NextResponse.json({ error: "title is required" }, { status: 400 });
  const [r] = await db
    .insert(referenceWorks)
    .values({ projectId, title, ...(attributes !== undefined && { attributes }) })
    .returning();
  return NextResponse.json(r, { status: 201 });
}
