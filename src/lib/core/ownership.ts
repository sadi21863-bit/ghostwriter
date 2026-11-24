/**
 * Phase 2 / v4 §7 — ownership authorization in Core.
 *
 * v4: "Ownership helpers consume RequestContext and repository interfaces."
 *
 * The previous helper took a Drizzle table object:
 *
 *   verifyChildOwnership(comicPages, pageId, projectId)
 *
 * which bound authorization to the ORM — a local host with no Drizzle could not
 * satisfy it, and the `projectId` was supplied by the caller rather than derived
 * from anything the caller could not tamper with.
 *
 * Two things are enforced here that the old signature could not:
 *
 *  1. **Context scope wins.** If the context is already scoped to a project, a
 *     request naming a different one is refused without touching the repository.
 *  2. **Named resources, not tables.** The caller says "comic_pages", not which
 *     ORM object represents it.
 */

import type { RequestContext } from "@/lib/core/request-context";
import type { ChildResourceRef, ChildResourceRepository } from "@/lib/core/repositories";

export type OwnershipFailure = "out-of-scope" | "not-found";

export type OwnershipResult =
  | { ok: true }
  | { ok: false; reason: OwnershipFailure };

export async function ownsChildResource(
  ctx: RequestContext,
  ref: ChildResourceRef,
  repo: Pick<ChildResourceRepository, "owns">,
): Promise<OwnershipResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== ref.projectId) {
    return { ok: false, reason: "out-of-scope" };
  }
  return (await repo.owns(ref)) ? { ok: true } : { ok: false, reason: "not-found" };
}

/** Boolean form for call sites that only need a yes/no. */
export async function mayUseChild(
  ctx: RequestContext,
  ref: ChildResourceRef,
  repo: Pick<ChildResourceRepository, "owns">,
): Promise<boolean> {
  return (await ownsChildResource(ctx, ref, repo)).ok;
}