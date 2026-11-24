export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { fromSession } from "@/lib/core/auth-decorators";
import { updateProductionShot } from "@/lib/core/handlers/production-shots";
import { pgPostCommitHooks } from "@/lib/core/pg-repositories";
import { pgProductionShotCrudRepository } from "@/lib/core/pg-production-shot-repos";

const ALLOWED_FIELDS = new Set([
  "shotType", "cameraMovement", "lightingMood", "timeOfDay",
  "subject", "action", "location", "mood", "soulPrompt", "videoPrompt",
  "dialogue", "speaker", "cameraPreset", "viralPreset",
  "characterEmotion", "focalLength", "duration", "aspectRatio", "generatedVideoUrl",
  "reviewStatus", "sortOrder", "candidatePreviewUrls", "trimStartSec", "trimEndSec",
]);

/**
 * Phase 2 / v4 §7 — thin auth adapter for `updateProductionShot`.
 *
 * Transport validation stays HERE, in the original order: the ownership probe
 * runs BEFORE the body is read, and the ALLOWED_FIELDS projection silently
 * drops unknown fields (no 400 — exactly the old behavior; `reviewStatus`,
 * `sortOrder`, `trimStartSec`/`trimEndSec`, `generatedVideoUrl` etc. flow
 * through this one PATCH). `promoteCandidateUrl` is passed raw to the handler,
 * which owns the promote-vs-current-row business rule and its 400.
 *
 * §11: this PATCH gains its FIRST canon revision bump — kind `shot.update`,
 * fired only after the scoped write, and only for a non-empty client patch or
 * an executed promote (an empty patch stays a touch).
 *
 * This shot's generation/poll verbs (preview POST with the `keepAsCandidate`
 * append branch, animate + status, generate-video + its QStash poll/status,
 * scene stitch loop) stay transport-coupled by design — see
 * `src/lib/core/handlers/production-shots.ts` for the out-of-scope list.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ projectId: string; shotId: string }> }) {
  const s = await getRequiredSession();
  const { projectId, shotId } = await params;
  if (!(await pgProductionShotCrudRepository.ownsProject(projectId, s.user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const patch: Record<string, unknown> = {};
  for (const key of Array.from(ALLOWED_FIELDS)) {
    if (key in body) patch[key] = body[key];
  }

  const result = await updateProductionShot(
    fromSession(s),
    { projectId, shotId, patch, promoteCandidateUrl: body?.promoteCandidateUrl },
    pgProductionShotCrudRepository,
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json({ shot: result.shot });
}
