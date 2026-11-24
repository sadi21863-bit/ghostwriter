/**
 * Phase 2 / v4 §7 — character CRUD as shared business handlers.
 *
 * Previously inlined in `src/app/api/projects/[projectId]/characters/route.ts`
 * and `.../characters/[characterId]/route.ts`: an ownership probe plus a raw
 * Drizzle write per verb, with the create route additionally carrying the type-53
 * duplicate-entity scan and the fire-and-forget character-intelligence bootstrap.
 * The handlers below take a `RequestContext` and a repository port — no NextAuth,
 * no `@/db`, no `next/server` — so a local host can serve the same rules without
 * forking this file.
 *
 * Shape mirrors `createPlotThread`/`updatePlotThread`/`deletePlotThread`:
 *  - the context's `projectScope` is checked BEFORE the repository, so a scope
 *    mismatch is an explicit 403 instead of a silent wrong-project write;
 *  - ownership is re-proved through the port, and refusal is a 404;
 *  - §11 canonical mutations fire via the awaited `onCanonicalMutation` hook —
 *    `character.create` / `character.update` / `character.delete` — only after
 *    the scoped write actually ran, with the post-delete ordering mirroring
 *    `deleteChapter`;
 *  - `update` fires the hook only when the client-supplied patch is non-empty;
 *    an empty patch still writes a fresh `updatedAt` (touch, not a canon change).
 *
 * When the §11 hook did not exist yet, the old routes never bumped a revision;
 * this migration ADDS the bump on the same verbs, the way every other migrated
 * handler's adapter wires `pgPostCommitHooks` in.
 *
 * Create also carries the type-53 embedding wiring verbatim: the embedding is
 * computed via the `embedText` DI seam (fail-open to null), stored on the row,
 * and the duplicate scan runs over the OTHER in-project rows that carry an
 * embedding, excluding the freshly created one. `postCreate` is the DI seam for
 * the route's `bootstrapCharacterIntelligence` side effect (AI call + its own
 * write); the handler owns WHEN it starts — after the insert and the revision
 * bump — while the route/host supplies the actual I/O.
 *
 * Field validation stays at the route (the `name is required` 400 and the zod
 * `CharacterPatch` allowlist must keep 400-ing there — AFTER the ownership
 * probe, as the original routes ordered it); these handlers take
 * already-validated input and stamp the server-owned `updatedAt` themselves.
 */

import type { RequestContext } from "@/lib/core/request-context";
import type { PostCommitHooks } from "@/lib/core/repositories";
import {
  buildCharacterEmbeddingText,
  findSimilarEntities,
  type SimilarEntityMatch,
} from "@/lib/world-bible/duplicate-detection";

