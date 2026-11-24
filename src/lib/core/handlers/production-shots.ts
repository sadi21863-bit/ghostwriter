/**
 * Phase 2 / v4 §7 — production-shot CRUD as shared business handlers.
 *
 * Previously inlined in `src/app/api/projects/[projectId]/production/shots/route.ts`
 * (GET list) and `.../shots/[shotId]/route.ts` (PATCH): an ownership probe plus a
 * raw Drizzle read/write per verb, with the PATCH carrying the Phase C
 * promote-candidate branch and the auto prompt-rebuild rule. The handlers below
 * take a `RequestContext` and a repository port — no NextAuth, no `@/db`, no
 * `next/server` — so a local host can serve the same rules without forking this
 * file. Shape mirrors `updateCharacter` in `handlers/characters.ts`.
 *
 *  - the context's `projectScope` is checked BEFORE the repository, so a scope
 *    mismatch is an explicit 403 instead of a silent wrong-project read/write;
 *  - ownership is re-proved through the port, and refusal is a 404;
 *  - §11 canonical mutations fire via the awaited `onCanonicalMutation` hook —
 *    `shot.update`, the PATCH's FIRST revision bump (the old route never
 *    bumped one) — only after the scoped write actually ran, wired by the
 *    adapter through `pgPostCommitHooks`.
 *  - empty-patch convention: the hook fires only when at least one
 *    client-sourced field survived the adapter's ALLOWED_FIELDS filter or the
 *    promote branch actually ran; an empty patch still writes a fresh
 *    `updatedAt` (touch, not a canon change).
 *
 * Scope of this migration (CRUD only). Deliberately NOT extracted, and staying
 * transport-coupled in their route files until the generation slice:
 *  - `shots/[shotId]/preview/route.ts` — Segmind soul-image generation. Its
 *    `keepAsCandidate` branch (append to `candidatePreviewUrls` instead of
 *    overwriting the primary) is inseparable from the generated image, so the
 *    mutation half of that mechanic lives there with a pointer comment here;
 *    the promote half (candidate → primary) IS here.
 *  - `shots/[shotId]/animate(/status)`, `.../generate-video(/status)`,
 *    `production/preview-all` (spend-clamped batch), `generate-package`, and
 *    the `scenes/[sceneNumber]` binary/ffmpeg verbs (upload-audio/add-music,
 *    form-data + sharp/ffmpeg; generate-video + its QStash poll + stitch loop)
 *    — external-spend orchestration, streaming and binary responses.
 * Reorder: the client computes `reorderIds`/`changedOrders`
 * (`src/lib/production/reorder.ts`, pure) and PATCHes only the shots whose
 * `sortOrder` moved through this PATCH — there is no server reorder route to
 * extract; the port's PATCH covers the mechanic.
 *
 * Shim note: `post-write ordering` for promote/patch is write → hook → return,
 * mirroring `updateCharacter`; the 404-on-null-updateScoped case below is the
 * race-window adapter invariant (row vanished between read and write).
 */

import type { RequestContext } from "@/lib/core/request-context";
import type { PostCommitHooks } from "@/lib/core/repositories";
import { buildShotPromptFragment } from "@/lib/ai/shot-parameters";

export interface ProductionShotRow {
  id: string;
  projectId: string;
  [key: string]: unknown;
}

/**
 * The PATCH's mutation input. `patch` is the ROUTE's already-filtered
 * ALLOWED_FIELDS projection (silent filtering, no 400 — matching every other
 * migrated adapter's "input arrives validated" contract); `promoteCandidateUrl`
 * is the raw Phase C promote verb, validated by the handler because it is a
 * business rule over the CURRENT row, not a shape check.
 */
export interface UpdateShotInput {
  projectId: string;
  shotId: string;
  patch: Record<string, unknown>;
  promoteCandidateUrl?: unknown;
}

export interface ProductionShotCrudRepository {
  /** True when the project exists and belongs to this actor. */
  ownsProject(projectId: string, actorId: string): Promise<boolean>;
  /** The exact shot the old PATCH re-read to merge prompt rebuilds, scoped. */
  findById(projectId: string, shotId: string): Promise<ProductionShotRow | null>;
  /**
   * The project's full shot list, ordered (sceneNumber, shotNumber) — the
   * adapter decides relation loading (the cloud adapter joins primaryCharacter).
   */
  list(projectId: string): Promise<ProductionShotRow[]>;
  /** Apply a partial update, scoped to the project. Returns null if no row matched. */
  updateScoped(
    projectId: string,
    shotId: string,
    patch: Record<string, unknown>,
  ): Promise<ProductionShotRow | null>;
}

export type ListProductionShotsResult =
  | { ok: true; shots: ProductionShotRow[] }
  | { ok: false; status: 403 | 404; reason: string };

export type UpdateProductionShotResult =
  | { ok: true; shot: ProductionShotRow }
  | { ok: false; status: 400 | 403 | 404; reason: string };

