export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { WorldEntityKindSchema, encodeWorldEntityProperties } from "@/lib/types/story";
import { fromSession } from "@/lib/core/auth-decorators";
import { pgWorldEntityRepository } from "@/lib/core/pg-world-entity-repos";
import { pgPostCommitHooks } from "@/lib/core/pg-repositories";
import { deleteWorldEntity, updateWorldEntity } from "@/lib/core/handlers/world-entities";

/**
 * Phase 2 / v4 §7 — thin AUTH ADAPTER around the shared world-entity handlers.
 * The PATCH's manual field allowlist and the kind/properties parsing stay at
 * the transport edge (the `invalid properties` 400 is a transport error); the
 * scoping, the server-owned `updatedAt` stamp, the scoped write, and the §11
 * canonical-mutation hook live in the handler. Response bodies are unchanged
 * from the pre-migration route on the paths it could previously serialize —
 * and a PATCH whose entityId belongs to another project now 404s cleanly
 * instead of crashing in `NextResponse.json(undefined)` (same fix the
 * chapters PATCH got, see `.../chapters/[chapterId]/route.ts`).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ projectId: string; entityId: string }> }) {
  const s = await getRequiredSession();
  const { projectId, entityId } = await params;
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  for (const f of ["name", "summary", "description", "linkedCharacterIds", "linkedLocationIds", "linkedPlotThreadIds", "linkedEntityIds", "alwaysInContext", "sortOrder"]) {
    if (f in body) patch[f] = body[f];
  }
  if ("kind" in body) patch.kind = WorldEntityKindSchema.parse(body.kind);
  if ("properties" in body) {
    try { patch.properties = encodeWorldEntityProperties(body.properties); }
    catch { return NextResponse.json({ error: "invalid properties" }, { status: 400 }); }
  }

  const result = await updateWorldEntity(
    fromSession(s),
    { projectId, entityId, patch },
    pgWorldEntityRepository,
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
  );
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: result.status });
  return NextResponse.json(result.entity);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ projectId: string; entityId: string }> }) {
  const s = await getRequiredSession();
  const { projectId, entityId } = await params;
  const result = await deleteWorldEntity(
    fromSession(s),
    { projectId, entityId },
    pgWorldEntityRepository,
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
  );
  if (!result.ok) return NextResponse.json({ error: "Not found" }, { status: result.status ?? 404 });
  return NextResponse.json({ ok: true });
}
