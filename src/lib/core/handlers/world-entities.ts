/**
 * Phase 2 / v4 §7 — world-entity CRUD as shared business handlers.
 *
 * The world-entities routes (create/list, patch, delete) used to carry their
 * authorization, scoping, and side-effect rules inline. This module owns those
 * rules once; the routes become thin adapters that produce a `RequestContext`,
 * call a handler, and shape a response. Core never imports NextAuth, `@/db`,
 * or `next/server`, so a local host can serve the same rules without Next.js.
 *
 * What STAYED at the transport edge (the route), deliberately: the
 * `name is required` 400, `WorldEntityKindSchema` normalization (a
 * `.catch("object")` enum, so it never throws), `encodeWorldEntityProperties`
 * → the `invalid properties` 400, and the PATCH's manual field allowlist.
 * Those are request-shape validation whose 400s are transport errors; the
 * handler only sees already-validated input. Everything that decides WHO may
 * act, WHICH project, and WHEN post-commit effects fire lives here.
 */

import type { RequestContext } from "@/lib/core/request-context";
import type { PostCommitHooks } from "@/lib/core/repositories";
import type { WorldEntityProperties } from "@/lib/types/story";
import {
  buildWorldEntityEmbeddingText,
  findSimilarEntities,
  type SimilarEntityMatch,
} from "@/lib/world-bible/duplicate-detection";

export interface WorldEntityRow {
  id: string;
  projectId: string;
  kind: string;
  name: string;
  [key: string]: unknown;
}

/** Optional narrowing for a scoped read; every part is server-supplied. */
export interface FindWorldEntityQuery {
  /** Only rows of this kind (the duplicate scan is kind-scoped: a similar
   *  object and faction are unlikely to be "the same entity"). */
  kind?: string;
  /** Exclude one row id — the freshly created row itself. */
  excludeId?: string;
  /** Only rows carrying an embedding — the duplicate-scan pool. */
  onlyWithEmbedding?: boolean;
}

export interface WorldEntityCrudRepository {
  /** True when the project exists and belongs to this actor. */
  ownsProject(projectId: string, actorId: string): Promise<boolean>;
  /** Insert and return the created row. */
  create(projectId: string, fields: Record<string, unknown>): Promise<WorldEntityRow | null>;
  /**
   * Project-scoped read, ordered by (kind, sortOrder) — the order the Story
   * Bible UI groups world elements in. Returns [] for a project with none.
   */
  findScoped(projectId: string, query?: FindWorldEntityQuery): Promise<WorldEntityRow[]>;
  /** Partial update scoped to the project. Returns null when no row matched. */
  updateScoped(
    projectId: string,
    entityId: string,
    patch: Record<string, unknown>,
  ): Promise<WorldEntityRow | null>;
  deleteScoped(projectId: string, entityId: string): Promise<void>;
}

// ---------------------------------------------------------------- create/list

export interface CreateWorldEntityInput {
  projectId: string;
  entity: {
    /** Already normalized through `WorldEntityKindSchema` by the route. */
    kind: string;
    name: string;
    summary?: string;
    description?: string;
    /** Already encoded through `encodeWorldEntityProperties` by the route. */
    properties: WorldEntityProperties;
    linkedCharacterIds?: string[];
    linkedLocationIds?: string[];
    linkedPlotThreadIds?: string[];
    linkedEntityIds?: string[];
    alwaysInContext?: boolean;
    sortOrder?: number;
  };
}

export type CreateWorldEntityResult =
  | { ok: true; entity: WorldEntityRow; similarEntities: SimilarEntityMatch[] }
  | { ok: false; status: 403 | 404; reason: string };

export type ListWorldEntitiesResult =
  | { ok: true; entities: WorldEntityRow[] }
  | { ok: false; status: 403 | 404; reason: string };

/**
 * Same column defaults the route's INSERT used to carry, applied here so the
 * defaults are stated once (summary "", linked arrays [], not-always-in-context,
 * sortOrder 0) instead of wherever the caller remembered them.
 */
