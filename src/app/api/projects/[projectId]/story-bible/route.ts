export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { fromSession } from "@/lib/core/auth-decorators";
import { getStoryBible } from "@/lib/core/handlers/get-story-bible";
import { pgStoryBibleRepository } from "@/lib/core/pg-repositories";

/**
 * Phase 2 / v4 §7 — thin auth adapter for the `getStoryBible` handler.
 *
 * New endpoint. Nothing calls it yet: the World Bible UI currently receives its
 * data inline with the project read, so this is additive and changes no existing
 * behaviour. It exists so the aggregated, single-authorization World Bible read
 * is available server-side — and so a local Story OS host can serve the identical
 * shape without a second UI.
 *
 * The `contentRevision` field in the response is §11's per-project mutation
 * counter (`projects.content_revision`): null until the first canonical
 * mutation after Phase 5A shipped, then monotonic — "unknown" stays
 * distinguishable from "zero", and the phase-local-host test pins that
 * distinction instead of inventing a fabricated 0.
 */
export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;

  const result = await getStoryBible(fromSession(s), { projectId }, pgStoryBibleRepository);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json(result.bible);
}
