/**
 * Phase 2 / v4 §7 — location CRUD as shared business handlers.
 *
 * Previously inlined in `src/app/api/projects/[projectId]/locations/route.ts`
 * and `.../locations/[locationId]/route.ts`: an ownership probe plus a raw
 * Drizzle write per verb, with the create route additionally carrying the type-53
 * duplicate-location scan. The handlers below take a `RequestContext` and a
 * repository port — no NextAuth, no `@/db`, no `next/server` — so a local host
 * can serve the same rules without forking this file.
 *
 * Shape mirrors the character/plot-thread handlers exactly:
 *  - the context's `projectScope` is checked BEFORE the repository, so a scope
 *    mismatch is an explicit 403 instead of a silent wrong-project write;
 *  - ownership is re-proved through the port, and refusal is a 404;
 *  - §11 canonical mutations fire via the awaited `onCanonicalMutation` hook —
 *    `location.create` / `location.update` / `location.delete` — only after
 *    the scoped write actually ran, with the post-delete ordering mirroring
 *    `deleteChapter`;
 *  - `update` fires the hook only when the client-supplied patch is non-empty;
 *    an empty patch still writes a fresh `updatedAt` (touch, not a canon change).
 *
 * When the §11 hook did not exist yet, the old routes never bumped a revision;
 * this migration ADDS the bump on the same verbs, the way every other migrated
 * handler's adapter wires `pgPostCommitHooks` in.
 *
 * Create carries the type-53 embedding wiring verbatim: the embedding is
 * computed via the `embedText` DI seam (fail-open to null), stored on the row,
 * and the duplicate scan runs over the OTHER in-project rows that carry an
 * embedding, excluding the freshly created one. Locations have no
 * post-create intelligence bootstrap (that is character-only), so no
 * `postCreate` seam exists here.
 *
 * Field validation stays at the route (the `name is required` 400 and the zod
 * `LocationPatch` allowlist must keep 400-ing there — AFTER the ownership
 * probe, as the original routes ordered it); these handlers take
 * already-validated input and stamp the server-owned `updatedAt` themselves.
 */

import type { RequestContext } from "@/lib/core/request-context";
import type { PostCommitHooks } from "@/lib/core/repositories";
import {
  buildLocationEmbeddingText,
  findSimilarEntities,
  type SimilarEntityMatch,
} from "@/lib/world-bible/duplicate-detection";

export interface LocationRow {
  id: string;
  projectId: string;
  name: string;
  [key: string]: unknown;
}

/**
 * What a create may carry — exactly the fields the POST route destructured from
 * the body. The optional fields stay `unknown` on purpose: that route never
 * validated them (only `name`), and tightening that here would change behaviour
 * this migration must preserve.
 */
export interface LocationCreateData {
  name: string;
  description?: unknown;
  atmosphere?: unknown;
  history?: unknown;
  sensoryDetails?: unknown;
  alwaysInContext?: unknown;
  sortOrder?: unknown;
}

/** Which rows the duplicate-scan read may select. */
export interface FindLocationsQuery {
  /** Exclude one row id — the freshly created row itself. */
  excludeId?: string;
  /** Only rows carrying an embedding — the duplicate-scan pool. */
  onlyWithEmbedding?: boolean;
}

export interface LocationCrudRepository {
  /** True when the project exists and belongs to this actor. */
  ownsProject(projectId: string, actorId: string): Promise<boolean>;
  /** Insert one location; `fields` already carries the computed embedding. */
  create(projectId: string, fields: Record<string, unknown>): Promise<LocationRow | null>;
  /**
   * Project-scoped read of rows by id/exclusion/embedding presence, projected
   * to (id, name, embedding) — exactly the columns `findSimilarEntities` needs.
   */
  findScoped(projectId: string, query: FindLocationsQuery): Promise<LocationRow[]>;
  /** Apply a partial update, scoped to the project. Returns null if no row matched. */
  updateScoped(
    projectId: string,
    locationId: string,
    patch: Record<string, unknown>,
  ): Promise<LocationRow | null>;
  deleteScoped(projectId: string, locationId: string): Promise<void>;
}

