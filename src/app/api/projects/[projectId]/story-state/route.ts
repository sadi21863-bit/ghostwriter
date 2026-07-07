export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { storyThreads, storyPromises, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { updatePromiseEmbedding } from "@/lib/story/promise-cross-reference";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership((await params).projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const threads = await db.query.storyThreads.findMany({
    where: eq(storyThreads.projectId, (await params).projectId),
    with: { promises: true },
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  return NextResponse.json({ threads });
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership((await params).projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  if (body.type === "thread") {
    const [thread] = await db.insert(storyThreads).values({
      projectId: (await params).projectId,
      name: body.name,
      threadType: body.threadType ?? "subplot",
      notes: body.notes ?? "",
    }).returning();
    return NextResponse.json(thread);
  }

  if (body.type === "promise") {
    const [promise] = await db.insert(storyPromises).values({
      projectId: (await params).projectId,
      threadId: body.threadId ?? null,
      setup: body.setup,
      setupChapterId: body.setupChapterId ?? null,
      payoffIntent: body.payoffIntent ?? "",
      priority: body.priority ?? "B",
    }).returning();
    if (promise) updatePromiseEmbedding(promise.id, promise.setup); // fire-and-forget, powers knowledge_audit's semantic cross-referencing
    return NextResponse.json(promise);
  }

  return NextResponse.json({ error: "type required: thread or promise" }, { status: 400 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership((await params).projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  if (body.threadId) {
    const [updated] = await db.update(storyThreads)
      .set({ status: body.status, resolvedAtChapterId: body.resolvedAtChapterId ?? null, notes: body.notes })
      .where(and(eq(storyThreads.id, body.threadId), eq(storyThreads.projectId, (await params).projectId)))
      .returning();
    return NextResponse.json(updated);
  }

  if (body.promiseId) {
    const [updated] = await db.update(storyPromises)
      .set({ status: body.status, payoffChapterId: body.payoffChapterId ?? null, payoffIntent: body.payoffIntent })
      .where(and(eq(storyPromises.id, body.promiseId), eq(storyPromises.projectId, (await params).projectId)))
      .returning();
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "threadId or promiseId required" }, { status: 400 });
}
