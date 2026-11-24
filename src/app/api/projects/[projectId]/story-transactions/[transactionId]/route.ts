export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { fromSession } from "@/lib/core/auth-decorators";
import { getStoryTransaction } from "@/lib/core/handlers/story-history";
import { pgStoryHistoryRepository } from "@/lib/core/pg-repositories";

/**
 * Phase 2 / v4 §13.1 slice 2 — one recorded transaction with its changes
 * (audit read). 404 when no such transaction exists in the caller's project.
 */
export async function GET(
  _: Request,
  { params }: { params: Promise<{ projectId: string; transactionId: string }> },
) {
  const s = await getRequiredSession();
  const { projectId, transactionId } = await params;
  const result = await getStoryTransaction(
    fromSession(s),
    { projectId, transactionId },
    pgStoryHistoryRepository,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json({ transaction: result.transaction });
}
