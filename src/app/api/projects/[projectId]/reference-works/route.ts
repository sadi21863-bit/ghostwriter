export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { referenceWorks, projects } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const session = await getRequiredSession();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)),
    columns: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const [r] = await db
    .insert(referenceWorks)
    .values({ projectId: params.projectId, ...body })
    .returning();
  return NextResponse.json(r, { status: 201 });
}
