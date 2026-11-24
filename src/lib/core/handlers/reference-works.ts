/**
 * Phase 2 / v4 §7 — reference-work create/delete as shared business handlers.
 *
 * Previously inlined in `src/app/api/projects/[projectId]/reference-works/route.ts`
 * and `.../reference-works/[refId]/route.ts`. Reference works have NO PATCH
 * today (Style DNA attributes are edited by deleting and recreating the row),
 * so this port is deliberately minimal — `ownsProject` / `create` /
 * `deleteScoped` — and no update handler is invented here.
 *
 * Same rules as the plot-thread handlers: scope checked before the repository,
 * ownership re-proved through the port, and the §11 canonical-mutation hook
 * (`referenceWork.create` / `referenceWork.delete`) fires only after the
 * scoped write actually ran.
 */

import type { RequestContext } from "@/lib/core/request-context";
import type { PostCommitHooks } from "@/lib/core/repositories";

export interface ReferenceWorkRow {
  id: string;
  projectId: string;
  title: string;
  [key: string]: unknown;
}

/**
 * `attributes` stays `unknown` and is only inserted when the caller actually
 * supplied it — the pg adapter reproduces the route's conditional spread
 * exactly, so an omitted `attributes` keeps hitting the column's default.
 */
export interface ReferenceWorkCreateData {
  title: string;
  attributes?: unknown;
}

export interface ReferenceWorkCrudRepository {
  /** True when the project exists and belongs to this actor. */
  ownsProject(projectId: string, actorId: string): Promise<boolean>;
  /** Insert one reference work in the project; returns the full created row. */
  create(projectId: string, data: ReferenceWorkCreateData): Promise<ReferenceWorkRow>;
  deleteScoped(projectId: string, refId: string): Promise<void>;
}

export type CreateReferenceWorkResult =
  | { ok: true; reference: ReferenceWorkRow }
  | { ok: false; status: 403 | 404; reason: string };

export type DeleteReferenceWorkResult =
  | { ok: true }
  | { ok: false; status: 403 | 404; reason: string };

export async function createReferenceWork(
  ctx: RequestContext,
  input: { projectId: string; data: ReferenceWorkCreateData },
  repo: Pick<ReferenceWorkCrudRepository, "ownsProject" | "create">,
  hooks: PostCommitHooks = {},
): Promise<CreateReferenceWorkResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  const reference = await repo.create(input.projectId, input.data);
  // Post-commit only, same as every other §11 mutation.
  await hooks.onCanonicalMutation?.(input.projectId, "referenceWork.create");
  return { ok: true, reference };
}

export async function deleteReferenceWork(
  ctx: RequestContext,
  input: { projectId: string; refId: string },
  repo: Pick<ReferenceWorkCrudRepository, "ownsProject" | "deleteScoped">,
  hooks: PostCommitHooks = {},
): Promise<DeleteReferenceWorkResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  await repo.deleteScoped(input.projectId, input.refId);
  await hooks.onCanonicalMutation?.(input.projectId, "referenceWork.delete");
  return { ok: true };
}