export async function listProductionShots(
  ctx: RequestContext,
  input: { projectId: string },
  repo: Pick<ProductionShotCrudRepository, "ownsProject" | "list">,
): Promise<ListProductionShotsResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }
  const shots = await repo.list(input.projectId);
  return { ok: true, shots };
}

/** Shot parameters that trigger the auto prompt-rebuild when any one changes. */
export const SHOT_PROMPT_PARAM_FIELDS = [
  "shotType", "cameraMovement", "lightingMood", "timeOfDay", "subject", "action", "location",
];

/**
 * Apply a partial update with the PATCH's exact business rules: the promote
 * branch runs against the CURRENT row's candidates BEFORE the prompt rebuild
 * reads the merged values, and `updatedAt` goes LAST so the server-owned stamp
 * cannot be overwritten by the patch.
 */
export async function updateProductionShot(
  ctx: RequestContext,
  input: UpdateShotInput,
  repo: Pick<ProductionShotCrudRepository, "ownsProject" | "findById" | "updateScoped">,
  hooks: PostCommitHooks = {},
): Promise<UpdateProductionShotResult> {
  if (ctx.projectScope !== undefined && ctx.projectScope !== input.projectId) {
    return { ok: false, status: 403, reason: "Context is not scoped to this project." };
  }
  if (!(await repo.ownsProject(input.projectId, ctx.actor.id))) {
    return { ok: false, status: 404, reason: "Not found" };
  }

  // The old route re-read the CURRENT row before touching anything — promote
  // and the prompt rebuild merge against it. Still include projectId in the
  // scoped lookup so a cross-project shotId 404s here (IDOR kept verbatim).
  const current = await repo.findById(input.projectId, input.shotId);
  if (!current) return { ok: false, status: 404, reason: "Shot not found" };

  const updates: Record<string, unknown> = { ...input.patch };
  // Phase C "keep N candidates" — promote a candidate to primary. The old
  // primary (if any) goes back into the candidates array so nothing is lost;
  // the promoted URL is removed from candidates since it's now the primary.
  // A non-string promoteCandidateUrl is silently ignored (verbatim old skip).
  let promoted = false;
  if (typeof input.promoteCandidateUrl === "string") {
    const promotedUrl: string = input.promoteCandidateUrl;
    const existingCandidates: unknown[] =
      (current.candidatePreviewUrls as unknown[] | null | undefined) ?? [];
    if (!existingCandidates.includes(promotedUrl)) {
      return { ok: false, status: 400, reason: "Not a known candidate for this shot." };
    }
    const nextCandidates = existingCandidates.filter((u) => u !== promotedUrl);
    if (current.previewImageUrl) nextCandidates.push(current.previewImageUrl);
    updates.previewImageUrl = promotedUrl;
    updates.candidatePreviewUrls = nextCandidates;
    // The promote request itself mutated the shot — a canon change even when
    // the ALLOWED_FIELDS patch was empty.
    promoted = true;
  }

  const merged = { ...current, ...updates };

  // Auto-rebuild prompts when any shot parameter changes
  if (SHOT_PROMPT_PARAM_FIELDS.some((f) => f in updates)) {
    const typed = merged as {
      shotType?: string; cameraMovement?: string; lightingMood?: string;
      timeOfDay?: string; subject?: string; action?: string; location?: string;
    };
    const fragment = buildShotPromptFragment({
      shotType: typed.shotType ?? "Medium shot",
      cameraMovement: typed.cameraMovement ?? "Static",
      lightingMood: typed.lightingMood ?? "Golden hour",
      timeOfDay: typed.timeOfDay ?? "Afternoon",
    });
    if (!("soulPrompt" in updates)) {
      updates.soulPrompt = `${merged.subject}. ${merged.action}. ${merged.location}. ${fragment}. Photorealistic portrait quality.`;
    }
    if (!("videoPrompt" in updates)) {
      updates.videoPrompt = `${merged.action}. ${merged.location}. ${fragment}. Cinematic motion.`;
    }
  }

  const shot = await repo.updateScoped(input.projectId, input.shotId, {
    ...updates,
    // Server-owned stamp, LAST, exactly like updateCharacter.
    updatedAt: new Date(),
  });
  // Adapter invariant: the row vanished between the read and the write. The
  // old route would have answered 200 with a `{}`-shaped body here; a refusal
  // is the honest result (race window, documented deviation).
  if (!shot) return { ok: false, status: 404, reason: "Shot not found" };

  // Mirrors the sibling handlers: an empty patch is a touch (fresh
  // updatedAt), never a canon mutation; a real client field or an executed
  // promote is.
  if (Object.keys(input.patch).length > 0 || promoted) {
    await hooks.onCanonicalMutation?.(input.projectId, "shot.update");
  }

  return { ok: true, shot };
}
