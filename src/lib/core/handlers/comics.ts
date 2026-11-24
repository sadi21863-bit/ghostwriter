/**
 * Phase 2 / v4 §7 — comic page/panel CRUD as shared business handlers.
 *
 * Previously inlined across five Cloud routes: the comics list/create route
 * (`comics/route.ts`), the page delete (`comics/[pageId]`), the panel patch
 * (`.../panels/[panelId]`), the regenerate route's two DB write branches, and
 * the letter route's terminal write. Same shape as `createCharacter` /
 * `updateWorldEntity`:
 *  - the context's `projectScope` is checked BEFORE the repository, so a scope
 *    mismatch is an explicit 403 instead of a silent wrong-project write;
 *  - ownership is re-proved through the port, and refusal is a 404;
 *  - §11 canonical mutations fire via the awaited `onCanonicalMutation` hook —
 *    `comicPage.create` / `comicPage.delete` / `comicPanel.create` /
 *    `comicPanel.update` / `comicPanel.regenerate` / `comicPanel.letter` —
 *    only after the scoped write actually ran, never on a refusal path. The
 *    pre-migration comic routes never bumped a revision at all; this migration
 *    ADDS the bump on the same verbs, the way every other migrated handler's
 *    adapter wires `pgPostCommitHooks` in.
 *
 * Mechanics that moved here from the routes:
 *  - `updateComicPanel` owns the Phase-C candidate-promotion swap (read the
 *    current panel, refuse an unknown candidate with the route's exact 400
 *    message, filter the promoted URL out of the candidates, push the old
 *    primary back in, then write). The route only builds the allowlisted raw
 *    patch and passes `promoteCandidateUrl` through — a non-string value is
 *    ignored, exactly as the old route ignored it;
 *  - `deployPanelImage` owns the regenerate route's Phase-C keepAsCandidate
 *    branch: candidate-append vs primary-overwrite. The route decides WHICH
 *    mode applies (it needs the pre-generation panel state for that decision
 *    and for the generation itself); the handler owns the array mechanics and
 *    the post-write bump;
 *  - `letterComicPanel` owns the letter route's refusal ladder (project 404 →
 *    panel 404 → page 404 → the dialogue/caption 400) and the post-write bump;
 *    the composite/upload I/O stays at the transport edge through the
 *    `compose`/`upload` DI seams (sharp + Vercel Blob + the Blob-config
 *    env gate and the source-image fetch are transport concerns).
 *
 * What STAYED transport-coupled, deliberately (external-spend orchestration
 * is not ported until the image-provider slice ships a generation port):
 *  - POST `comics/route.ts`'s Claude scene-breakdown, Segmind/Soul or
 *    StoryDiffusion page generation, Vercel Blob upload closure, and the
 *    fire-and-forget Phase-B vision-critic scoring sweep. The CRUD verbs that
 *    route still carries (page insert, panel inserts) go through the handlers
 *    below; the generation verbs remain inline in the route with a doc-comment
 *    pointing here. The critic's qualityScore/Weakest/Note write is an
 *    annotation on an existing panel, not a canon change, so it bumps nothing;
 *  - POST `.../panels/[panelId]/regenerate`'s provider call + Blob upload, for
 *    the same reason;
 *  - `comics/export/route.ts` entirely: a CBZ export is a fetch → sharp-page
 *    composition → zip → Blob pipeline whose only response is a download URL —
 *    no CRUD verb to extract, and a binary pipeline never gets reshaped into a
 *    handler result.
 *
 * Field validation stays at the route (the allowlist and body parsing); these
 * handlers take already-validated input. `comicPanels` carries NO `updatedAt`
 * column, so unlike `updateCharacter`/`updateWorldEntity` there is no touch
 * stamp: an empty patch performs the same (degenerate) update the old route
 * did — real Drizzle rejects `.set({})` — and fires no hook.
 */

import type { RequestContext } from "@/lib/core/request-context";
import type { ChildResourceRepository, PostCommitHooks } from "@/lib/core/repositories";

export interface ComicPageRow {
  id: string;
  projectId: string;
  chapterId: string;
  pageNumber: number;
  artStyle: string;
  createdAt?: Date;
  [key: string]: unknown;
}

export interface ComicPanelRow {
  id: string;
  pageId: string;
  projectId: string;
  panelIndex: number;
  imageUrl: string;
  panelPrompt: string;
  referenceImageUrl?: string | null;
  characterName?: string | null;
  artStylePreset?: string | null;
  dialogue?: string | null;
  caption?: string | null;
  speakerName?: string | null;
  bubbleType?: string | null;
  letteredImageUrl?: string | null;
  qualityScore?: number | null;
  qualityWeakest?: string | null;
  qualityNote?: string | null;
  reviewStatus?: string | null;
  candidateImageUrls?: string[] | null;
  createdAt?: Date;
  [key: string]: unknown;
}

