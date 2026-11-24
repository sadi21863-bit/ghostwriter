/**
 * Phase 2 / v4 §7 — story-state (Promise Tracker threads + promises) CRUD as
 * shared business handlers.
 *
 * Previously inlined in `src/app/api/projects/[projectId]/story-state/route.ts`:
 * an ownership probe plus a raw Drizzle write per verb, with the POST promise
 * branch additionally carrying the fire-and-forget `updatePromiseEmbedding`
 * wiring that powers knowledge_audit's semantic cross-referencing. The handlers
 * below take a `RequestContext` and a repository port — no NextAuth, no `@/db`,
 * no `next/server` — so a local host can serve the same rules without forking
 * this file.
 *
 * Shape mirrors `createPlotThread`/`updatePlotThread`:
 *  - the context's `projectScope` is checked BEFORE the repository, so a scope
 *    mismatch is an explicit 403 instead of a silent wrong-project write;
 *  - ownership is re-proved through the port, and refusal is a 404;
 *  - §11 canonical mutations fire via the awaited `onCanonicalMutation` hook —
 *    `storyThread.create` / `storyThread.update` / `storyPromise.create` /
 *    `storyPromise.update` — only after the scoped write actually ran.
 *
 * Unlike the character/plot-thread PATCH (where a client-built patch may be
 * empty), the story-state PATCH writes a branch-fixed payload — the route's
 * `resolvedAtChapterId ?? null` / `payoffChapterId ?? null` normalization is
 * part of every update — so every matched update is a real write and there is
 * no empty-patch exemption: the hook fires whenever a row matched.
 *
 * The PATCH previously returned `200 {}` (an undefined row serialized away)
 * when the threadId/promiseId matched no row in the project. Following the
 * migrated character/plot-thread handlers, a no-match scoped update is now an
 * explicit 404 — the payload is always project-scoped, so this only turns a
 * silent no-op into a visible refusal, never a cross-tenant leak.
 *
 * The promise-embedding wiring moved behind the `embedSetup` DI seam, mirroring
 * world-entities' `embedText` pattern: the handler owns WHEN it fires (after
 * the insert and the revision bump), the route/host supplies the actual I/O,
 * and the fail-open default (a no-op) means a local host without an embedding
 * service simply creates un-embedded promises. The production seam is
 * `updatePromiseEmbedding` itself — still fire-and-forget, still fail-open
 * inside its own catch, exactly as before this migration.
 */

import type { RequestContext } from "@/lib/core/request-context";
import type { PostCommitHooks } from "@/lib/core/repositories";

export interface StoryThreadRow {
  id: string;
  projectId: string;
  name: string;
  [key: string]: unknown;
}

export interface StoryPromiseRow {
  id: string;
  projectId: string;
  setup: string;
  [key: string]: unknown;
}

/**
 * What a create may carry. The fields stay `unknown` on purpose: the POST route
 * never validated them (it applied only the `?? default` normalizations, which
 * the pg adapter reproduces), and tightening that here would change behaviour
 * this migration must preserve.
 */
export interface StoryThreadCreateData {
  name: unknown;
  threadType?: unknown;
  notes?: unknown;
}

export interface StoryPromiseCreateData {
  setup: unknown;
  threadId?: unknown;
  setupChapterId?: unknown;
  payoffIntent?: unknown;
  priority?: unknown;
}

/**
 * The PATCH payload for each branch, exactly the fields the route destructured
 * from the body. The handler applies the `?? null` normalizations verbatim.
 */
export interface StoryThreadPatchInput {
  status?: unknown;
  resolvedAtChapterId?: unknown;
  notes?: unknown;
}

export interface StoryPromisePatchInput {
  status?: unknown;
  payoffChapterId?: unknown;
  payoffIntent?: unknown;
}

/**
 * Same column defaults the POST route's INSERT used to carry, applied here so
 * the defaults are stated once (subplot type, empty notes, no thread link yet,
 * empty payoff intent, B priority) instead of wherever the caller remembered
 * them — mirroring `worldEntityInsertFields`.
 */
export function storyThreadInsertFields(data: StoryThreadCreateData): Record<string, unknown> {
  return {
    name: data.name,
    threadType: data.threadType ?? "subplot",
    notes: data.notes ?? "",
  };
}

export function storyPromiseInsertFields(data: StoryPromiseCreateData): Record<string, unknown> {
  return {
    threadId: data.threadId ?? null,
    setup: data.setup,
    setupChapterId: data.setupChapterId ?? null,
    payoffIntent: data.payoffIntent ?? "",
    priority: data.priority ?? "B",
  };
}

export interface StoryStateRepository {
  /** True when the project exists and belongs to this actor. */
  ownsProject(projectId: string, actorId: string): Promise<boolean>;
  /**
   * The project's threads oldest-first, each with its promises — the GET shape
   * the Promise Tracker panel renders.
   */
  findThreads(projectId: string): Promise<StoryThreadRow[]>;
  createThread(projectId: string, fields: Record<string, unknown>): Promise<StoryThreadRow>;
  createPromise(projectId: string, fields: Record<string, unknown>): Promise<StoryPromiseRow>;
  /** Apply the branch payload, scoped to the project. Null when no row matched. */
  updateThreadScoped(
    projectId: string,
    threadId: string,
    patch: Record<string, unknown>,
  ): Promise<StoryThreadRow | null>;
  updatePromiseScoped(
    projectId: string,
    promiseId: string,
    patch: Record<string, unknown>,
  ): Promise<StoryPromiseRow | null>;
}

export type StoryStateRefusal = { ok: false; status: 403 | 404; reason: string };

