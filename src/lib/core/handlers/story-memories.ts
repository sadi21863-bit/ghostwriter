/**
 * Phase 2 / v4 §7 — story-memory CRUD as shared business handlers.
 *
 * Previously inlined in `src/app/api/projects/[projectId]/story-memories/route.ts`:
 * an ownership probe plus a raw Drizzle write per verb. The handlers below take
 * a `RequestContext` and a repository port — no NextAuth, no `@/db`, no
 * `next/server` — so a local host can serve the same rules without forking
 * this file.
 *
 * The `fact is required` 400 stays at the route (transport validation, same
 * class as the `name is required` 400 the character routes kept). The
 * structuredData normalization MOVED here verbatim —
 * `structuredData != null ? decodeMemoryStructuredData(structuredData) : null` —
 * because it never rejects (lenient decode: bad sub-fields drop, the memory
 * still saves), so it is persistence shaping, not a transport error. The pg
 * adapter reproduces the insert's `autoExtracted: false` and the trimmed fact.
 *
 * §11 canonical mutations fire via the awaited `onCanonicalMutation` hook —
 * `memory.create` / `memory.delete` — only after the scoped write actually ran.
 * DELETE keeps the original's silent-zero-match behaviour (a scoped DELETE that
 * matches nothing still returns ok), mirroring `deleteCharacter`.
 */

import type { RequestContext } from "@/lib/core/request-context";
import type { PostCommitHooks } from "@/lib/core/repositories";
import { decodeMemoryStructuredData } from "@/lib/types/story";

export interface StoryMemoryRow {
  id: string;
  projectId: string;
  fact: string;
  [key: string]: unknown;
}

export interface StoryMemoryRepository {
  /** True when the project exists and belongs to this actor. */
  ownsProject(projectId: string, actorId: string): Promise<boolean>;
  /** The project's memories, newest first — the GET order the UI renders. */
  findScoped(projectId: string): Promise<StoryMemoryRow[]>;
  /** Insert one memory; `fields` already carries the normalized structuredData. */
  create(projectId: string, fields: Record<string, unknown>): Promise<StoryMemoryRow>;
  deleteScoped(projectId: string, memoryId: unknown): Promise<void>;
}

export type StoryMemoryRefusal = { ok: false; status: 403 | 404; reason: string };

export type ListStoryMemoriesResult =
  | { ok: true; memories: StoryMemoryRow[] }
  | StoryMemoryRefusal;

export type CreateStoryMemoryResult =
  | { ok: true; memory: StoryMemoryRow }
  | StoryMemoryRefusal;

export type DeleteStoryMemoryResult = { ok: true } | StoryMemoryRefusal;

export async function listStoryMemories(
  ctx: RequestContext,
  input: { projectId: string },
  repo: Pick<StoryMemoryRepository, "ownsProject" | "findScoped">,
): Promise<ListStoryMemoriesResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  return { ok: true, memories: await repo.findScoped(input.projectId) };
}

export async function createStoryMemory(
  ctx: RequestContext,
  input: {
    projectId: string;
    /** Already 400-guarded (truthy after trim) by the route. */
    fact: unknown;
    /** Already defaulted to "general" by the route. */
    category?: unknown;
    /** Leniently decoded here — the null/empty guard copied verbatim. */
    structuredData?: unknown;
    /**
     * PLAN-v5 — the memory's place in the timeline. Story Doctor's knowledge
     * check needs the 0-based chapter index the note was written for; without
     * it every shift lands at chapter 0 and no earlier chapter can conflict.
     */
    chapterIndex?: unknown;
    chapterId?: unknown;
  },
  repo: Pick<StoryMemoryRepository, "ownsProject" | "create">,
  hooks: PostCommitHooks = {},
): Promise<CreateStoryMemoryResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }

  const memory = await repo.create(input.projectId, {
    fact: (input.fact as string).trim(),
    category: input.category,
    // Normalize through the story guard so only a consistent, known shape is
    // ever persisted. Lenient (not strict encode) because structuredData is
    // AI-generated best-effort — drop bad sub-fields rather than reject the memory.
    structuredData: input.structuredData != null ? decodeMemoryStructuredData(input.structuredData) : null,
    autoExtracted: false,
    ...(typeof input.chapterIndex === "number" && Number.isFinite(input.chapterIndex)
      ? { chapterIndex: Math.max(0, Math.trunc(input.chapterIndex)) }
      : {}),
    ...(typeof input.chapterId === "string" && input.chapterId ? { chapterId: input.chapterId } : {}),
  });
  await hooks.onCanonicalMutation?.(input.projectId, "memory.create");
  return { ok: true, memory };
}

export async function deleteStoryMemory(
  ctx: RequestContext,
  input: { projectId: string; memoryId: unknown },
  repo: Pick<StoryMemoryRepository, "ownsProject" | "deleteScoped">,
  hooks: PostCommitHooks = {},
): Promise<DeleteStoryMemoryResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  // A scoped DELETE matching zero rows (already-gone or bogus id from the body)
  // stays a silent ok — the original route's exact behaviour.
  await repo.deleteScoped(input.projectId, input.memoryId);
  await hooks.onCanonicalMutation?.(input.projectId, "memory.delete");
  return { ok: true };
}
