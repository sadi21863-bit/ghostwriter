/**
 * Phase 2 / v4 §7 — project CRUD (list/create/read/edit/delete) as shared
 * business handlers, ported from `src/app/api/projects/route.ts` and
 * `src/app/api/projects/[projectId]/route.ts`.
 *
 * The handlers take a `RequestContext` and a repository port — no NextAuth, no
 * `@/db`, no `next/server` — so a local host can serve the same rules without
 * forking this file. Shape mirrors `updateChapter`/`deleteChapter` and the
 * plot-thread CRUD handlers. What was previously implicit in the routes is now
 * explicit here:
 *
 *  - the tier cap (`MAX_PROJECTS` / tier lookup / owned-project count) is
 *    BUSINESS logic and lives in `createProject`; the cap-reached outcome is
 *    modelled in the union with the EXACT body and status the pre-migration
 *    route returned (`403 { error: "Project limit reached for your plan",
 *    upgrade: true }`). The tier RESOLVER is injected (`getTier`) — the route
 *    supplies the same `getUserTier` helper it always used — so core stays free
 *    of `@/db`-importing modules;
 *  - the create defaults (`"Untitled"` / `"Novel"` / `"beginner"` / `[]` /
 *    `"linear"` / `""`) moved to the handler;
 *  - the 19-field PATCH allowlist moved to the handler, with the server-owned
 *    `densityLevel` value coerced through `normalizeDensity`;
 *  - §11 canonical mutations fire via the awaited `onCanonicalMutation` hook —
 *    `project.create` / `project.update` / `project.delete` — only after the
 *    scoped write actually ran, with the post-delete ordering mirroring
 *    `deleteChapter` and the update firing only on a non-empty patch, mirroring
 *    the plot-thread handler.
 *
 * Two deliberate edges split with today's route (documented deviations, both
 * required to keep the seams honest and the outcomes sane):
 *  - `encodeAIRules` stays at the route: it is the request-shape guard whose
 *    throw is the `400 "Invalid aiRules shape."` response, and validation 400s
 *    stay at the edge. The handler receives the already-encoded value.
 *  - PATCH/DELETE on a project the actor does not own probe ownership and
 *    refuse with a clean `404 {"error":"Not found"}`. The pre-migration routes
 *    relied on the ownership `eq` baked into the UPDATE/DELETE WHERE clause:
 *    PATCH then fed `undefined` to `NextResponse.json` (the
 *    "Value is not JSON serializable" crash class fixed for chapters) and
 *    DELETE answered `200 {ok:true}` for rows it never matched. Both now use
 *    the sibling handlers' 404 convention.
 */

import type { RequestContext } from "@/lib/core/request-context";
import type { PostCommitHooks, ProjectRow } from "@/lib/core/repositories";
import { normalizeDensity } from "@/lib/modes/density";
import { MAX_PROJECTS } from "@/lib/metering/costs";
import type { SubscriptionTier } from "@/types/subscription";

/**
 * What a create may carry. The fields stay `unknown` on purpose: the POST
 * route never validated their types (only applied `||` defaults), and
 * tightening that here would change behaviour this migration must preserve.
 */
export interface ProjectCreateData {
  name?: unknown;
  format?: unknown;
  skillLevel?: unknown;
  genres?: unknown;
  storyType?: unknown;
  biggestChallenge?: unknown;
}

/**
 * The resolved insert payload the handler hands to the repository — exactly the
 * key set `.values()` received pre-migration.
 */
export interface ProjectInsertData {
  name: unknown;
  format: unknown;
  skillLevel: unknown;
  genres: unknown;
  storyType: unknown;
  biggestChallenge: unknown;
}

/**
 * Columns a client may write through PATCH. Everything else — `id`, `userId`,
 * `createdAt`, `updatedAt`, `contentRevision`, `adaptedFromProjectId` — is
 * server-owned. This is the minified allowlist the route's 19-field
 * destructuring used to enforce; spreading the raw body straight into `.set()`
 * would let a caller rewrite their own project's id, reassign it to another
 * user, or bump `contentRevision` by hand.
 */
