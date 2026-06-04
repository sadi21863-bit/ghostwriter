export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  const session = await getRequiredSession();
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { violationType, purpose } = await req.json();
  if (!violationType) return NextResponse.json({ error: "violationType required" }, { status: 400 });

  const existing = ((project as any).intentionalViolations || {}) as Record<string, any>;
  existing[violationType] = { confirmed: true, purpose: purpose || "", timestamp: new Date().toISOString() };

  await db.update(projects)
    .set({ intentionalViolations: existing } as any)
    .where(eq(projects.id, params.projectId));

  return NextResponse.json({ success: true });
}

export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  const session = await getRequiredSession();
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ violations: (project as any).intentionalViolations || {} });
}
