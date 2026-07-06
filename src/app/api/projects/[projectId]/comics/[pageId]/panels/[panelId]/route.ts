export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { comicPanels, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ projectId: string; pageId: string; panelId: string }> }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership((await params).projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const allowed = ["dialogue", "caption", "speakerName", "bubbleType", "reviewStatus", "panelIndex", "candidateImageUrls"];
  const update: Record<string, any> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  // Phase C "keep N candidates" — promote a candidate to primary, same pattern
  // as the shots route: the old primary goes back into the candidates array.
  if (typeof body?.promoteCandidateUrl === "string") {
    const current = await db.query.comicPanels.findFirst({
      where: and(eq(comicPanels.id, (await params).panelId), eq(comicPanels.projectId, (await params).projectId)),
    });
    if (!current) return NextResponse.json({ error: "Panel not found" }, { status: 404 });
    const promoted: string = body.promoteCandidateUrl;
    const existingCandidates: string[] = (current as any).candidateImageUrls ?? [];
    if (!existingCandidates.includes(promoted)) {
      return NextResponse.json({ error: "Not a known candidate for this panel." }, { status: 400 });
    }
    const nextCandidates = existingCandidates.filter(u => u !== promoted);
    if (current.imageUrl) nextCandidates.push(current.imageUrl);
    update.imageUrl = promoted;
    update.candidateImageUrls = nextCandidates;
  }

  const [updated] = await db
    .update(comicPanels)
    .set(update)
    .where(and(eq(comicPanels.id, (await params).panelId), eq(comicPanels.projectId, (await params).projectId)))
    .returning();

  return NextResponse.json(updated);
}