export const PROJECT_PATCH_FIELDS: ReadonlySet<string> = new Set([
  "name",
  "format",
  "genres",
  "notes",
  "skillLevel",
  "aiRules",
  "controllingIdea",
  "narratorVoice",
  "narrativeStructure",
  "qualityGradingEnabled",
  "aiismsCheck",
  "storyType",
  "universeId",
  "timelineSort",
  "phase",
  "seriesParentId",
  "dismissedGuideIds",
  "aiInitiative",
  "densityLevel",
]);

export const PROJECT_LIMIT_REACHED_BODY = {
  error: "Project limit reached for your plan",
  upgrade: true,
} as const;

export type ProjectLimitReachedBody = typeof PROJECT_LIMIT_REACHED_BODY;

/**
 * A list row. The pre-migration list query selected 9 columns and attached
 * chapter + character stubs; the row's exact member set belongs to the adapter
 * (mirroring that query verbatim is the adapter's job).
 */
export interface ProjectListRow {
  id: string;
  [key: string]: unknown;
}

/**
 * The full-graph read is `ProjectRow` at runtime with the related arrays
 * attached; `ProjectRow`'s index signature keeps the payload intact without
 * narrowing it away.
 */
export type ProjectGraphRow = ProjectRow;

export interface ProjectsHooks extends PostCommitHooks {
  /**
   * Analytics for a successfully created project
   * (`project_created`). Wire `@/lib/analytics`'s `track` at the
   * edge, exactly as the pre-migration route called it.
   */
  onCreated?(userId: string, format: string): Promise<void> | void;
}

export interface ProjectsCoreRepository {
  /** True when the project exists and belongs to this actor. */
  ownsProject(projectId: string, actorId: string): Promise<boolean>;
  /** The list route's rows for this actor, newest-updated first. */
  listForUser(actorId: string): Promise<ProjectListRow[]>;
  /** Light owned-project count (id-column select), as the tier cap uses. */
  countForUser(actorId: string): Promise<number>;
  /**
   * Insert one project PLUS its seeded `Chapter 1` row (the two inserts the
   * pre-migration POST made), returning the bare created project row.
   */
  create(actorId: string, data: ProjectInsertData): Promise<ProjectRow>;
  /**
   * The full project graph (chapters/characters/locations/plotThreads/
   * worldEntities/referenceWorks/storyMemories/characterRelationships/
   * storyPromises). Call only after `ownsProject` proved ownership — the
   * WHERE clause is project-id only, exactly as specified for this port.
   */
  read(projectId: string): Promise<ProjectGraphRow | null>;
  /** Apply a partial update to one project. Null when no row matched. */
  updateScoped(projectId: string, patch: Record<string, unknown>): Promise<ProjectRow | null>;
  deleteScoped(projectId: string): Promise<void>;
}

/** Resolves the acting user's subscription tier (the route's `getUserTier`). */
export type ProjectTierResolver = (userId: string) => Promise<SubscriptionTier>;

export type ListProjectsResult =
  | { ok: true; projects: ProjectListRow[] };

export type CreateProjectResult =
  | { ok: true; project: ProjectRow }
  /**
   * The tier cap, modelled EXACTLY as the pre-migration route returned it:
   * same status, same body (the `upgrade: true` flag included).
   */
  | { ok: false; status: 403; reason: "project-limit"; body: ProjectLimitReachedBody }
  | { ok: false; status: 403; reason: string; body?: undefined };

export type ReadProjectResult =
  | { ok: true; project: ProjectGraphRow }
  | { ok: false; status: 403 | 404; reason: string };

export type UpdateProjectResult =
  | { ok: true; project: ProjectRow }
  | { ok: false; status: 403 | 404; reason: string };

export type DeleteProjectResult =
  | { ok: true }
  | { ok: false; status: 403 | 404; reason: string };

export async function listProjects(
  ctx: RequestContext,
  repo: Pick<ProjectsCoreRepository, "listForUser">,
): Promise<ListProjectsResult> {
  const projects = await repo.listForUser(ctx.actor.id);
  return { ok: true, projects };
}

/**
 * Executes the tier cap and creates the project. Mirrors the pre-migration
 * POST: resolve the tier → clamp by `MAX_PROJECTS` (`?? 3`, skipped at -1) →
 * count owned projects → refuse with the exact 403 body → insert (project +
 * `Chapter 1` via the port) → the §11 revision hook → analytics.
 */
