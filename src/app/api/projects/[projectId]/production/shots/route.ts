export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { fromSession } from "@/lib/core/auth-decorators";
import { listProductionShots } from "@/lib/core/handlers/production-shots";
import { pgProductionShotCrudRepository } from "@/lib/core/pg-production-shot-repos";

/**
 * Phase 2 / v4 §7 — thin auth adapter for `listProductionShots`.
 *
 * The route produces a `RequestContext` and shapes the response; the scoped
 * ownership probe, the (sceneNumber, shotNumber) ordering, and the
 * primaryCharacter join all live in the handler + repository port.
 *
 * Generation/poll verbs under /production stay transport-coupled by design —
 * see `src/lib/core/handlers/production-shots.ts` for the out-of-scope list.
 */
export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  const result = await listProductionShots(
    fromSession(s),
    { projectId },
    pgProductionShotCrudRepository,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json({ shots: result.shots });
}