export interface ComicPageCrudRepository {
  /** True when the project exists and belongs to this actor. */
  ownsProject(projectId: string, actorId: string): Promise<boolean>;
  /**
   * A minimal read used to derive the next `pageNumber`
   * (`existingPages.length + 1`, the pre-migration rule verbatim).
   */
  countByProject(projectId: string): Promise<number>;
  /**
   * Pages ordered newest-first with their panels nested in `panelIndex` order —
   * the exact shape the comics GET returned (`with.panels` nested read).
   */
  listWithPanels(projectId: string): Promise<ComicPageRow[]>;
  /** Insert one page; the adapter stamps the project scope. */
  create(projectId: string, fields: Record<string, unknown>): Promise<ComicPageRow | null>;
  /** Scoped delete. Matches zero rows silently (a deleted page deletes twice). */
  deleteScoped(projectId: string, pageId: string): Promise<void>;
}

export interface ComicPanelCrudRepository {
  /** True when the project exists and belongs to this actor. */
  ownsProject(projectId: string, actorId: string): Promise<boolean>;
  /** Full panel read scoped to the project. Null when absent or foreign. */
  findScoped(projectId: string, panelId: string): Promise<ComicPanelRow | null>;
  /** Insert one panel; the adapter stamps the project scope. */
  create(projectId: string, fields: Record<string, unknown>): Promise<ComicPanelRow | null>;
  /** Apply a partial update, scoped to the project. Null when no row matched. */
  updateScoped(projectId: string, panelId: string, patch: Record<string, unknown>): Promise<ComicPanelRow | null>;
}

// ----------------------------------------------------------------- comic pages

export type ListComicPagesResult =
  | { ok: true; pages: ComicPageRow[] }
  | { ok: false; status: 403 | 404; reason: string };

export async function listComicPages(
  ctx: RequestContext,
  input: { projectId: string },
  repo: Pick<ComicPageCrudRepository, "ownsProject" | "listWithPanels">,
): Promise<ListComicPagesResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  return { ok: true, pages: await repo.listWithPanels(input.projectId) };
}

export interface ComicPageCreateData {
  chapterId: string;
  artStyle: string;
}

export type CreatePageResult =
  | { ok: true; page: ComicPageRow }
  | { ok: false; status: 403 | 404; reason: string };

/**
 * Create the next comic page. The chapter's existence + content were already
 * verified by the route (generation pre-flight); this handler owns the page
 * NUMBER rule (`existing pages + 1`) and the post-insert bump. Returns the
 * created row because the caller needs its id for panel paths.
 */
export async function createComicPage(
  ctx: RequestContext,
  input: { projectId: string; data: ComicPageCreateData },
  repo: Pick<ComicPageCrudRepository, "ownsProject" | "countByProject" | "create">,
  hooks: PostCommitHooks = {},
): Promise<CreatePageResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }

  const pageNumber = (await repo.countByProject(input.projectId)) + 1;
  const page = await repo.create(input.projectId, {
    chapterId: input.data.chapterId,
    pageNumber,
    artStyle: input.data.artStyle,
  });
  // INSERT ... RETURNING either yields the row or the statement throws; a null
  // here is an adapter invariant violation, surfaced as a plain refusal.
  if (!page) return { ok: false, status: 404, reason: "Not found" };

  await hooks.onCanonicalMutation?.(input.projectId, "comicPage.create");
  return { ok: true, page };
}

export type DeletePageResult =
  | { ok: true }
  | { ok: false; status: 403 | 404; reason: string };

export async function deleteComicPage(
  ctx: RequestContext,
  input: { projectId: string; pageId: string },
  repo: Pick<ComicPageCrudRepository, "ownsProject" | "deleteScoped">,
  hooks: PostCommitHooks = {},
): Promise<DeletePageResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  await repo.deleteScoped(input.projectId, input.pageId);
  // Deleting a page (and its panels, cascade) is canonical: the revision bumps
  // after the scoped delete actually ran, never on the refusal paths. Note the
  // original DELETE returned `{ ok: true }` even when the row was already gone
  // (a scoped DELETE matches zero rows silently), so `deleteScoped` does not
  // verify a match; that behaviour is preserved.
  await hooks.onCanonicalMutation?.(input.projectId, "comicPage.delete");
  return { ok: true };
}

// ---------------------------------------------------------------- comic panels