export async function createProject(
  ctx: RequestContext,
  input: { data: ProjectCreateData },
  repo: Pick<ProjectsCoreRepository, "countForUser" | "create">,
  hooks: ProjectsHooks = {},
  getTier: ProjectTierResolver,
): Promise<CreateProjectResult> {
  const tier = await getTier(ctx.actor.id);
  const maxProjects = MAX_PROJECTS[tier] ?? 3;
  if (maxProjects !== -1) {
    const existing = await repo.countForUser(ctx.actor.id);
    if (existing >= maxProjects) {
      return { ok: false, status: 403, reason: "project-limit", body: PROJECT_LIMIT_REACHED_BODY };
    }
  }

  // The pre-migration `b.x || default` chain — `||`, not `??`, so a present
  // empty-string name, for example, still falls back to "Untitled".
  const data: ProjectInsertData = {
    name: input.data.name || "Untitled",
    format: input.data.format || "Novel",
    skillLevel: input.data.skillLevel || "beginner",
    genres: input.data.genres || [],
    storyType: input.data.storyType || "linear",
    biggestChallenge: input.data.biggestChallenge || "",
  };

  const project = await repo.create(ctx.actor.id, data);

  // The pre-migration route awaited `track` AFTER both inserts; hook order is
  // preserved (revision bump first, then analytics). The format value is the
  // truthy-fallback-resolved one (`b.format || 'Novel'`), passed as-is so the
  // analytics property is byte-exact even for absurd payload types.
  await hooks.onCanonicalMutation?.(project.id, "project.create");
  await hooks.onCreated?.(ctx.actor.id, data.format as string);

  return { ok: true, project };
}

export async function readProject(
  ctx: RequestContext,
  input: { projectId: string },
  repo: Pick<ProjectsCoreRepository, "ownsProject" | "read">,
): Promise<ReadProjectResult> {
  // A context scoped to another project must never read this one.
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  const project = await repo.read(input.projectId);
  if (!project) return { ok: false, status: 404, reason: "Not found" };
  return { ok: true, project };
}

export async function updateProject(
  ctx: RequestContext,
  input: { projectId: string; patch: unknown },
  repo: Pick<ProjectsCoreRepository, "ownsProject" | "updateScoped">,
  hooks: ProjectsHooks = {},
): Promise<UpdateProjectResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }

  // Same three-part shape the route's destructuring + `...(x !== undefined)`
  // spreads enforced: allowlist the field, drop explicitly-`undefined` values,
  // and coerce the server-governed density before the write.
  const sentPatch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries((input.patch ?? {}) as Record<string, unknown>)) {
    if (!PROJECT_PATCH_FIELDS.has(k) || v === undefined) continue;
    sentPatch[k] = k === "densityLevel" ? normalizeDensity(v as string | null | undefined) : v;
  }

  // Pre-migration, `updatedAt` was stamped on EVERY PATCH, even an all-unknown
  // body — it is `.set()`'s one unconditional member. Preserve that (touch, not
  // a canon change).
  const project = await repo.updateScoped(input.projectId, {
    ...sentPatch,
    updatedAt: new Date(),
  });
  // No row matched: the projectId belongs to a different user, or is gone.
  if (!project) return { ok: false, status: 404, reason: "Not found" };

  // Mirrors the plot-thread handler: the revision bumps only when at least one
  // client-sourced field survived the allowlist.
  if (Object.keys(sentPatch).length > 0) {
    await hooks.onCanonicalMutation?.(input.projectId, "project.update");
  }

  return { ok: true, project };
}

export async function deleteProject(
  ctx: RequestContext,
  input: { projectId: string },
  repo: Pick<ProjectsCoreRepository, "ownsProject" | "deleteScoped">,
  hooks: ProjectsHooks = {},
): Promise<DeleteProjectResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  await repo.deleteScoped(input.projectId);
  // Deleting a project is canonical: the revision bumps with it — after the
  // scoped delete actually ran, never on the refusal paths (post-commit rule,
  // mirroring `deleteChapter`).
  await hooks.onCanonicalMutation?.(input.projectId, "project.delete");
  return { ok: true };
}
