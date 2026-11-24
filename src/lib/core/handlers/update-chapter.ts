/**
 * Phase 2 / v4 §7 — `updateChapter`, the first shared business handler.
 *
 * v4 §7 names four handlers that must exist once behind auth adapters:
 * `generateChapter`, `updateChapter`, `getStoryBible`, `applyStoryTransaction`.
 * This is the first one, chosen because it is the one route whose tests already
 * pin a real security property (the mass-assignment allowlist and the IDOR fix),
 * so moving its logic must not be able to lose them.
 *
 * It takes a `RequestContext` and repository ports. It does NOT import NextAuth,
 * `@/db`, or `next/server` — the route is now a thin adapter that produces a
 * context, calls the handler, and shapes a response.
 *
 * Every rule that was previously implicit in the route is now explicit here:
 *  - the patch is filtered through an allowlist BEFORE it reaches the repository,
 *    so a caller cannot reassign a chapter or pin an embedding;
 *  - the write is project-scoped, and a scope mismatch is refused rather than
 *    silently returning "not found";
 *  - the embedding refresh runs only after the scoped write actually matched a row.
 */

import type { RequestContext } from "@/lib/core/request-context";
import type { ChapterRepository, ChapterRow, PostCommitHooks } from "@/lib/core/repositories";

/**
 * Columns a client may write. Everything else — `id`, `projectId`, `embedding`,
 * `createdAt` — is server-owned, and passing the raw request body straight to
 * `.set()` would let a caller reassign a chapter to another project, overwrite its
 * id, or pin a crafted embedding that semantic search would then treat as truth.
 */
export const CHAPTER_WRITABLE_FIELDS: ReadonlySet<string> = new Set([
  "title",
  "content",
  "summary",
  "tags",
  "chapterType",
  "sortOrder",
  "wordCount",
  "branchId",
  "branchLabel",
  "parentChapterId",
  "alternateDrafts",
  "emotionalTone",
  "arcPosition",
  "scenes",
  "storylineId",
  "reviewStatus",
]);

/** Keep only writable fields. Exported so the route/test can assert on it. */
export function sanitizeChapterPatch(raw: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (CHAPTER_WRITABLE_FIELDS.has(k)) out[k] = v;
  }
  return out;
}

export interface UpdateChapterInput {
  projectId: string;
  chapterId: string;
  patch: unknown;
}

export type UpdateChapterResult =
  | { ok: true; chapter: ChapterRow; droppedFields: string[] }
  | { ok: false; status: 404 | 403; reason: string };

/**
 * Word count derived from content. Split out so the rule is testable without a
 * repository, and so the TipTap/plain-text distinction is stated in one place.
 */
export function deriveWordCount(content: string, toPlainText: (json: string) => string): number {
  const plain = toPlainText(content);
  return plain.trim().split(/\s+/).filter(Boolean).length;
}

export async function updateChapter(
  ctx: RequestContext,
  input: UpdateChapterInput,
  repo: Pick<ChapterRepository, "ownsProject" | "updateScoped">,
  hooks: PostCommitHooks = {},
  toPlainText: (json: string) => string = (s) => s,
): Promise<UpdateChapterResult> {
  // A context scoped to another project must never act here. Refusing
  // explicitly beats relying on the repository's WHERE clause, so a future
  // repository cannot widen access by accident.
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }

  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }

  const patch = sanitizeChapterPatch(input.patch);
  const droppedFields = Object.keys((input.patch ?? {}) as Record<string, unknown>).filter(
    (k) => !CHAPTER_WRITABLE_FIELDS.has(k),
  );

  if (typeof patch.content === "string") {
    patch.wordCount = deriveWordCount(patch.content, toPlainText);
  }

  const chapter = await repo.updateScoped(input.projectId, input.chapterId, {
    ...patch,
    updatedAt: new Date(),
  });
  // No row matched: the chapterId belongs to a different project, or is gone.
  if (!chapter) return { ok: false, status: 404, reason: "Not found" };

  // Post-commit only. An attacker-supplied chapterId/projectId pair that did not
  // match a row never reaches here, so it can never trigger an embedding write.
  if (typeof patch.content === "string") {
    hooks.onChapterContentChanged?.(input.chapterId, patch.content);
  }
  if (Object.keys(patch).length > 0) {
    await hooks.onCanonicalMutation?.(input.projectId, "chapter.update");
  }

  return { ok: true, chapter, droppedFields };
}

export async function deleteChapter(
  ctx: RequestContext,
  input: { projectId: string; chapterId: string },
  repo: Pick<ChapterRepository, "ownsProject" | "deleteScoped">,
  hooks: PostCommitHooks = {},
): Promise<{ ok: boolean; status?: 403 | 404 }> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403 };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404 };
  }
  await repo.deleteScoped(input.projectId, input.chapterId);
  // Deleting a chapter is as canonical as editing one: the revision bumps too,
  // so a cached bible keyed on the old revision goes stale at the same moment
  // the data disappears. Fires only after the scoped delete actually ran —
  // the same post-commit rule `updateChapter` already follows.
  await hooks.onCanonicalMutation?.(input.projectId, "chapter.delete");
  return { ok: true };
}