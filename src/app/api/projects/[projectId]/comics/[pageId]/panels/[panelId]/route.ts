export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { fromSession } from "@/lib/core/auth-decorators";
import { updateComicPanel } from "@/lib/core/handlers/comics";
import { pgComicPanelCrudRepository } from "@/lib/core/pg-comic-repos";
import { pgPostCommitHooks } from "@/lib/core/pg-repositories";

/**
 * Phase 2 / v4 §7 — thin auth adapter for `updateComicPanel` (the fused
 * allowlist write + Phase-C candidate promotion).
 *
 * Transport validation stays HERE, in the original order: the ownership probe
 * runs BEFORE the body is read, so a wrong-project caller 404s without their
 * patch being inspected (the `404-before-400` order of today's route). The
 * allowlist stays here too — unknown keys are dropped silently, as they always
 * were; `pageId` is carried by the URL shape but the verb never used it.
 *
 * The candidate-promotion swap (read current panel → refuse unknown candidate
 * → compute the candidates array → write) and the §11 revision bump live in
 * the handler, keyed off `promoteCandidateUrl` being a string exactly as this
 * route's old guard did.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ projectId: string; pageId: string; panelId: string }> }) {
  const s = await getRequiredSession();
  const { projectId, panelId } = await params;
  if (!(await pgComicPanelCrudRepository.ownsProject(projectId, s.user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const allowed = ["dialogue", "caption", "speakerName", "bubbleType", "reviewStatus", "panelIndex", "candidateImageUrls"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  const result = await updateComicPanel(
    fromSession(s),
    { projectId, panelId, patch: update, promoteCandidateUrl: body?.promoteCandidateUrl },
    pgComicPanelCrudRepository,
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
  );
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: result.status });
  return NextResponse.json(result.panel);
}