export function worldEntityInsertFields(entity: CreateWorldEntityInput["entity"]): Record<string, unknown> {
  return {
    kind: entity.kind,
    name: entity.name,
    summary: entity.summary ?? "",
    description: entity.description ?? "",
    properties: entity.properties,
    linkedCharacterIds: entity.linkedCharacterIds ?? [],
    linkedLocationIds: entity.linkedLocationIds ?? [],
    linkedPlotThreadIds: entity.linkedPlotThreadIds ?? [],
    linkedEntityIds: entity.linkedEntityIds ?? [],
    alwaysInContext: entity.alwaysInContext ?? false,
    sortOrder: entity.sortOrder ?? 0,
  };
}

export async function createWorldEntity(
  ctx: RequestContext,
  input: CreateWorldEntityInput,
  repo: Pick<WorldEntityCrudRepository, "ownsProject" | "create" | "findScoped">,
  hooks: PostCommitHooks = {},
  /** DI seam for the embedding service. May reject; treated as no-embedding. */
  embedText: (text: string) => Promise<number[] | null> = async () => null,
): Promise<CreateWorldEntityResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }

  const embedding = await embedText(buildWorldEntityEmbeddingText(input.entity)).catch(() => null);
  const row = await repo.create(input.projectId, {
    ...worldEntityInsertFields(input.entity),
    embedding,
  });
  // INSERT ... RETURNING either yields the row or the statement throws; a null
  // here is an adapter invariant violation, surfaced as a plain refusal.
  if (!row) return { ok: false, status: 404, reason: "Not found" };

  let similarEntities: SimilarEntityMatch[] = [];
  if (embedding) {
    // Scoped to the same kind and excluding the new row itself — the exact pool
    // the pre-migration route queried.
    const others = await repo.findScoped(input.projectId, {
      kind: input.entity.kind,
      excludeId: row.id,
      onlyWithEmbedding: true,
    });
    similarEntities = findSimilarEntities(
      embedding,
      // `findScoped` returns whole rows (an index-signature type, so TS needs
      // the unknown bridge); the scan reads only the identity fields.
      others as unknown as Array<{ id: string; name: string; embedding: number[] | null }>,
    );
  }

  await hooks.onCanonicalMutation?.(input.projectId, "worldEntity.create");
  return { ok: true, entity: row, similarEntities };
}

export async function listWorldEntities(
  ctx: RequestContext,
  input: { projectId: string },
  repo: Pick<WorldEntityCrudRepository, "ownsProject" | "findScoped">,
): Promise<ListWorldEntitiesResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  return { ok: true, entities: await repo.findScoped(input.projectId) };
}

// ------------------------------------------------------------------ update/delete

export interface UpdateWorldEntityInput {
  projectId: string;
  entityId: string;
  /**
   * Pre-sanitized by the route (manual allowlist + kind/properties parsing).
   * The handler still owns `updatedAt` so a local host cannot be handed a
   * client-chosen timestamp by omission.
   */
  patch: Record<string, unknown>;
}

export type UpdateWorldEntityResult =
  | { ok: true; entity: WorldEntityRow }
  | { ok: false; status: 403 | 404; reason: string };

export async function updateWorldEntity(
  ctx: RequestContext,
  input: UpdateWorldEntityInput,
  repo: Pick<WorldEntityCrudRepository, "ownsProject" | "updateScoped">,
  hooks: PostCommitHooks = {},
): Promise<UpdateWorldEntityResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }

  const entity = await repo.updateScoped(input.projectId, input.entityId, {
    ...input.patch,
    updatedAt: new Date(),
  });
  // No row matched: the entityId belongs to a different project, or is gone.
  if (!entity) return { ok: false, status: 404, reason: "Not found" };

  await hooks.onCanonicalMutation?.(input.projectId, "worldEntity.update");
  return { ok: true, entity };
}

export async function deleteWorldEntity(
  ctx: RequestContext,
  input: { projectId: string; entityId: string },
  repo: Pick<WorldEntityCrudRepository, "ownsProject" | "deleteScoped">,
  hooks: PostCommitHooks = {},
): Promise<{ ok: boolean; status?: 403 | 404 }> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403 };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404 };
  }
  await repo.deleteScoped(input.projectId, input.entityId);
  // Deleting an entity is a canonical mutation: the revision bumps after the
  // scoped delete actually ran, mirroring `deleteChapter`'s post-commit rule.
  await hooks.onCanonicalMutation?.(input.projectId, "worldEntity.delete");
  return { ok: true };
}
