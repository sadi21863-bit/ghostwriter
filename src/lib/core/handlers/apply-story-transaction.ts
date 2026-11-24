/**
 * Phase 2 / v4 §7 + §13.1 — `applyStoryTransaction`, the fourth shared handler.
 *
 * §13.1's core rule: **"Model output proposes canon changes; no AI call mutates
 * canonical state directly."**
 *
 * Today that rule holds only by accident of plumbing. `useEntitySync` builds a
 * patch from `diffEntity`'s changes and PATCHes the entity from the BROWSER, so
 * the mutation inherits the user's session and is triggered by a click. The field
 * names are safe (they come from the fixed `DIFF_FIELDS` table, not from model
 * output), but nothing on the server records that the write originated from
 * model output, and nothing can revert it.
 *
 * This handler makes the rule explicit and auditable:
 *
 *  - every proposed field is validated against the SAME allowlist the client
 *    uses, so a hand-crafted transaction cannot write `id`, `projectId` or
 *    `embedding`;
 *  - the whole transaction is applied or none of it is (no partial canon state);
 *  - the transaction and every change are persisted with their provenance, which
 *    is what makes revert and audit possible;
 *  - `onCanonicalMutation` fires so §11's revision increment has a home.
 *
 * The persisted `StoryTransaction` / `StoryChange` tables (§13.1 slice 1) are
 * implemented by `pgStoryTransactionRepository` in pg-repositories: `record`
 * writes one atomic `db.batch` (transaction + ordered changes), `applyChanges`
 * pre-checks every referenced entity then applies grouped, scoped, batched
 * updates verified via `.returning()`. The port below is their contract.
 */

import { DIFF_FIELDS, type EntityKey } from "@/lib/ai/entity-extraction";
import type { RequestContext } from "@/lib/core/request-context";
import type { PostCommitHooks } from "@/lib/core/repositories";

export type { EntityKey };

/** Where a proposed change came from. Recorded so an audit can tell AI from human. */
export type TransactionSource = "model-proposal" | "user-edit" | "import";

export interface StoryChange {
  readonly entityKey: EntityKey;
  readonly entityId: string;
  readonly field: string;
  readonly oldValue: string;
  readonly newValue: string;
}

export interface StoryTransaction {
  readonly id: string;
  readonly projectId: string;
  readonly source: TransactionSource;
  readonly createdAt: Date;
  readonly changes: readonly StoryChange[];
  /** Generation that produced this transaction, when it came from model output. */
  readonly sourceGenerationId?: string;
}

export interface StoryTransactionRepository {
  ownsProject(projectId: string, actorId: string): Promise<boolean>;
  /** Persist the transaction and its changes for audit/revert. */
  record(tx: StoryTransaction): Promise<void>;
  /** Apply the changes to canonical state. Must be all-or-nothing. */
  applyChanges(projectId: string, tx: StoryTransaction): Promise<void>;
}

/** Typed failure of an all-or-nothing apply: entities vanished between
 * validation and the pre-check. Carries the missing refs for the route body. */