export interface ComicPanelCreateData {
  pageId: string;
  panelIndex: number;
  imageUrl: string;
  panelPrompt: string;
  referenceImageUrl?: string;
  characterName?: string;
  artStylePreset?: string;
}

export type CreatePanelResult =
  | { ok: true; panel: ComicPanelRow }
  | { ok: false; status: 403 | 404; reason: string };

/**
 * Persist one generated panel. The caller (the comics POST route's generation
 * loop) already resolved prompt/reference/art-style fields; this handler owns
 * the scoped insert and the post-insert bump, one per panel. A page whose
 * whole batch was rejected therefore bumps only `comicPage.create`.
 */
export async function createComicPanel(
  ctx: RequestContext,
  input: { projectId: string; data: ComicPanelCreateData },
  repo: Pick<ComicPanelCrudRepository, "ownsProject" | "create">,
  hooks: PostCommitHooks = {},
): Promise<CreatePanelResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }

  const panel = await repo.create(input.projectId, {
    pageId: input.data.pageId,
    panelIndex: input.data.panelIndex,
    imageUrl: input.data.imageUrl,
    panelPrompt: input.data.panelPrompt,
    referenceImageUrl: input.data.referenceImageUrl,
    characterName: input.data.characterName,
    artStylePreset: input.data.artStylePreset,
  });
  if (!panel) return { ok: false, status: 404, reason: "Not found" };

  await hooks.onCanonicalMutation?.(input.projectId, "comicPanel.create");
  return { ok: true, panel };
}

export interface UpdateComicPanelInput {
  projectId: string;
  panelId: string;
  /**
   * The allowlisted client patch, pre-sanitized by the route (unknown keys
   * dropped silently — there was never an "invalid fields" 400 on this verb).
   */
  patch: Record<string, unknown>;
  /**
   * Phase-C candidate promotion. Ignored unless a string, matching the old
   * route's `typeof === "string"` guard: a non-string never promoted and was
   * never on the allowlist either.
   */
  promoteCandidateUrl?: unknown;
}

export type UpdatePanelResult =
  | { ok: true; panel: ComicPanelRow }
  | { ok: false; status: 400 | 403 | 404; reason: string };

/**
 * The panel PATCH verb: fused allowlist write + Phase-C candidate promotion.
 * When promoting, the current panel is read FIRST and an unknown candidate is
 * refused with the route's exact 400 body before anything is written; a valid
 * promotion computes the swap (promoted URL → primary, old primary → appended
 * to the remaining candidates) and merges over any allowlisted fields, exactly
 * as the old route's shared `update` record did.
 */
export async function updateComicPanel(
  ctx: RequestContext,
  input: UpdateComicPanelInput,
  repo: Pick<ComicPanelCrudRepository, "ownsProject" | "findScoped" | "updateScoped">,
  hooks: PostCommitHooks = {},
): Promise<UpdatePanelResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }

  const patch: Record<string, unknown> = { ...input.patch };
  if (typeof input.promoteCandidateUrl === "string") {
    const current = await repo.findScoped(input.projectId, input.panelId);
    if (!current) return { ok: false, status: 404, reason: "Panel not found" };
    const promoted = input.promoteCandidateUrl;
    const existingCandidates = (current.candidateImageUrls ?? []).filter(
      (u): u is string => typeof u === "string",
    );
    if (!existingCandidates.includes(promoted)) {
      return { ok: false, status: 400, reason: "Not a known candidate for this panel." };
    }
    const nextCandidates = existingCandidates.filter((u) => u !== promoted);
    if (current.imageUrl) nextCandidates.push(current.imageUrl);
    patch.imageUrl = promoted;
    patch.candidateImageUrls = nextCandidates;
  }

  const panel = await repo.updateScoped(input.projectId, input.panelId, patch);
  // No row matched: the panelId belongs to a different project, or is gone.
  // (The pre-migration route answered this with an empty 200 via
  // `NextResponse.json(undefined)`; 404 here mirrors every other migrated
  // update handler for the identical edge.)
  if (!panel) return { ok: false, status: 404, reason: "Not found" };

  // The revision bumps only when the write actually changed something the
  // client asked for: an empty allowlist patch (and no promotion) writes
  // nothing meaningful, so the hook stays silent.
  if (Object.keys(patch).length > 0) {
    await hooks.onCanonicalMutation?.(input.projectId, "comicPanel.update");
  }

  return { ok: true, panel };
}

