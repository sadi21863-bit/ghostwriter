/**
 * Phase 2 / v4 §7 — story-plan (beat sheet) CRUD as shared business handlers.
 *
 * Only the pure-CRUD verbs moved here (list / patch / delete) from
 * `src/app/api/projects/[projectId]/story-plans/route.ts`. The POST stays at the
 * transport edge ON PURPOSE: all three of its branches share one preamble
 * (rate limit → ownership probe with the AI-facing relations loaded), and two of
 * them are AI calls — the metered `runDirectorCall` beat-sheet pass and the
 * `buildSceneBlueprint` chapter-plan pass — while the third (arc presets) is
 * pure-CRUD but inseparable from that shared flow. Extracting only the preset
 * branch would fork the POST's ordering inside one route; metered/streaming
 * responses are not reshaped by this migration.
 *
 * The PATCH's `encodeStoryBeats` "Invalid beats shape." 400 MOVED into the
 * handler — deliberately. The original route ordered it AFTER the ownership
 * probe (404 before 400), and the handler is now the only place that can keep
 * that order while re-proving ownership through the port. No §11 hook: story
 * plans are planning artifacts, not World Bible canon, and this wave's hook
 * kinds are storyThread/storyPromise/memory/checkpoint only.
 *
 * The PATCH previously returned `200 {plan: undefined}` (serialized `{}`) when
 * planId matched no row; following the migrated character/plot-thread handlers,
 * a no-match scoped update is now an explicit 404. The DELETE keeps the
 * original's silent-zero-match `{ok: true}` behaviour, mirroring
 * `deleteCharacter`.
 */

import type { RequestContext } from "@/lib/core/request-context";
import type { StoryBeat } from "@/lib/types/story";
import { encodeStoryBeats } from "@/lib/types/story";

export interface StoryPlanRow {
  id: string;
  projectId: string;
  kind: string;
  title: string;
  [key: string]: unknown;
}

export interface StoryPlanRepository {
  /** True when the project exists and belongs to this actor. */
  ownsProject(projectId: string, actorId: string): Promise<boolean>;
  /** The project's plans, newest first — the GET order the UI renders. */
  findScoped(projectId: string): Promise<StoryPlanRow[]>;
  /** Apply a partial update, scoped to the project. Null when no row matched. */
  updateScoped(
    projectId: string,
    planId: string,
    patch: Record<string, unknown>,
  ): Promise<StoryPlanRow | null>;
  deleteScoped(projectId: string, planId: unknown): Promise<void>;
}

export type StoryPlanRefusal = { ok: false; status: 400 | 403 | 404; reason: string };

export type ListStoryPlansResult =
  | { ok: true; plans: StoryPlanRow[] }
  | StoryPlanRefusal;

export type UpdateStoryPlanResult =
  | { ok: true; plan: StoryPlanRow }
  | StoryPlanRefusal;

export type DeleteStoryPlanResult = { ok: true } | StoryPlanRefusal;

export async function listStoryPlans(
  ctx: RequestContext,
  input: { projectId: string },
  repo: Pick<StoryPlanRepository, "ownsProject" | "findScoped">,
): Promise<ListStoryPlansResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  return { ok: true, plans: await repo.findScoped(input.projectId) };
}

export async function updateStoryPlan(
  ctx: RequestContext,
  input: {
    projectId: string;
    planId: string;
    /** Raw body values — the original route never validated `title`. */
    title?: unknown;
    /** Raw body value, encoded here AFTER ownership so 404 still beats 400. */
    beats?: unknown;
  },
  repo: Pick<StoryPlanRepository, "ownsProject" | "updateScoped">,
): Promise<UpdateStoryPlanResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }

  const set: { title?: string; beats?: StoryBeat[]; updatedAt: Date } = { updatedAt: new Date() };
  if (input.title !== undefined) set.title = input.title as string;
  if (input.beats !== undefined) {
    try {
      set.beats = encodeStoryBeats(input.beats);
    } catch {
      return { ok: false, status: 400, reason: "Invalid beats shape." };
    }
  }

  const plan = await repo.updateScoped(input.projectId, input.planId, set);
  // No row matched: the planId belongs to a different project, or is gone.
  if (!plan) return { ok: false, status: 404, reason: "Not found" };
  return { ok: true, plan };
}

export async function deleteStoryPlan(
  ctx: RequestContext,
  input: { projectId: string; planId: unknown },
  repo: Pick<StoryPlanRepository, "ownsProject" | "deleteScoped">,
): Promise<DeleteStoryPlanResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  // A scoped DELETE matching zero rows stays a silent ok — the original
  // route's exact behaviour.
  await repo.deleteScoped(input.projectId, input.planId);
  return { ok: true };
}