export class MissingEntitiesError extends Error {
  readonly missing: readonly { entityKey: EntityKey; entityId: string }[];
  constructor(missing: readonly { entityKey: EntityKey; entityId: string }[], context: string) {
    super(`${context}: ${missing.map((m) => `${m.entityKey}#${m.entityId}`).join(", ")}`);
    this.name = "MissingEntitiesError";
    this.missing = missing;
  }
}

export type ApplyStoryTransactionResult =
  | { ok: true; transaction: StoryTransaction }
  | {
      ok: false;
      status: 403 | 404 | 422;
      reason: string;
      rejected?: readonly StoryChange[];
      /** Set ONLY on the 422 missing-entities arm: the refs the pre-check could
       * not find. The transaction was recorded; nothing was applied. */
      missing?: readonly { entityKey: EntityKey; entityId: string }[];
    };

/** The fields a model or client may ever write, per entity type. */
export function writableFields(key: EntityKey): ReadonlySet<string> {
  return new Set(DIFF_FIELDS[key].map((f) => f.field));
}

export function isWritableField(key: EntityKey, field: string): boolean {
  return writableFields(key).has(field);
}

export type ChangeValidation = { ok: true; valid: readonly StoryChange[] } | {
  ok: false;
  rejected: readonly StoryChange[];
  reasons: readonly string[];
};

/**
 * Reject any change naming a field outside the allowlist, a non-string value, or
 * a change to an entity type we do not recognise. Validating here rather than at
 * the repository is the point: the repository should never have to be the only
 * thing standing between model output and canon.
 */
export function validateChanges(changes: unknown): ChangeValidation {
  // A non-array payload is a CALLER error, not an empty transaction. Coercing
  // garbage to `[]` would make a broken caller look like a successful no-op,
  // hiding the bug instead of surfacing it.
  if (!Array.isArray(changes)) {
    return {
      ok: false,
      rejected: [changes as StoryChange],
      reasons: ["changes must be an array"],
    };
  }
  const list = changes;
  const valid: StoryChange[] = [];
  const rejected: StoryChange[] = [];
  const reasons: string[] = [];

  for (const raw of list) {
    if (!raw || typeof raw !== "object") {
      rejected.push(raw as StoryChange);
      reasons.push("change is not an object");
      continue;
    }
    const c = raw as Record<string, unknown>;
    const key = c.entityKey as EntityKey;
    if (!DIFF_FIELDS[key]) {
      rejected.push(c as unknown as StoryChange);
      reasons.push(`unknown entity type "${String(c.entityKey)}"`);
      continue;
    }
    if (typeof c.entityId !== "string" || !c.entityId) {
      rejected.push(c as unknown as StoryChange);
      reasons.push("missing entityId");
      continue;
    }
    if (typeof c.field !== "string" || !isWritableField(key, c.field)) {
      rejected.push(c as unknown as StoryChange);
      reasons.push(`field "${String(c.field)}" is not writable on ${key}`);
      continue;
    }
    if (typeof c.newValue !== "string") {
      rejected.push(c as unknown as StoryChange);
      reasons.push(`newValue for ${key}.${c.field} must be a string`);
      continue;
    }
    valid.push({
      entityKey: key,
      entityId: c.entityId,
      field: c.field,
      oldValue: typeof c.oldValue === "string" ? c.oldValue : "",
      newValue: c.newValue,
    });
  }

  return rejected.length
    ? { ok: false, rejected, reasons }
    : { ok: true, valid };
}

export interface ApplyStoryTransactionInput {
  projectId: string;
  source: TransactionSource;
  changes: unknown;
  sourceGenerationId?: string;
  /** Injected so the handler stays deterministic and testable. */
  id?: string;
  now?: Date;
}

export async function applyStoryTransaction(
  ctx: RequestContext,
  input: ApplyStoryTransactionInput,
  repo: StoryTransactionRepository,
  hooks: PostCommitHooks = {},
): Promise<ApplyStoryTransactionResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }

  const validation = validateChanges(input.changes);
  if (!validation.ok) {
    // Reject the WHOLE transaction. Applying the valid subset would leave canon
    // in a state the user never agreed to.
    return {
      ok: false,
      status: 422,
      reason: validation.reasons[0] ?? "Invalid transaction.",
      rejected: validation.rejected,
    };
  }

  const tx: StoryTransaction = {
    id: input.id ?? newId(),
    projectId: input.projectId,
    source: input.source,
    createdAt: input.now ?? new Date(),
    changes: validation.valid,
    ...(input.sourceGenerationId ? { sourceGenerationId: input.sourceGenerationId } : {}),
  };

  // Record BEFORE applying: an audit trail that can miss the write it describes
  // is worse than none, because it looks complete.
  await repo.record(tx);
  try {
    await repo.applyChanges(input.projectId, tx);
  } catch (err) {
    if (err instanceof MissingEntitiesError) {
      // The transaction IS on the audit trail (audit-first order is unchanged);
      // the apply simply found its entities gone. A typed 422 says so honestly
      // instead of a thrown error masking the recorded row as a server fault.
      return {
        ok: false,
        status: 422,
        reason: "Some referenced entities no longer exist; the transaction was recorded but nothing was applied.",
        missing: err.missing,
      };
    }
    throw err;
  }

  // §11: canon moved, so the project's revision must move with it.
  await hooks.onCanonicalMutation?.(input.projectId, `storyTransaction.${input.source}`);

  return { ok: true, transaction: tx };
}

function newId(): string {
  // Injectable via `input.id`; this fallback only exists so the handler has no
  // hard dependency on Node's crypto in a module that must stay portable.
  return `tx_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}