export type CreateLocationResult =
  | { ok: true; location: LocationRow; similarEntities: SimilarEntityMatch[] }
  | { ok: false; status: 403 | 404; reason: string };

export type UpdateLocationResult =
  | { ok: true; location: LocationRow }
  | { ok: false; status: 403 | 404; reason: string };

export type DeleteLocationResult =
  | { ok: true }
  | { ok: false; status: 403 | 404; reason: string };

export async function createLocation(
  ctx: RequestContext,
  input: { projectId: string; data: LocationCreateData },
  repo: Pick<LocationCrudRepository, "ownsProject" | "create" | "findScoped">,
  hooks: PostCommitHooks = {},
  /** DI seam for the embedding service. May reject; treated as no-embedding. */
  embedText: (text: string) => Promise<number[] | null> = async () => null,
): Promise<CreateLocationResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }

  // Cast is behavior-preserving, same rationale as the character handler:
  // the old route fed raw JSON values into the builder unvalidated.
  const embedding = await embedText(
    buildLocationEmbeddingText(input.data as unknown as Parameters<typeof buildLocationEmbeddingText>[0]),
  ).catch(() => null);
  const row = await repo.create(input.projectId, { ...input.data, embedding });
  // INSERT ... RETURNING either yields the row or the statement throws; a null
  // here is an adapter invariant violation, surfaced as a plain refusal.
  if (!row) return { ok: false, status: 404, reason: "Not found" };

  let similarEntities: SimilarEntityMatch[] = [];
  if (embedding) {
    // The pre-migration route's exact pool: same project, not this row,
    // embeddings present.
    const others = await repo.findScoped(input.projectId, {
      excludeId: row.id,
      onlyWithEmbedding: true,
    });
    // Same embedded-pool cast as the character handler (adapter selects
    // exactly {id, name, embedding}).
    similarEntities = findSimilarEntities(embedding, others as unknown as Parameters<typeof findSimilarEntities>[1]);
  }

  // Post-commit only: a refused request never reaches here, so it can never
  // bump someone else's revision.
  await hooks.onCanonicalMutation?.(input.projectId, "location.create");

  return { ok: true, location: row, similarEntities };
}

export async function updateLocation(
  ctx: RequestContext,
  input: { projectId: string; locationId: string; patch: Record<string, unknown> },
  repo: Pick<LocationCrudRepository, "ownsProject" | "updateScoped">,
  hooks: PostCommitHooks = {},
): Promise<UpdateLocationResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }

  // `updatedAt` goes LAST so a server-owned stamp cannot be overwritten by the
  // patch, however it was produced.
  const location = await repo.updateScoped(input.projectId, input.locationId, {
    ...input.patch,
    updatedAt: new Date(),
  });
  // No row matched: the locationId belongs to a different project, or is gone.
  if (!location) return { ok: false, status: 404, reason: "Not found" };

  // Mirrors `updatePlotThread`: the revision bumps only when at least one
  // client-sourced field survived validation — an empty patch still writes a
  // fresh `updatedAt` (touch, not a canon change).
  if (Object.keys(input.patch).length > 0) {
    await hooks.onCanonicalMutation?.(input.projectId, "location.update");
  }

  return { ok: true, location };
}

export async function deleteLocation(
  ctx: RequestContext,
  input: { projectId: string; locationId: string },
  repo: Pick<LocationCrudRepository, "ownsProject" | "deleteScoped">,
  hooks: PostCommitHooks = {},
): Promise<DeleteLocationResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  await repo.deleteScoped(input.projectId, input.locationId);
  // Deleting a location is canonical: the revision bumps with it, after the
  // scoped delete actually ran — never on the refusal paths. Note the original
  // DELETE returned `{ ok: true }` even when the row was already gone
  // (a scoped DELETE matches zero rows silently), so `deleteScoped` does not
  // verify a match; that behaviour is preserved.
  await hooks.onCanonicalMutation?.(input.projectId, "location.delete");
  return { ok: true };
}
