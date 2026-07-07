export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { chapters, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { tiptapToPlainText, isValidTipTapJson } from "@/lib/editor/content-migration";
import { updateChapterEmbedding } from "@/lib/ai/author-voice";

type Ctx = { params: Promise<{ projectId: string; chapterId: string }> };

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.userId, userId)) });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const s = await getRequiredSession();
  const { projectId, chapterId } = await params;
  if (!await verifyOwnership(projectId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json();
  if (b.content !== undefined) {
    const plain = isValidTipTapJson(b.content) ? tiptapToPlainText(JSON.parse(b.content)) : b.content;
    b.wordCount = plain.trim().split(/\s+/).filter(Boolean).length;
  }
  const [u] = await db.update(chapters).set({ ...b, updatedAt: new Date() })
    .where(and(eq(chapters.id, chapterId), eq(chapters.projectId, projectId)))
    .returning();
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Only fires once the scoped update above confirms chapterId truly belongs
  // to this project — never fire on attacker-supplied chapterId/projectId
  // combos that didn't actually match a row (fire-and-forget, never blocks the save).
  if (b.content !== undefined) updateChapterEmbedding(chapterId, b.content);
  return NextResponse.json(u);
}

export async function DELETE(_: Request, { params }: Ctx) {
  const s = await getRequiredSession();
  const { projectId, chapterId } = await params;
  if (!await verifyOwnership(projectId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.delete(chapters).where(and(eq(chapters.id, chapterId), eq(chapters.projectId, projectId)));
  return NextResponse.json({ ok: true });
}
