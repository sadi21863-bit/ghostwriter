export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { fromSession } from "@/lib/core/auth-decorators";
import {
  createStoryMemory,
  deleteStoryMemory,
  listStoryMemories,
} from "@/lib/core/handlers/story-memories";
import { pgStoryMemoryRepository } from "@/lib/core/pg-story-os-repos";
import { pgPostCommitHooks } from "@/lib/core/pg-repositories";

/**
 * Phase 2 / v4 §7 — thin auth adapters around the shared story-memory handlers.
 * The ownership probe and the writes moved to `pg-story-os-repos.ts`; the
 * `fact is required` 400 stays here (transport validation, in the original
 * order — ownership BEFORE the body is read), while the structuredData
 * normalization lives in the handler (it never rejects, so it is persistence
 * shaping, not a transport error).
 */
const hooks = { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation };

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const result = await listStoryMemories(
    fromSession(s),
    { projectId: (await params).projectId },
    pgStoryMemoryRepository,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json(result.memories);
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  if (!(await pgStoryMemoryRepository.ownsProject(projectId, s.user.id)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { fact, category = "general", structuredData } = await req.json();
  if (!fact?.trim()) return NextResponse.json({ error: "fact required" }, { status: 400 });

  const result = await createStoryMemory(
    fromSession(s),
    { projectId, fact, category, structuredData },
    pgStoryMemoryRepository,
    hooks,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json(result.memory);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  if (!(await pgStoryMemoryRepository.ownsProject(projectId, s.user.id)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { memoryId } = await req.json();
  const result = await deleteStoryMemory(
    fromSession(s),
    { projectId, memoryId },
    pgStoryMemoryRepository,
    hooks,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
