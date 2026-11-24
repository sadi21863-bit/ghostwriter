export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { fromSession } from "@/lib/core/auth-decorators";
import { pgPlotThreadRepository } from "@/lib/core/pg-thread-reference-repos";
import { pgPostCommitHooks } from "@/lib/core/pg-repositories";
import { deletePlotThread, updatePlotThread } from "@/lib/core/handlers/plot-threads";
import { z } from "zod";

/**
 * Phase 2 / v4 §7 — thin AUTH ADAPTER around the shared `updatePlotThread` /
 * `deletePlotThread` handlers, mirroring `chapters/[chapterId]/route.ts`. The
 * PATCH allowlist (the zod schema below) stays here so a malformed status
 * still 400s at the edge; the ownership probe, the scoped write, and the
 * `updatedAt` stamp moved into the handler + `pg-thread-reference-repos.ts`.
 */
const PlotThreadPatch = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  // "Simmering" is the value both StoryBible.tsx and WorldBiblePanel.tsx's
  // status dropdowns actually offer — neither UI ever sends "Dormant", but
  // it's kept here in case any existing row already has that value stored.
  // Previously this enum omitted "Simmering" entirely, so selecting it and
  // saving ANY field (including a simultaneous name edit) silently 400'd.
  status: z.enum(["Active", "Simmering", "Resolved", "Dormant"]).optional(),
  stakes: z.string().optional(),
  connections: z.string().optional(),
  alwaysInContext: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

type Ctx = { params: Promise<{ projectId: string; threadId: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const s = await getRequiredSession();
  const { projectId, threadId } = await params;
  const parsed = PlotThreadPatch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
  const result = await updatePlotThread(
    fromSession(s),
    { projectId, threadId, patch: parsed.data },
    pgPlotThreadRepository,
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json(result.thread);
}

export async function DELETE(_: Request, { params }: Ctx) {
  const s = await getRequiredSession();
  const { projectId, threadId } = await params;
  const result = await deletePlotThread(
    fromSession(s),
    { projectId, threadId },
    pgPlotThreadRepository,
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
