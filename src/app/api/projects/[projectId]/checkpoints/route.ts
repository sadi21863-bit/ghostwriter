export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/auth-helpers';
import { fromSession } from '@/lib/core/auth-decorators';
import {
  createCheckpoint,
  deleteCheckpoint,
  listCheckpoints,
} from '@/lib/core/handlers/story-checkpoints';
import { pgStoryCheckpointRepository } from '@/lib/core/pg-story-os-repos';
import { pgPostCommitHooks } from '@/lib/core/pg-repositories';

/**
 * Phase 2 / v4 §7 — thin auth adapters around the shared checkpoint handlers.
 * The ownership probe, the health read, the healthScore formula, and the writes
 * moved to `pg-story-os-repos.ts` / the handler; the body parsing stays here in
 * the original order (body read BEFORE the ownership probe, as the old route ran
 * it). DELETE keeps its distinctive `{ success: true }` response body.
 */
const hooks = { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation };

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const result = await listCheckpoints(
    fromSession(s),
    { projectId: (await params).projectId },
    pgStoryCheckpointRepository,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json({ checkpoints: result.checkpoints });
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  const { name, notes } = await req.json();

  const result = await createCheckpoint(
    fromSession(s),
    { projectId, name, notes },
    pgStoryCheckpointRepository,
    hooks,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json({ checkpoint: result.checkpoint });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  const { checkpointId } = await req.json();

  const result = await deleteCheckpoint(
    fromSession(s),
    { projectId, checkpointId },
    pgStoryCheckpointRepository,
    hooks,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json({ success: true });
}
