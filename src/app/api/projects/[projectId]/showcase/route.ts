export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, showcases } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { buildShowcasePreview } from "@/lib/showcase/preview";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

// Owner-side create/update + fetch for the showcase area. The slug (public
// link) is generated once at creation and never changes across edits — same
// token convention as readerSessions (randomBytes(24).toString("hex")).
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  if (!await verifyOwnership(projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { title, blurb, visibility } = await req.json();
  if (visibility && !["private", "unlisted", "public"].includes(visibility)) {
    return NextResponse.json({ error: "Invalid visibility value" }, { status: 400 });
  }

  const existing = await db.query.showcases.findFirst({ where: eq(showcases.projectId, projectId) });

  if (existing) {
    const [updated] = await db.update(showcases)
      .set({ title, blurb, visibility, updatedAt: new Date() })
      .where(eq(showcases.projectId, projectId))
      .returning();
    return NextResponse.json(updated);
  }

  const [created] = await db.insert(showcases).values({
    projectId,
    userId: s.user.id,
    slug: randomBytes(24).toString("hex"),
    title: title ?? "",
    blurb: blurb ?? "",
    visibility: visibility ?? "private",
  }).returning();

  return NextResponse.json(created);
}

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  if (!await verifyOwnership(projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const showcase = await db.query.showcases.findFirst({ where: eq(showcases.projectId, projectId) });

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: { chapters: true, characters: true, comicPages: { with: { panels: true } }, productionShots: true },
  });
  const comicPanels = (project?.comicPages ?? []).flatMap((p: any) => p.panels ?? []);
  const preview = buildShowcasePreview({
    chapters: project?.chapters,
    characters: project?.characters,
    comicPanels,
    productionShots: project?.productionShots as any,
  });

  return NextResponse.json({ showcase: showcase ?? null, preview });
}
