export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { fromSession } from "@/lib/core/auth-decorators";
import { revertStoryTransaction } from "@/lib/core/handlers/story-history";
import { pgPostCommitHooks, pgStoryHistoryRepository } from "@/lib/core/pg-repositories";

/**
 * Phase 2 / v4 §13.1 slice 2 — revert one recorded transaction: every field
 * whose live value still equals the recorded `newValue` goes back to its
 * `oldValue`. Conflicts (a later edit moved a field) refuse the WHOLE revert
 * with 409 and include the conflict list in the body. An entity already gone
 * at the verify pass is a TYPED 422 (the `missing` list in the body), the
 * same outcome as the apply path's pre-check; only a genuine vanish between
 * the verify pass and the write stays a thrown error → Next 500. No body is
 * read.
 */
export async function POST(
  _: Request,
  { params }: { params: Promise<{ projectId: string; transactionId: string }> },
) {
  const s = await getRequiredSession();
  const { projectId, transactionId } = await params;
  const result = await revertStoryTransaction(
    fromSession(s),
    { projectId, transactionId },
    pgStoryHistoryRepository,
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
  );
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.reason,
        ...("conflicts" in result && result.conflicts ? { conflicts: result.conflicts } : {}),
        ...("missing" in result ? { missing: result.missing } : {}),
      },
      { status: result.status },
    );
  }
  return NextResponse.json({ transaction: result.transaction });
}
