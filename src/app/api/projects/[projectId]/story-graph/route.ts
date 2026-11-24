export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { fromSession } from "@/lib/core/auth-decorators";
import { readStoryGraph } from "@/lib/core/handlers/story-graph";
import { pgStoryGraphRepository } from "@/lib/core/pg-story-os-repos";

/**
 * Phase 2 / v4 §7 — thin auth adapter around the shared `readStoryGraph`
 * handler. The ownership probe and the multi-relation read moved to
 * `pg-story-os-repos.ts`; the graph build, health analysis, and Headroom trim
 * signal stay composed inside the handler — the "read → build → health" port
 * shape is unchanged from the pre-migration route.
 */
export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  const result = await readStoryGraph(fromSession(s), { projectId }, pgStoryGraphRepository);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json({ ...result.graph, health: result.health, contextTrimmed: result.contextTrimmed });
}
