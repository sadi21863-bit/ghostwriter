export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { fromSession } from "@/lib/core/auth-decorators";
import { pgPlotThreadRepository } from "@/lib/core/pg-thread-reference-repos";
import { pgPostCommitHooks } from "@/lib/core/pg-repositories";
import { createPlotThread } from "@/lib/core/handlers/plot-threads";

/**
 * Phase 2 / v4 §7 — thin AUTH ADAPTER around the shared `createPlotThread`
 * handler, mirroring `chapters/[chapterId]/route.ts`: produce a
 * `RequestContext`, call the handler, shape the response. The ownership probe
 * and the insert itself moved to `pg-thread-reference-repos.ts`; the `name`
 * field check stays here so a malformed body still 400s the same way.
 */
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }){
  const session = await getRequiredSession();
  const { projectId } = await params;
  const { name, description, status, stakes, connections, alwaysInContext, sortOrder } = await req.json();
  if (!name || typeof name !== "string") return NextResponse.json({ error: "name is required" }, { status: 400 });
  const result = await createPlotThread(
    fromSession(session),
    { projectId, data: { name, description, status, stakes, connections, alwaysInContext, sortOrder } },
    pgPlotThreadRepository,
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json(result.thread, { status: 201 });
}
