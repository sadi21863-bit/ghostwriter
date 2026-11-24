export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { fromSession } from "@/lib/core/auth-decorators";
import {
  applyStoryTransaction,
  type TransactionSource,
} from "@/lib/core/handlers/apply-story-transaction";
import { listStoryTransactions } from "@/lib/core/handlers/story-history";
import {
  pgPostCommitHooks,
  pgStoryHistoryRepository,
  pgStoryTransactionRepository,
} from "@/lib/core/pg-repositories";

/**
 * Phase 2 / v4 §13.1 slice 1 — thin auth adapter for `applyStoryTransaction`.
 *
 * New endpoint. Nothing calls it yet (the browser path still PATCHes entities
 * directly via useEntitySync), so this is additive and changes no existing
 * behaviour. It exists so server-side callers — and a local Story OS host —
 * can push model-output-driven canon edits through the SAME record-first,
 * allowlisted, all-or-nothing path, with §11's revision bump firing after.
 *
 * Error mapping: handler-union statuses (403/404/422) pass through; request
 * shape problems are rejected here at 400 (invalid source, missing changes,
 * unparseable JSON). A transaction whose entities do not exist still fails
 * AFTER record() by design — audit-first order is unchanged — but that
 * outcome is now TYPED: the handler returns a 422 and this route spreads
 * `missing` (the vanished refs) into the body next to the existing
 * conditional `rejected` spread. The two are mutually exclusive: `rejected`
 * only comes from pre-record validation, `missing` only from the post-record
 * pre-check, so a body carries whichever failed, never both. Only a genuine
 * vanished-BETWEEN-pre-check-and-write race (0-row batch) remains a thrown
 * error → Next 500.
 */
const SOURCES: readonly string[] = ["model-proposal", "user-edit", "import"];

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawSource = body.source;
  if (typeof rawSource !== "string" || !SOURCES.includes(rawSource)) {
    return NextResponse.json(
      { error: 'source must be one of "model-proposal" | "user-edit" | "import"' },
      { status: 400 },
    );
  }
  if (!("changes" in body)) {
    return NextResponse.json({ error: "changes is required" }, { status: 400 });
  }

  const result = await applyStoryTransaction(
    fromSession(s),
    {
      projectId,
      source: rawSource as TransactionSource,
      changes: body.changes,
      ...(typeof body.sourceGenerationId === "string"
        ? { sourceGenerationId: body.sourceGenerationId }
        : {}),
    },
    pgStoryTransactionRepository,
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.reason,
        ...(result.rejected ? { rejected: result.rejected } : {}),
        ...(result.missing ? { missing: result.missing } : {}),
      },
      { status: result.status },
    );
  }
  return NextResponse.json({ transaction: result.transaction });
}

/**
 * Phase 2 / v4 §13.1 slice 2 — GET the latest recorded transactions (audit
 * read, newest first); the pg adapter caps at 50. No query parameters: the
 * loopback local host cannot see them, and the local routes mirror this exactly.
 */
export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  const result = await listStoryTransactions(fromSession(s), { projectId }, pgStoryHistoryRepository);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json({ transactions: result.transactions, count: result.count });
}
