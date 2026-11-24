export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { fromSession } from "@/lib/core/auth-decorators";
import { deleteComicPage } from "@/lib/core/handlers/comics";
import { pgComicPageCrudRepository } from "@/lib/core/pg-comic-repos";
import { pgPostCommitHooks } from "@/lib/core/pg-repositories";

/**
 * Phase 2 / v4 §7 — thin auth adapter for `deleteComicPage`. The scope check,
 * the ownership probe, the scoped delete, and the §11 revision bump live in
 * the handler; the `{ ok: true }` body (even when the row was already gone)
 * is the route's preserved contract.
 */
export async function DELETE(_: Request, { params }: { params: Promise<{ projectId: string; pageId: string }> }) {
  const s = await getRequiredSession();
  const { projectId, pageId } = await params;
  const result = await deleteComicPage(
    fromSession(s),
    { projectId, pageId },
    pgComicPageCrudRepository,
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
  );
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: result.status });
  return NextResponse.json({ ok: true });
}
