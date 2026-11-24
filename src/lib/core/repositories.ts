/**
 * Phase 2 / v4 §7 — repository interfaces.
 *
 * v4 wants ownership helpers to "consume RequestContext and repository
 * interfaces". Core must not import `@/db`, or it can never be pointed at a
 * local SQLite store in Phase 3 without forking every handler.
 *
 * This file declares the ports. The Postgres adapter lives in `pg-repositories.ts`,
 * which is the only new module allowed to import `db`.
 *
 * Every method takes an explicit project scope rather than trusting the caller to
 * remember it. That is what makes the §11 `contentRevision` contract achievable:
 * a repository cannot perform a canonical mutation without being handed the
 * project it belongs to.
 */

export interface ChapterRow {
  id: string;
  projectId: string;
  title?: string | null;
  content?: string | null;
  [key: string]: unknown;
}

export interface ProjectRow {
  id: string;
  userId: string;
  [key: string]: unknown;
}

export interface ChapterRepository {
  /** True when the project exists and belongs to this actor. */
  ownsProject(projectId: string, actorId: string): Promise<boolean>;
  /** Apply a partial update, scoped to the project. Returns null if no row matched. */
  updateScoped(
    projectId: string,
    chapterId: string,
    patch: Record<string, unknown>,
  ): Promise<ChapterRow | null>;
  deleteScoped(projectId: string, chapterId: string): Promise<void>;
}

export interface ProjectRepository {
  findOwned(projectId: string, actorId: string): Promise<ProjectRow | null>;
}

/**
 * A child resource identified by its OWN id, which must be proven to belong to a
 * project before it can be touched. v4 §6.2 calls this the two-tenant ownership
 * matrix; passing a Drizzle table straight into a helper (the old
 * `verifyChildOwnership(table, childId, projectId)`) coupled authorization to
 * the ORM, so naming the resource lets any adapter serve it.
 */
export interface ChildResourceRef {
  /** Stable key, e.g. "comic_pages". Resolved to a table by the adapter. */
  readonly resource: string;
  readonly childId: string;
  readonly projectId: string;
}

export interface ChildResourceRepository {
  owns(ref: ChildResourceRef): Promise<boolean>;
}

/**
 * Every kind the §11 post-commit hook observes — one entry per §11 canonical
 * mutation across the §7/§12 Handler migration, as post-commit
 * revision-invalidation triggers (`pgPostCommitHooks` bumps the project's
 * contentRevision on any of them). Handler call sites pass literal kinds, so a
 * string outside this union is a typo and no longer compiles.
 *
 * Derived from the REAL emission sites (`hooks.onCanonicalMutation?.(…)` across
 * src/lib/core/handlers/*):
 *  - `apply-story-transaction.ts` builds its kind from a `TransactionSource`
 *    template literal, which surfaces here as the three
 *    `storyTransaction.<source>` members;
 *  - deliberately ABSENT: `storyThread.delete` / `storyPromise.delete` — no
 *    handler emits those today (the story-state port has no delete verbs); a
 *    member is added only when a handler actually starts emitting it.
 */
export type CanonicalMutationKind =
  | "chapter.update"
  | "chapter.delete"
  | "character.create"
  | "character.update"
  | "character.delete"
  | "location.create"
  | "location.update"
  | "location.delete"
  | "plotThread.create"
  | "plotThread.update"
  | "plotThread.delete"
  | "referenceWork.create"
  | "referenceWork.delete"
  | "worldEntity.create"
  | "worldEntity.update"
  | "worldEntity.delete"
  | "violation.acknowledge"
  | "relationship.upsert"
  | "project.create"
  | "project.update"
  | "project.delete"
  | "comicPage.create"
  | "comicPage.delete"
  | "comicPanel.create"
  | "comicPanel.update"
  | "comicPanel.regenerate"
  | "comicPanel.letter"
  | "shot.update"
  | "storyThread.create"
  | "storyThread.update"
  | "storyPromise.create"
  | "storyPromise.update"
  | "memory.create"
  | "memory.delete"
  | "checkpoint.create"
  | "checkpoint.delete"
  | "storyTransaction.revert"
  | "storyTransaction.model-proposal"
  | "storyTransaction.user-edit"
  | "storyTransaction.import";

/**
 * Side effects that must happen AFTER a mutation has been confirmed.
 *
 * These are ports rather than direct imports so the handler can be tested without
 * an embedding service, and so a local host can supply a different one.
 */
export interface PostCommitHooks {
  /** Semantic-search embedding for the chapter's new content. Fail-open. */
  onChapterContentChanged?(chapterId: string, content: string): void;
  /** Phase 5A (§11): increment the project's canonical revision. */
  onCanonicalMutation?(projectId: string, kind: CanonicalMutationKind): Promise<void>;
}