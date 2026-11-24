export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { fromSession } from "@/lib/core/auth-decorators";
import {
  createStoryPromise,
  createStoryThread,
  listStoryState,
  updateStoryPromise,
  updateStoryThread,
} from "@/lib/core/handlers/story-state";
import { pgStoryStateRepository } from "@/lib/core/pg-story-os-repos";
import { pgPostCommitHooks } from "@/lib/core/pg-repositories";
import { updatePromiseEmbedding } from "@/lib/story/promise-cross-reference";

/**
 * Phase 2 / v4 §7 — thin auth adapters around the shared story-state handlers.
 * The ownership probe and the writes moved to `pg-story-os-repos.ts`; the
 * `type`/`threadId`/`promiseId` discriminators and their 400s stay here, in the
 * original order (ownership BEFORE the body is read, so a wrong-project caller
 * with a malformed body still 404s).
 */
const hooks = { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation };

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const result = await listStoryState(
    fromSession(s),
    { projectId: (await params).projectId },
    pgStoryStateRepository,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json({ threads: result.threads });
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  if (!(await pgStoryStateRepository.ownsProject(projectId, s.user.id)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  if (body.type === "thread") {
    const result = await createStoryThread(
      fromSession(s),
      { projectId, data: { name: body.name, threadType: body.threadType, notes: body.notes } },
      pgStoryStateRepository,
      hooks,
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: result.status });
    }
    return NextResponse.json(result.thread);
  }

  if (body.type === "promise") {
    const result = await createStoryPromise(
      fromSession(s),
      {
        projectId,
        data: {
          threadId: body.threadId,
          setup: body.setup,
          setupChapterId: body.setupChapterId,
          payoffIntent: body.payoffIntent,
          priority: body.priority,
        },
      },
      pgStoryStateRepository,
      hooks,
      // fire-and-forget, powers knowledge_audit's semantic cross-referencing
      (promiseId, setup) => updatePromiseEmbedding(promiseId, setup),
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: result.status });
    }
    return NextResponse.json(result.promise);
  }

  return NextResponse.json({ error: "type required: thread or promise" }, { status: 400 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  if (!(await pgStoryStateRepository.ownsProject(projectId, s.user.id)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  if (body.threadId) {
    const result = await updateStoryThread(
      fromSession(s),
      {
        projectId,
        threadId: body.threadId,
        patch: {
          status: body.status,
          resolvedAtChapterId: body.resolvedAtChapterId,
          notes: body.notes,
        },
      },
      pgStoryStateRepository,
      hooks,
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: result.status });
    }
    return NextResponse.json(result.thread);
  }

  if (body.promiseId) {
    const result = await updateStoryPromise(
      fromSession(s),
      {
        projectId,
        promiseId: body.promiseId,
        patch: {
          status: body.status,
          payoffChapterId: body.payoffChapterId,
          payoffIntent: body.payoffIntent,
        },
      },
      pgStoryStateRepository,
      hooks,
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: result.status });
    }
    return NextResponse.json(result.promise);
  }

  return NextResponse.json({ error: "threadId or promiseId required" }, { status: 400 });
}