export type ListStoryStateResult =
  | { ok: true; threads: StoryThreadRow[] }
  | StoryStateRefusal;

export type CreateStoryThreadResult =
  | { ok: true; thread: StoryThreadRow }
  | StoryStateRefusal;

export type CreateStoryPromiseResult =
  | { ok: true; promise: StoryPromiseRow }
  | StoryStateRefusal;

export type UpdateStoryThreadResult =
  | { ok: true; thread: StoryThreadRow }
  | StoryStateRefusal;

export type UpdateStoryPromiseResult =
  | { ok: true; promise: StoryPromiseRow }
  | StoryStateRefusal;

function scopedRefusal(
  ctx: RequestContext,
  projectId: string,
  owns: (projectId: string, actorId: string) => Promise<boolean>,
): Promise<StoryStateRefusal | null> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== projectId) {
    return Promise.resolve({ ok: false, status: 403, reason: "Context is not scoped to this project." });
  }
  return owns(projectId, ctx.actor.id).then((owned) =>
    owned ? null : { ok: false, status: 404, reason: "Not found" },
  );
}

export async function listStoryState(
  ctx: RequestContext,
  input: { projectId: string },
  repo: Pick<StoryStateRepository, "ownsProject" | "findThreads">,
): Promise<ListStoryStateResult> {
  const refusal = await scopedRefusal(ctx, input.projectId, repo.ownsProject);
  if (refusal) return refusal;
  return { ok: true, threads: await repo.findThreads(input.projectId) };
}

export async function createStoryThread(
  ctx: RequestContext,
  input: { projectId: string; data: StoryThreadCreateData },
  repo: Pick<StoryStateRepository, "ownsProject" | "createThread">,
  hooks: PostCommitHooks = {},
): Promise<CreateStoryThreadResult> {
  const refusal = await scopedRefusal(ctx, input.projectId, repo.ownsProject);
  if (refusal) return refusal;

  const thread = await repo.createThread(input.projectId, storyThreadInsertFields(input.data));
  // Post-commit only: a refused request never reaches here, so it can never
  // bump someone else's revision.
  await hooks.onCanonicalMutation?.(input.projectId, "storyThread.create");
  return { ok: true, thread };
}

export async function createStoryPromise(
  ctx: RequestContext,
  input: { projectId: string; data: StoryPromiseCreateData },
  repo: Pick<StoryStateRepository, "ownsProject" | "createPromise">,
  hooks: PostCommitHooks = {},
  /**
   * DI seam for the promise embedding, mirroring world-entities' `embedText`:
   * fire-and-forget (the response is never blocked), its own error handling,
   * and a fail-open no-op default. The cloud route binds
   * `updatePromiseEmbedding` here.
   */
  embedSetup: (promiseId: string, setup: string) => void = () => {},
): Promise<CreateStoryPromiseResult> {
  const refusal = await scopedRefusal(ctx, input.projectId, repo.ownsProject);
  if (refusal) return refusal;

  const promise = await repo.createPromise(input.projectId, storyPromiseInsertFields(input.data));
  await hooks.onCanonicalMutation?.(input.projectId, "storyPromise.create");

  // Fire-and-forget at the exact point the old route fired it: after the insert
  // (and now the revision bump), never blocking the response. The seam owns its
  // error handling; a synchronous throw is swallowed so a broken embedding
  // service can never fail a completed save — the same fail-open contract
  // world-entities' embedText catch gives its awaited call.
  try {
    embedSetup(promise.id, promise.setup);
  } catch {
    // embedding refresh must never affect the main save path
  }
  return { ok: true, promise };
}

export async function updateStoryThread(
  ctx: RequestContext,
  input: { projectId: string; threadId: string; patch: StoryThreadPatchInput },
  repo: Pick<StoryStateRepository, "ownsProject" | "updateThreadScoped">,
  hooks: PostCommitHooks = {},
): Promise<UpdateStoryThreadResult> {
  const refusal = await scopedRefusal(ctx, input.projectId, repo.ownsProject);
  if (refusal) return refusal;

  // The exact payload the route used to set — including the `?? null` reset of
  // the resolved-chapter marker. Drizzle drops the undefined `status`/`notes`
  // keys, so an omitted field keeps hitting the column's stored value.
  const thread = await repo.updateThreadScoped(input.projectId, input.threadId, {
    status: input.patch.status,
    resolvedAtChapterId: input.patch.resolvedAtChapterId ?? null,
    notes: input.patch.notes,
  });
  // No row matched: the threadId belongs to a different project, or is gone.
  if (!thread) return { ok: false, status: 404, reason: "Not found" };

  await hooks.onCanonicalMutation?.(input.projectId, "storyThread.update");
  return { ok: true, thread };
}

export async function updateStoryPromise(
  ctx: RequestContext,
  input: { projectId: string; promiseId: string; patch: StoryPromisePatchInput },
  repo: Pick<StoryStateRepository, "ownsProject" | "updatePromiseScoped">,
  hooks: PostCommitHooks = {},
): Promise<UpdateStoryPromiseResult> {
  const refusal = await scopedRefusal(ctx, input.projectId, repo.ownsProject);
  if (refusal) return refusal;

  const promise = await repo.updatePromiseScoped(input.projectId, input.promiseId, {
    status: input.patch.status,
    payoffChapterId: input.patch.payoffChapterId ?? null,
    payoffIntent: input.patch.payoffIntent,
  });
  if (!promise) return { ok: false, status: 404, reason: "Not found" };

  await hooks.onCanonicalMutation?.(input.projectId, "storyPromise.update");
  return { ok: true, promise };
}