export interface DeployPanelImageInput {
  projectId: string;
  panelId: string;
  /** The freshly generated (and already uploaded) image URL. */
  imageUrl: string;
  /**
   * Phase-C keepAsCandidate — append instead of overwriting the primary. The
   * caller decides (only meaningful when a primary already existed before
   * generation); this handler owns the array mechanics.
   */
  keepAsCandidate: boolean;
  /** The candidates array read BEFORE generation; appended to, never replaced. */
  existingCandidateUrls?: string[];
}

/**
 * The regenerate route's post-generation write: overwrite the panel's primary
 * image, or — keepAsCandidate — append the new URL to `candidateImageUrls`
 * leaving the primary untouched. Candidates are not auto-scored by the
 * vision-critic (qualityScore/Weakest/Note stay singular per-panel fields
 * tracking the PRIMARY), and neither branch rescoring happens here — the
 * route's fire-and-forget scoring stays transport-coupled.
 */
export async function deployPanelImage(
  ctx: RequestContext,
  input: DeployPanelImageInput,
  repo: Pick<ComicPanelCrudRepository, "ownsProject" | "updateScoped">,
  hooks: PostCommitHooks = {},
): Promise<UpdatePanelResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }

  const patch: Record<string, unknown> = input.keepAsCandidate
    ? { candidateImageUrls: [...(input.existingCandidateUrls ?? []), input.imageUrl] }
    : { imageUrl: input.imageUrl };
  const panel = await repo.updateScoped(input.projectId, input.panelId, patch);
  if (!panel) return { ok: false, status: 404, reason: "Not found" };

  await hooks.onCanonicalMutation?.(input.projectId, "comicPanel.regenerate");
  return { ok: true, panel };
}

// ------------------------------------------------------------------- lettering

/**
 * What the transport's compose step may answer. The two refusal shapes carry
 * the letter route's own gates: an unconfigured Blob store (500) and an
 * unfetchable source image (502). Any composite failure (sharp throwing)
 * propagates and surfaces as the same 500 the route always produced.
 */
export type LetteringComposeResult =
  | { ok: true; lettered: Buffer }
  | { ok: false; status: 500 | 502; reason: string };

export interface ComicLetteringDeps {
  panelRepo: Pick<ComicPanelCrudRepository, "ownsProject" | "findScoped" | "updateScoped">;
  pageRepo: Pick<ChildResourceRepository, "owns">;
  /** Fetch the panel's raw art and composite its lettering. Transport I/O. */
  compose(args: { panel: ComicPanelRow; projectId: string; pageId: string }): Promise<LetteringComposeResult>;
  /** Persist the composited buffer (e.g. Vercel Blob) and return its URL. */
  upload(args: { lettered: Buffer; panel: ComicPanelRow; projectId: string; pageId: string }): Promise<string>;
}

export type LetterPanelResult =
  | { ok: true; panel: ComicPanelRow }
  | { ok: false; status: 400 | 403 | 404 | 500 | 502; reason: string };

/**
 * The letter verb's refusal ladder, in the route's original order: context
 * scope → project ownership → panel read → page ownership → the
 * dialogue/caption gate → compose gates. Only after all of those does the
 * composite run, the upload land, and `letteredImageUrl` be written (never
 * overwriting the raw `imageUrl`, so re-lettering after a text edit never
 * re-runs generation).
 */
export async function letterComicPanel(
  ctx: RequestContext,
  input: { projectId: string; pageId: string; panelId: string },
  deps: ComicLetteringDeps,
  hooks: PostCommitHooks = {},
): Promise<LetterPanelResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await deps.panelRepo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }

  const panel = await deps.panelRepo.findScoped(input.projectId, input.panelId);
  if (!panel) return { ok: false, status: 404, reason: "Panel not found" };

  const pageOwned = await deps.pageRepo.owns({
    resource: "comic_pages",
    childId: input.pageId,
    projectId: input.projectId,
  });
  if (!pageOwned) return { ok: false, status: 404, reason: "Page not found" };

  if (!panel.dialogue?.trim() && !panel.caption?.trim()) {
    return { ok: false, status: 400, reason: "Add dialogue or a caption before lettering this panel." };
  }

  const composed = await deps.compose({ panel, projectId: input.projectId, pageId: input.pageId });
  if (!composed.ok) return { ok: false, status: composed.status, reason: composed.reason };

  const letteredUrl = await deps.upload({
    lettered: composed.lettered,
    panel,
    projectId: input.projectId,
    pageId: input.pageId,
  });

  const updated = await deps.panelRepo.updateScoped(input.projectId, input.panelId, {
    letteredImageUrl: letteredUrl,
  });
  if (!updated) return { ok: false, status: 404, reason: "Not found" };

  await hooks.onCanonicalMutation?.(input.projectId, "comicPanel.letter");
  return { ok: true, panel: updated };
}
