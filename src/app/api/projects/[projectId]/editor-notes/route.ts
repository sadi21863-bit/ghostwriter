export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { editorNotes, chapters, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const NOTE_STATUS = ["open", "resolved", "dismissed"];
const REVIEW_STATUS = ["draft", "in_review", "approved"];

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

function noteRow(projectId: string, n: any) {
  return {
    projectId,
    chapterId: n.chapterId ?? null,
    type: n.type === "suggestion" ? "suggestion" : "issue",
    severity: ["high", "medium", "low"].includes(n.severity) ? n.severity : "medium",
    category: typeof n.category === "string" && n.category ? n.category.slice(0, 24) : "general",
    message: String(n.message),
    suggestedFix: n.suggestedFix ? String(n.suggestedFix) : "",
    source: ["manual", "story_health", "aiisms", "quality_check"].includes(n.source) ? n.source : "manual",
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  if (!await verifyOwnership(projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const chapterId = url.searchParams.get("chapterId");
  const notes = await db.query.editorNotes.findMany({
    where: and(
      eq(editorNotes.projectId, projectId),
      ...(status ? [eq(editorNotes.status, status)] : []),
      ...(chapterId ? [eq(editorNotes.chapterId, chapterId)] : []),
    ),
    orderBy: (n, { desc }) => [desc(n.createdAt)],
  });
  return NextResponse.json({ notes });
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  if (!await verifyOwnership(projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  if (Array.isArray(body.notes)) {
    const rows = body.notes.filter((n: any) => n?.message).map((n: any) => noteRow(projectId, n));
    if (rows.length === 0) return NextResponse.json({ error: "No valid notes." }, { status: 400 });
    const inserted = await db.insert(editorNotes).values(rows).returning();
    return NextResponse.json({ notes: inserted });
  }
  if (!body.message) return NextResponse.json({ error: "message or notes required" }, { status: 400 });
  const [note] = await db.insert(editorNotes).values(noteRow(projectId, body)).returning();
  return NextResponse.json({ note });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  if (!await verifyOwnership(projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { noteId, status, chapterId, reviewStatus } = await req.json();

  // Approve-gate: update a chapter's reviewStatus.
  if (chapterId !== undefined && reviewStatus !== undefined) {
    if (!REVIEW_STATUS.includes(reviewStatus))
      return NextResponse.json({ error: "Invalid reviewStatus." }, { status: 400 });
    const [updated] = await db.update(chapters).set({ reviewStatus, updatedAt: new Date() })
      .where(and(eq(chapters.id, chapterId), eq(chapters.projectId, projectId)))
      .returning();
    return NextResponse.json({ chapter: updated });
  }

  // Note status change (resolve/dismiss/reopen).
  if (noteId !== undefined && status !== undefined) {
    if (!NOTE_STATUS.includes(status))
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    const [updated] = await db.update(editorNotes).set({ status, updatedAt: new Date() })
      .where(and(eq(editorNotes.id, noteId), eq(editorNotes.projectId, projectId)))
      .returning();
    return NextResponse.json({ note: updated });
  }

  return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  if (!await verifyOwnership(projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { noteId } = await req.json();
  await db.delete(editorNotes).where(and(eq(editorNotes.id, noteId), eq(editorNotes.projectId, projectId)));
  return NextResponse.json({ ok: true });
}
