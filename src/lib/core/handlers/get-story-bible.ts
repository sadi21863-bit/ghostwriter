/**
 * Phase 2 / v4 §7 — `getStoryBible`, the second shared business handler.
 *
 * The World Bible is seven tables wide: characters, locations, plot threads,
 * world entities, reference works, story memories, and character relationships.
 * Today there is no single read for it — the client either receives the whole
 * project graph inline or fans out across per-entity routes and merges the
 * result itself.
 *
 * Centralizing the read buys three things:
 *
 *  1. **One authorization decision** instead of seven, each re-deriving ownership.
 *  2. **One shape** the local Story OS and the cloud can both produce, so the
 *     shell does not care which host served it.
 *  3. **A natural home for `contentRevision`** (§11). A bible read is exactly the
 *     thing that must never be served stale, and a single aggregated read is
 *     where the revision stamp belongs.
 *
 * Sections degrade to empty arrays rather than failing: a project with no world
 * entities is a normal state, not an error.
 */

import type { RequestContext } from "@/lib/core/request-context";
import type { PostCommitHooks } from "@/lib/core/repositories";

export interface StoryBibleSection {
  readonly characters: readonly Record<string, unknown>[];
  readonly locations: readonly Record<string, unknown>[];
  readonly plotThreads: readonly Record<string, unknown>[];
  readonly worldEntities: readonly Record<string, unknown>[];
  readonly referenceWorks: readonly Record<string, unknown>[];
  readonly storyMemories: readonly Record<string, unknown>[];
  readonly characterRelationships: readonly Record<string, unknown>[];
}

/** The seven World Bible collections, in the order the Story Bible UI shows them. */
export const STORY_BIBLE_SECTIONS = [
  "characters",
  "locations",
  "plotThreads",
  "worldEntities",
  "referenceWorks",
  "storyMemories",
  "characterRelationships",
] as const;

export type StoryBibleSectionName = (typeof STORY_BIBLE_SECTIONS)[number];

export interface StoryBible {
  readonly projectId: string;
  readonly contentRevision: number | null;
  readonly sections: StoryBibleSection;
}

export interface StoryBibleRepository {
  ownsProject(projectId: string, actorId: string): Promise<boolean>;
  /**
   * Read every section for a project. Must return an object keyed by
   * `STORY_BIBLE_SECTIONS`; missing keys are normalized to empty arrays.
   */
  readSections(projectId: string): Promise<Partial<Record<StoryBibleSectionName, readonly Record<string, unknown>[]>>>;
  /** §11: the project's canonical revision, or null when the host has none yet. */
  readContentRevision?(projectId: string): Promise<number | null>;
}

export type GetStoryBibleResult =
  | { ok: true; bible: StoryBible }
  | { ok: false; status: 403 | 404; reason: string };

export function emptySections(): StoryBibleSection {
  return {
    characters: [],
    locations: [],
    plotThreads: [],
    worldEntities: [],
    referenceWorks: [],
    storyMemories: [],
    characterRelationships: [],
  };
}

export async function getStoryBible(
  ctx: RequestContext,
  input: { projectId: string },
  repo: StoryBibleRepository,
  _hooks: PostCommitHooks = {},
): Promise<GetStoryBibleResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }

  const raw = await repo.readSections(input.projectId);

  // Normalize rather than trust: a repository that omits a key must not produce
  // `undefined` sections that the UI then iterates over.
  const base = emptySections();
  const sections: StoryBibleSection = {
    characters: raw.characters ?? base.characters,
    locations: raw.locations ?? base.locations,
    plotThreads: raw.plotThreads ?? base.plotThreads,
    worldEntities: raw.worldEntities ?? base.worldEntities,
    referenceWorks: raw.referenceWorks ?? base.referenceWorks,
    storyMemories: raw.storyMemories ?? base.storyMemories,
    characterRelationships: raw.characterRelationships ?? base.characterRelationships,
  };

  // Read the revision AFTER the sections, not before: a mutation landing in
  // between must not produce a stamp older than the data it labels. A revision
  // that is newer than the data is harmless (it just triggers a refresh); one
  // that is older is a silent staleness bug.
  const contentRevision = repo.readContentRevision
    ? await repo.readContentRevision(input.projectId)
    : null;

  return { ok: true, bible: { projectId: input.projectId, contentRevision, sections } };
}

/** Total row count across all sections — cheap for "is this bible empty?". */
export function bibleSize(bible: StoryBible): number {
  return STORY_BIBLE_SECTIONS.reduce((n, key) => n + bible.sections[key].length, 0);
}
