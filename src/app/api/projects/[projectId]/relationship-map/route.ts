export const dynamic = "force-dynamic";

/**
 * Phase 2 / v4 §7 — thin auth adapter for the relationship-map handlers
 * (`handlers/relationship-map.ts`), formerly the 149-line compound route that
 * mixed session auth, the co-occurrence graph build, and the pair upsert.
 *
 * GET → `readRelationshipMap`; PATCH → `upsertRelationshipMap`. The route owns
 * only session auth, the URL param, and the request-body validation the legacy
 * route performed (`characterAId`/`characterBId` required → 400); graph and row
 * bodies pass through verbatim so the UI-facing payload shapes never drift.
 *
 * Wire-up: POST-commit hook imported READ-ONLY from `pg-repositories` — the
 * canonical-mutation revision bump ("relationship.upsert" kind, §11) fires
 * after a real upsert succeeded, never on a 403/404 refusal.
 */

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { fromSession } from "@/lib/core/auth-decorators";
import {
  readRelationshipMap,
  upsertRelationshipMap,
  type UpsertRelationshipMapInput,
} from "@/lib/core/handlers/relationship-map";
import { pgPostCommitHooks } from "@/lib/core/pg-repositories";
import { pgRelationshipMapRepository } from "@/lib/core/pg-relationship-repos";

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  const result = await readRelationshipMap(fromSession(s), { projectId }, pgRelationshipMapRepository);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json(result.graph);
}

// Same explicit field pick the legacy route destructured: every known PATCH
// field, nothing else, so keys the client sends beyond the payload contract
// never flow into the handler (the adapter further ignores them by column).
export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;

  const body = (await request.json()) as UpsertRelationshipMapInput;
  if (!body.characterAId || !body.characterBId)
    return NextResponse.json({ error: "characterAId and characterBId required" }, { status: 400 });

  const input: UpsertRelationshipMapInput = {
    projectId,
    characterAId: body.characterAId,
    characterBId: body.characterBId,
    trustLevel: body.trustLevel,
    relationshipType: body.relationshipType,
    notes: body.notes,
    fourHorsemen: body.fourHorsemen,
    powerDifferential: body.powerDifferential,
    emotionalRegister: body.emotionalRegister,
    knowledgeAsymmetry: body.knowledgeAsymmetry,
    dependencyStructure: body.dependencyStructure,
    attachmentStyleA: body.attachmentStyleA,
    arcTrajectory: body.arcTrajectory,
  };

  const result = await upsertRelationshipMap(
    fromSession(s),
    input,
    pgRelationshipMapRepository,
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json(result.row);
}
