export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { fromSession } from "@/lib/core/auth-decorators";
import { pgIntentionalViolationRepository } from "@/lib/core/pg-world-entity-repos";
import { pgPostCommitHooks } from "@/lib/core/pg-repositories";
import {
  readIntentionalViolations,
  recordIntentionalViolation,
} from "@/lib/core/handlers/intentional-violations";

/**
 * Phase 2 / v4 §7 — thin AUTH ADAPTER around the intentional-violation
 * handlers (`src/lib/core/handlers/intentional-violations.ts`): produce a
 * `RequestContext`, call the handler, shape the response. The ownership probe,
 * the `violationType required` 400, and the projects-row jsonb merge all moved
 * to the handler/`pg-world-entity-repos.ts`; the response bodies are unchanged
 * from the pre-migration route (`{success: true}` for POST,
 * `{violations: {...}}` for GET, 404 `{error: "Not found"}`).
 */
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  const body = await req.json();
  const result = await recordIntentionalViolation(
    fromSession(s),
    { projectId, violationType: body?.violationType, purpose: body?.purpose },
    pgIntentionalViolationRepository,
    {
      // Canon-adjacent: the acknowledgement persists in the project row and
      // feeds the generation-violations confirmation gates.
      onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation,
    },
  );
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: result.status });
  return NextResponse.json({ success: true });
}

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  const result = await readIntentionalViolations(fromSession(s), { projectId }, pgIntentionalViolationRepository);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: result.status });
  return NextResponse.json({ violations: result.violations });
}
