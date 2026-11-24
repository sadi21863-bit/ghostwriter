export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { tiptapToPlainText, isValidTipTapJson } from "@/lib/editor/content-migration";
import { updateChapterEmbedding } from "@/lib/ai/author-voice";
import { fromSession } from "@/lib/core/auth-decorators";
import { pgChapterRepository, pgPostCommitHooks } from "@/lib/core/pg-repositories";
import { deleteChapter, updateChapter } from "@/lib/core/handlers/update-chapter";

/**
 * Phase 2 / v4 §7 — this route is now a thin AUTH ADAPTER around the shared
 * `updateChapter` business handler. It produces a `RequestContext`, calls the
 * handler, and shapes a response. It contains no authorization rules, no
 * allowlist, and no write logic of its own, so a local host can serve the same
 * handler without forking this file.
 *
 * The mass-assignment allowlist, the project-scoped write, and the
 * post-commit-only embedding refresh all moved to
 * `src/lib/core/handlers/update-chapter.ts`, and are covered by the handler's
 * own tests plus the route tests below.
 */
type Ctx = { params: Promise<{ projectId: string; chapterId: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const s = await getRequiredSession();
  const { projectId, chapterId } = await params;

  // The session adapter throws for a missing user, which `getRequiredSession`
  // has already ruled out by this point.
  const ctx = fromSession(s);

  const result = await updateChapter(
    ctx,
    { projectId, chapterId, patch: await req.json() },
    pgChapterRepository,
    {
      // Fire-and-forget: never blocks the save, and never runs for a chapterId
      // that did not match a row.
      onChapterContentChanged: (id, content) => updateChapterEmbedding(id, content),
      // §11: awaited, but only fires for patches the allowlist did not empty.
      onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation,
    },
    (json) => (isValidTipTapJson(json) ? tiptapToPlainText(JSON.parse(json)) : json),
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json(result.chapter);
}

export async function DELETE(_: Request, { params }: Ctx) {
  const s = await getRequiredSession();
  const { projectId, chapterId } = await params;
  const result = await deleteChapter(fromSession(s), { projectId, chapterId }, pgChapterRepository, {
    onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation,
  });
  if (!result.ok) {
    return NextResponse.json({ error: "Not found" }, { status: result.status ?? 404 });
  }
  return NextResponse.json({ ok: true });
}