export interface CharacterRow {
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
export interface CharacterCreateData {
  name: string;
  role?: unknown;
  age?: unknown;
  appearance?: unknown;
  personality?: unknown;
  thinkingStyle?: unknown;
  behavior?: unknown;
  habits?: unknown;
  fears?: unknown;
  desires?: unknown;
  speechPattern?: unknown;
  backstory?: unknown;
  arc?: unknown;
  alwaysInContext?: unknown;
  sortOrder?: unknown;
  contextVisibility?: unknown;
}

/** Which rows the duplicate-scan read may select. */
export interface FindCharactersQuery {
  /** Exclude one row id — the freshly created row itself. */
  excludeId?: string;
  /** Only rows carrying an embedding — the duplicate-scan pool. */
  onlyWithEmbedding?: boolean;
}

export interface CharacterCrudRepository {
  /** True when the project exists and belongs to this actor. */
  ownsProject(projectId: string, actorId: string): Promise<boolean>;
  /**
   * The project's `format`, scoped to the actor. Only needed when the host
   * wires `postCreate` (the intelligence bootstrap reads it); callers that
   * don't pay no extra query.
   */
  findProjectFormat(projectId: string, actorId: string): Promise<string | null>;
  /** Insert one character; `fields` already carries the computed embedding. */
  create(projectId: string, fields: Record<string, unknown>): Promise<CharacterRow | null>;
  /**
   * Project-scoped read of rows by id/exclusion/embedding presence, projected
   * to (id, name, embedding) — exactly the columns `findSimilarEntities` needs.
   */
  findScoped(projectId: string, query: FindCharactersQuery): Promise<CharacterRow[]>;
  /** Apply a partial update, scoped to the project. Returns null if no row matched. */
  updateScoped(
    projectId: string,
    characterId: string,
    patch: Record<string, unknown>,
  ): Promise<CharacterRow | null>;
  deleteScoped(projectId: string, characterId: string): Promise<void>;
}

export type CreateCharacterResult =
  | { ok: true; character: CharacterRow; similarEntities: SimilarEntityMatch[] }
  | { ok: false; status: 403 | 404; reason: string };

export type UpdateCharacterResult =
  | { ok: true; character: CharacterRow }
  | { ok: false; status: 403 | 404; reason: string };

export type DeleteCharacterResult =
  | { ok: true }
  | { ok: false; status: 403 | 404; reason: string };

export async function createCharacter(
  ctx: RequestContext,
  input: { projectId: string; data: CharacterCreateData },
  repo: Pick<
    CharacterCrudRepository,
    "ownsProject" | "findProjectFormat" | "create" | "findScoped"
  >,
  hooks: PostCommitHooks = {},
  /** DI seam for the embedding service. May reject; treated as no-embedding. */
  embedText: (text: string) => Promise<number[] | null> = async () => null,
  /** DI seam for the route's `bootstrapCharacterIntelligence` side effect. */
  postCreate?: (row: CharacterRow, projectFormat: string) => void,
): Promise<CreateCharacterResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }

  // The bootstrap's project format, resolved BEFORE any write so a lookup
  // failure can never 500 a response whose write already happened.
  const projectFormat = postCreate
    ? ((await repo.findProjectFormat(input.projectId, ctx.actor.id)) ?? "")
    : "";

  // Cast is behavior-preserving: the old route fed these raw JSON values
  // straight into the builder; the create-data contract is deliberately
  // `unknown` on the optional fields.
  const embedding = await embedText(
    buildCharacterEmbeddingText(input.data as unknown as Parameters<typeof buildCharacterEmbeddingText>[0]),
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
    // The pg adapter's findScoped returns rows that do carry `embedding`
    // (it selects exactly those columns); the row interface just doesn't
    // declare it, mirroring the repository-port shape elsewhere.
    similarEntities = findSimilarEntities(embedding, others as unknown as Parameters<typeof findSimilarEntities>[1]);
  }

  // Post-commit only: a refused request never reaches here, so it can never
  // bump someone else's revision.
  await hooks.onCanonicalMutation?.(input.projectId, "character.create");

  // Fire-and-forget, mirroring the old route: the response is never blocked by
  // the bootstrap, and the callback owns its own error handling.
  postCreate?.(row, projectFormat);

  return { ok: true, character: row, similarEntities };
}

export async function updateCharacter(
  ctx: RequestContext,
  input: { projectId: string; characterId: string; patch: Record<string, unknown> },
  repo: Pick<CharacterCrudRepository, "ownsProject" | "updateScoped">,
  hooks: PostCommitHooks = {},
): Promise<UpdateCharacterResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }

  // `updatedAt` goes LAST so a server-owned stamp cannot be overwritten by the
  // patch, however it was produced.
  const character = await repo.updateScoped(input.projectId, input.characterId, {
    ...input.patch,
    updatedAt: new Date(),
  });
  // No row matched: the characterId belongs to a different project, or is gone.
  if (!character) return { ok: false, status: 404, reason: "Not found" };

  // Mirrors `updatePlotThread`: the revision bumps only when at least one
  // client-sourced field survived validation — an empty patch still writes a
  // fresh `updatedAt` (touch, not a canon change).
  if (Object.keys(input.patch).length > 0) {
    await hooks.onCanonicalMutation?.(input.projectId, "character.update");
  }

  return { ok: true, character };
}

export async function deleteCharacter(
  ctx: RequestContext,
  input: { projectId: string; characterId: string },
  repo: Pick<CharacterCrudRepository, "ownsProject" | "deleteScoped">,
  hooks: PostCommitHooks = {},
): Promise<DeleteCharacterResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  await repo.deleteScoped(input.projectId, input.characterId);
  // Deleting a character is canonical: the revision bumps with it, after the
  // scoped delete actually ran — never on the refusal paths. Note the original
  // DELETE returned `{ ok: true }` even when the row was already gone
  // (a scoped DELETE matches zero rows silently), so `deleteScoped` does not
  // verify a match; that behaviour is preserved.
  await hooks.onCanonicalMutation?.(input.projectId, "character.delete");
  return { ok: true };
}
