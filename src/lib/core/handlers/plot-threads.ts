/**
 * Phase 2 / v4 §7 — plot-thread CRUD as shared business handlers.
 *
 * Previously inlined in `src/app/api/projects/[projectId]/plot-threads/route.ts`
 * and `.../plot-threads/[threadId]/route.ts`: an ownership probe plus a raw
 * Drizzle write per verb. The handlers below take a `RequestContext` and a
 * repository port — no NextAuth, no `@/db`, no `next/server` — so a local host
 * can serve the same rules without forking this file.
 *
 * Shape mirrors `updateChapter`/`deleteChapter`:
 *  - the context's `projectScope` is checked BEFORE the repository, so a scope
 *    mismatch is an explicit 403 instead of a silent wrong-project write;
 *  - ownership is re-proved through the port, and refusal is a 404;
 *  - §11 canonical mutations fire via the awaited `onCanonicalMutation` hook —
 *    `plotThread.create` / `plotThread.update` / `plotThread.delete` — only
 *    after the scoped write actually ran, with the post-delete ordering
 *    mirroring `deleteChapter`.
 *
 * Field validation stays at the route (the zod status enum must keep 400-ing
 * there); these handlers take already-validated input and stamp the
 * server-owned `updatedAt` themselves.
 */

import type { RequestContext } from "@/lib/core/request-context";
import type { PostCommitHooks } from "@/lib/core/repositories";

export interface PlotThreadRow {
  id: string;
  projectId: string;
  name: string;
  [key: string]: unknown;
}

/**
 * What a create may carry. The optional fields stay `unknown` on purpose: the
 * POST route never validated them (only `name`), and tightening that here
 * would change behaviour this migration must preserve.
 */
export interface PlotThreadCreateData {
  name: string;
  description?: unknown;
  status?: unknown;
  stakes?: unknown;
  connections?: unknown;
  alwaysInContext?: unknown;
  sortOrder?: unknown;
}

/** The PATCH allowlist, as already enforced by the route's zod schema. */
export interface PlotThreadPatchData {
  name?: string;
  description?: string;
  status?: string;
  stakes?: string;
  connections?: string;
  alwaysInContext?: boolean;
  sortOrder?: number;
}

export interface PlotThreadCrudRepository {
  /** True when the project exists and belongs to this actor. */
  ownsProject(projectId: string, actorId: string): Promise<boolean>;
  /** Insert one thread in the project; returns the full created row. */
  create(projectId: string, data: PlotThreadCreateData): Promise<PlotThreadRow>;
  /** One thread by id, scoped to the project; null when absent. */
  findScoped(projectId: string, threadId: string): Promise<PlotThreadRow | null>;
  /** Apply a partial update, scoped to the project. Returns null if no row matched. */
  updateScoped(
    projectId: string,
    threadId: string,
    patch: Record<string, unknown>,
  ): Promise<PlotThreadRow | null>;
  deleteScoped(projectId: string, threadId: string): Promise<void>;
}

export type CreatePlotThreadResult =
  | { ok: true; thread: PlotThreadRow }
  | { ok: false; status: 403 | 404; reason: string };

export type UpdatePlotThreadResult =
  | { ok: true; thread: PlotThreadRow }
  | { ok: false; status: 403 | 404; reason: string };

export type DeletePlotThreadResult =
  | { ok: true }
  | { ok: false; status: 403 | 404; reason: string };

export async function createPlotThread(
  ctx: RequestContext,
  input: { projectId: string; data: PlotThreadCreateData },
  repo: Pick<PlotThreadCrudRepository, "ownsProject" | "create">,
  hooks: PostCommitHooks = {},
): Promise<CreatePlotThreadResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  const thread = await repo.create(input.projectId, input.data);
  // Post-commit only: a refused request never reaches here, so it can never
  // bump someone else's revision.
  await hooks.onCanonicalMutation?.(input.projectId, "plotThread.create");
  return { ok: true, thread };
}

export async function updatePlotThread(
  ctx: RequestContext,
  input: { projectId: string; threadId: string; patch: PlotThreadPatchData },
  repo: Pick<PlotThreadCrudRepository, "ownsProject" | "updateScoped">,
  hooks: PostCommitHooks = {},
): Promise<UpdatePlotThreadResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }

  // `updatedAt` goes LAST so a server-owned stamp cannot be overwritten by the
  // patch, however it was produced.
  const thread = await repo.updateScoped(input.projectId, input.threadId, {
    ...input.patch,
    updatedAt: new Date(),
  });
  // No row matched: the threadId belongs to a different project, or is gone.
  if (!thread) return { ok: false, status: 404, reason: "Not found" };

  // Mirrors `updateChapter`: the revision bumps only when at least one
  // client-sourced field survived validation — an empty patch still writes a
  // fresh `updatedAt` (touch, not a canon change).
  if (Object.keys(input.patch).length > 0) {
    await hooks.onCanonicalMutation?.(input.projectId, "plotThread.update");
  }

  return { ok: true, thread };
}

export async function deletePlotThread(
  ctx: RequestContext,
  input: { projectId: string; threadId: string },
  repo: Pick<PlotThreadCrudRepository, "ownsProject" | "deleteScoped">,
  hooks: PostCommitHooks = {},
): Promise<DeletePlotThreadResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  await repo.deleteScoped(input.projectId, input.threadId);
  // Deleting a thread is canonical: the revision bumps with it, after the
  // scoped delete actually ran — never on the refusal paths.
  await hooks.onCanonicalMutation?.(input.projectId, "plotThread.delete");
  return { ok: true };
}
