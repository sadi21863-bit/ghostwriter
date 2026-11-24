export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { fromSession } from "@/lib/core/auth-decorators";
import { pgReferenceWorkRepository } from "@/lib/core/pg-thread-reference-repos";
import { pgPostCommitHooks } from "@/lib/core/pg-repositories";
import { createReferenceWork } from "@/lib/core/handlers/reference-works";

/**
 * Phase 2 / v4 §7 — thin AUTH ADAPTER around the shared `createReferenceWork`
 * handler, mirroring `chapters/[chapterId]/route.ts`. The `title` field check
 * stays here so a malformed body still 400s the same way; the ownership probe
 * and the insert (including its conditional-`attributes` spread, reproduced by
 * the pg adapter) moved to `pg-thread-reference-repos.ts`.
 */
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getRequiredSession();
  const { projectId } = await params;
  const { title, attributes } = await req.json();
  if (!title || typeof title !== "string") return NextResponse.json({ error: "title is required" }, { status: 400 });
  const result = await createReferenceWork(
    fromSession(session),
    { projectId, data: { title, attributes } },
    pgReferenceWorkRepository,
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json(result.reference, { status: 201 });
}
