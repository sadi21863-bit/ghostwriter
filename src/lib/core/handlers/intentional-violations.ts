/**
 * Phase 2 / v4 §7 — intentional-violation acknowledgements as shared handlers.
 *
 * Previously inlined in `src/app/api/projects/[projectId]/intentional-violation/
 * route.ts`: an ownership probe on the projects row plus a jsonb merge. The
 * handlers below take a RequestContext and a repository port — no NextAuth, no
 * `@/db`, no `next/server` — so a local host can serve the same rules without
 * forking this file. Mirror of `world-entities.ts`'s structure: scope 403 →
 * ownership 404 ("Not found") → transport 400, in that order.
 *
 * The acknowledgement transformation is preserved verbatim from the route:
 * entries are keyed by `violationType`, so re-acknowledging one REPLACES its
 * previous entry (the schema value is a single
 * `{confirmed, purpose, timestamp}` record, not an array — that IS the dedupe
 * semantics), `purpose` falls back to `""` when falsy, and the timestamp is
 * stamped at write time.
 */

import type { RequestContext } from "@/lib/core/request-context";
import type { PostCommitHooks } from "@/lib/core/repositories";

export interface IntentionalViolationEntry {
  confirmed: boolean;
  purpose: string;
  timestamp: string;
}

export type IntentionalViolationMap = Record<string, IntentionalViolationEntry>;

export interface IntentionalViolationRepository {
  /** True when the project exists and belongs to this actor. */
  ownsProject(projectId: string, actorId: string): Promise<boolean>;
  /** The project's acknowledged violations, keyed by violation type. */
  readAcknowledgements(projectId: string): Promise<IntentionalViolationMap>;
  /** Merge ONE acknowledgement into the project's jsonb map. */
  recordAcknowledgement(
    projectId: string,
    payload: { violationType: string; entry: IntentionalViolationEntry },
  ): Promise<void>;
}

// ------------------------------------------------------------------------ read

export type ReadIntentionalViolationsResult =
  | { ok: true; violations: IntentionalViolationMap }
  | { ok: false; status: 403 | 404; reason: string };

export async function readIntentionalViolations(
  ctx: RequestContext,
  input: { projectId: string },
  repo: Pick<IntentionalViolationRepository, "ownsProject" | "readAcknowledgements">,
): Promise<ReadIntentionalViolationsResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  return { ok: true, violations: await repo.readAcknowledgements(input.projectId) };
}

// ---------------------------------------------------------------------- record

export type RecordIntentionalViolationResult =
  | { ok: true }
  | { ok: false; status: 400 | 403 | 404; reason: string };

export async function recordIntentionalViolation(
  ctx: RequestContext,
  input: { projectId: string; violationType?: string | undefined; purpose?: string | undefined },
  repo: Pick<IntentionalViolationRepository, "ownsProject" | "recordAcknowledgement">,
  hooks: PostCommitHooks = {},
): Promise<RecordIntentionalViolationResult> {
  // Ownership BEFORE the 400: the route 404'd a non-owner before it ever read
  // the body, so an unauthorized caller must not learn that "violationType
  // required" is this endpoint's contract.
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  if (!input.violationType) {
    return { ok: false, status: 400, reason: "violationType required" };
  }

  // Verbatim from the pre-migration route, including `purpose || ""`.
  const entry: IntentionalViolationEntry = {
    confirmed: true,
    purpose: input.purpose || "",
    timestamp: new Date().toISOString(),
  };
  await repo.recordAcknowledgement(input.projectId, { violationType: input.violationType, entry });

  // Canon-adjacent fired: the acknowledgement persists in the projects row and
  // feeds the generation-violations confirmation gates (`violation.acknowledge`).
  await hooks.onCanonicalMutation?.(input.projectId, "violation.acknowledge");
  return { ok: true };
}
