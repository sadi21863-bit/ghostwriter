/**
 * Phase 2 / v4 §7 — story-checkpoint CRUD as shared business handlers.
 *
 * Previously inlined in `src/app/api/projects/[projectId]/checkpoints/route.ts`:
 * an ownership probe, the Promise Tracker health read (chapters / plot threads /
 * story promises), the inline healthScore formula, and a raw insert/delete. The
 * handlers below take a `RequestContext` and a repository port — no NextAuth,
 * no `@/db`, no `next/server` — so a local host can serve the same rules without
 * forking this file.
 *
 * The healthScore formula is extracted verbatim into `computeCheckpointSnapshot`
 * so the Promise Tracker keeps reading the SAME numbers out of the checkpoint
 * snapshot (it deliberately surfaces the stored score rather than recomputing),
 * and so the formula now has one testable home. The `name?.trim() || "Checkpoint
 * — <date>"` default stays server-owned in the handler.
 *
 * §11 canonical mutations fire via the awaited `onCanonicalMutation` hook —
 * `checkpoint.create` / `checkpoint.delete` — only after the scoped write
 * actually ran. DELETE keeps the original's silent-zero-match behaviour
 * (mirroring `deleteCharacter`), and the route keeps returning its distinctive
 * `{ success: true }` body.
 */

import type { RequestContext } from "@/lib/core/request-context";
import type { PostCommitHooks } from "@/lib/core/repositories";

export interface StoryCheckpointRow {
  id: string;
  projectId: string;
  name: string;
  [key: string]: unknown;
}

/**
 * The exact columns the health read loads (no more): chapters for word counts,
 * plot threads for open/starvation counts, story promises for open count.
 */
export interface CheckpointSnapshotInputs {
  chapters: { id: string; title: string; wordCount: number | null; arcPosition: string | null }[];
  plotThreads: { id: string; status: string | null; starvationWarning: boolean | null }[];
  storyPromises: { id: string; status: string | null }[];
}

export interface StoryCheckpointRepository {
  /** True when the project exists and belongs to this actor. */
  ownsProject(projectId: string, actorId: string): Promise<boolean>;
  /** The health read, newest-checkpoint listing, insert, and scoped delete. */
  readSnapshotInputs(projectId: string): Promise<CheckpointSnapshotInputs | null>;
  findScoped(projectId: string): Promise<StoryCheckpointRow[]>;
  create(projectId: string, fields: Record<string, unknown>): Promise<StoryCheckpointRow>;
  deleteScoped(projectId: string, checkpointId: unknown): Promise<void>;
}

export type StoryCheckpointRefusal = { ok: false; status: 403 | 404; reason: string };

export type ListCheckpointsResult =
  | { ok: true; checkpoints: StoryCheckpointRow[] }
  | StoryCheckpointRefusal;

export type CreateCheckpointResult =
  | { ok: true; checkpoint: StoryCheckpointRow }
  | StoryCheckpointRefusal;

export type DeleteCheckpointResult = { ok: true } | StoryCheckpointRefusal;

/**
 * The checkpoint snapshot, verbatim from the pre-migration route: word-count
 * total, open thread count (`"open" || "Active"`), open promises, and the
 * healthScore penalty formula (starvation warnings −5, thin chapters −3, open
 * promises beyond five −4 each, floored at 0).
 */
export function computeCheckpointSnapshot(inputs: CheckpointSnapshotInputs) {
  const totalWordCount = inputs.chapters.reduce((sum, c) => sum + (c.wordCount ?? 0), 0);
  const openThreadCount = inputs.plotThreads.filter(
    (t) => t.status === "open" || t.status === "Active",
  ).length;
  const openPromises = inputs.storyPromises.filter((p) => p.status === "open").length;

  const healthScore = Math.max(
    0,
    100 -
      (inputs.plotThreads.filter((t) => t.starvationWarning).length * 5) -
      (inputs.chapters.filter((c) => (c.wordCount ?? 0) < 300).length * 3) -
      (openPromises > 5 ? (openPromises - 5) * 4 : 0),
  );

  return {
    totalWordCount,
    chapterCount: inputs.chapters.length,
    chapters: inputs.chapters.map((c) => ({
      id: c.id,
      title: c.title,
      wordCount: c.wordCount ?? 0,
      arcPosition: c.arcPosition ?? "",
    })),
    openThreadCount,
    openPromises,
    healthScore,
  };
}

export async function listCheckpoints(
  ctx: RequestContext,
  input: { projectId: string },
  repo: Pick<StoryCheckpointRepository, "ownsProject" | "findScoped">,
): Promise<ListCheckpointsResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  return { ok: true, checkpoints: await repo.findScoped(input.projectId) };
}

export async function createCheckpoint(
  ctx: RequestContext,
  input: { projectId: string; name?: unknown; notes?: unknown },
  repo: Pick<StoryCheckpointRepository, "ownsProject" | "readSnapshotInputs" | "create">,
  hooks: PostCommitHooks = {},
): Promise<CreateCheckpointResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }

  const inputs = await repo.readSnapshotInputs(input.projectId);
  if (!inputs) return { ok: false, status: 404, reason: "Not found" };

  const checkpoint = await repo.create(input.projectId, {
    name: (input.name as string | undefined)?.trim() || `Checkpoint — ${new Date().toLocaleDateString()}`,
    notes: input.notes ?? "",
    snapshot: computeCheckpointSnapshot(inputs),
  });
  await hooks.onCanonicalMutation?.(input.projectId, "checkpoint.create");
  return { ok: true, checkpoint };
}

export async function deleteCheckpoint(
  ctx: RequestContext,
  input: { projectId: string; checkpointId: unknown },
  repo: Pick<StoryCheckpointRepository, "ownsProject" | "deleteScoped">,
  hooks: PostCommitHooks = {},
): Promise<DeleteCheckpointResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  await repo.deleteScoped(input.projectId, input.checkpointId);
  await hooks.onCanonicalMutation?.(input.projectId, "checkpoint.delete");
  return { ok: true };
}
