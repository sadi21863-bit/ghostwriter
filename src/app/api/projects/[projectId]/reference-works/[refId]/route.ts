export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { fromSession } from "@/lib/core/auth-decorators";
import { pgReferenceWorkRepository } from "@/lib/core/pg-thread-reference-repos";
import { pgPostCommitHooks } from "@/lib/core/pg-repositories";
import { deleteReferenceWork } from "@/lib/core/handlers/reference-works";

/**
 * Phase 2 / v4 §7 — thin AUTH ADAPTER around the shared `deleteReferenceWork`
 * handler, mirroring `chapters/[chapterId]/route.ts`. No PATCH exists for
 * reference works — Style DNA attributes are edited by deleting and recreating
 * the row (see the handler's header), so the route stays delete-only.
 */
export async function DELETE(_: Request, { params }: { params: Promise<{ projectId: string; refId: string }> }) {
  const session = await getRequiredSession();
  const { projectId, refId } = await params;
  const result = await deleteReferenceWork(
    fromSession(session),
    { projectId, refId },
    pgReferenceWorkRepository,
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
