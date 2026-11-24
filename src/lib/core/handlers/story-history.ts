/**
 * Phase 2 / v4 §13.1 slice 2 — audit + revert handlers over the
 * story-transaction trail that slice 1 began persisting.
 *
 * The port lives here (same pattern as `get-story-bible.ts`): a transport-free
 * interface the pg adapter in `pg-repositories.ts` implements and the loopback
 * local host can stub. `revertChanges` deliberately RETURNS conflicts instead
 * of throwing: "a later edit moved a field past this transaction's newValue"
 * is an expected user-visible outcome (HTTP 409), not a server failure. An
 * entity already gone at the verify pass is equally expected — `revertChanges`
 * throws the typed `MissingEntitiesError` and the handler maps it to a 422
 * carrying the missing refs; only a genuine vanished-between-check-and-write
 * race stays a plain thrown error (500-class server fault).
 */
import type { RequestContext } from "@/lib/core/request-context";
import type { PostCommitHooks } from "@/lib/core/repositories";
import { MissingEntitiesError } from "@/lib/core/handlers/apply-story-transaction";
import type {
  EntityKey,
  StoryChange,
  TransactionSource,
} from "@/lib/core/handlers/apply-story-transaction";

/** A persisted transaction with its changes — the audit/recall read shape. */
export interface StoryTransactionSummary {
  readonly id: string;
  readonly source: TransactionSource;
  readonly sourceGenerationId?: string;
  readonly createdAt: Date;
  readonly changes: readonly StoryChange[];
}

/** One field whose live value has moved past the transaction's `newValue` —
 * blindly reverting it would clobber newer work, so it is refused. */
export interface RevertConflict {
  readonly entityKey: EntityKey;
  readonly entityId: string;
  readonly field: string;
  readonly current: string;
}

export interface StoryHistoryRepository {
  ownsProject(projectId: string, actorId: string): Promise<boolean>;
  /** Audit read: newest transactions first, host-capped (pg: latest 50). */
  listTransactions(projectId: string): Promise<readonly StoryTransactionSummary[]>;
  /** One transaction with its changes; null when it is not in this project. */
  getTransaction(projectId: string, transactionId: string): Promise<StoryTransactionSummary | null>;
  /**
   * Verify + apply the inverse of EVERY change in one all-or-nothing pass:
   * each field whose live value still equals the change's `newValue` goes back
   * to `oldValue`. Returns the conflicting changes (nothing was written) or []
   * (applied). Throws `MissingEntitiesError` (carrying the vanished refs) when
   * an entity is already gone at the verify pass, mirroring
   * `StoryTransactionRepository.applyChanges`; a genuine vanished BETWEEN
   * check and write (0-row batch) stays a plain thrown error — that is a race,
   * not an expected outcome.
   */
  revertChanges(
    projectId: string,
    changes: readonly StoryChange[],
  ): Promise<readonly RevertConflict[]>;
}

export type ListStoryTransactionsResult =
  | { ok: true; transactions: readonly StoryTransactionSummary[]; count: number }
  | { ok: false; status: 403 | 404; reason: string };

export type GetStoryTransactionResult =
  | { ok: true; transaction: StoryTransactionSummary }
  | { ok: false; status: 403 | 404; reason: string };

export type RevertStoryTransactionResult =
  | { ok: true; transaction: StoryTransactionSummary }
  | { ok: false; status: 403 | 404 | 409; reason: string; conflicts?: readonly RevertConflict[] }
  | {
      ok: false;
      status: 422;
      reason: string;
      /** Set ONLY on this typed arm: the refs the verify pass could not find.
       * The transaction was NOT reverted. `missing` is mandatory here so a
       * consumer on this arm never has to defend against an empty list. */
      missing: readonly { entityKey: EntityKey; entityId: string }[];
    };

export async function listStoryTransactions(
  ctx: RequestContext,
  input: { projectId: string },
  repo: StoryHistoryRepository,
): Promise<ListStoryTransactionsResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  const transactions = await repo.listTransactions(input.projectId);
  return { ok: true, transactions, count: transactions.length };
}

/** Phase 2 / v4 §13.1 slice 2. Audit read of one recorded transaction. */
export async function getStoryTransaction(
  ctx: RequestContext,
  input: { projectId: string; transactionId: string },
  repo: StoryHistoryRepository,
): Promise<GetStoryTransactionResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  const transaction = await repo.getTransaction(input.projectId, input.transactionId);
  if (transaction === null) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  return { ok: true, transaction };
}

/**
 * Revert one recorded transaction: every field whose live value still equals
 * the recorded `newValue` is set back to `oldValue`, all-or-nothing. Conflicts
 * (a later edit moved the field) refuse the WHOLE revert with 409 — audit
 * semantics beat blind overwrites. Fires `onCanonicalMutation` with kind
 * "storyTransaction.revert" only when something actually changed.
 */
export async function revertStoryTransaction(
  ctx: RequestContext,
  input: { projectId: string; transactionId: string },
  repo: StoryHistoryRepository,
  hooks: PostCommitHooks = {},
): Promise<RevertStoryTransactionResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  const transaction = await repo.getTransaction(input.projectId, input.transactionId);
  if (transaction === null) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  if (transaction.changes.length === 0) {
    return { ok: true, transaction };
  }
  let conflicts: readonly RevertConflict[];
  try {
    conflicts = await repo.revertChanges(input.projectId, transaction.changes);
  } catch (err) {
    if (err instanceof MissingEntitiesError) {
      // Same typed outcome as the apply path's pre-check: the verify pass found
      // an entity already gone, so nothing was reverted. A 422 with the refs
      // says so honestly instead of a thrown error masking an expected audit
      // outcome as a server fault.
      return {
        ok: false,
        status: 422,
        reason: "Some referenced entities no longer exist; nothing was reverted.",
        missing: err.missing,
      };
    }
    throw err;
  }
  if (conflicts.length > 0) {
    return {
      ok: false,
      status: 409,
      reason: "Later edits conflict with this revert; nothing was changed.",
      conflicts,
    };
  }
  await hooks.onCanonicalMutation?.(input.projectId, "storyTransaction.revert");
  return { ok: true, transaction };
}
