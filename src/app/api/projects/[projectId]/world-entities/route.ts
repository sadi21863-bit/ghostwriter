export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { WorldEntityKindSchema, encodeWorldEntityProperties, type WorldEntityProperties } from "@/lib/types/story";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { fromSession } from "@/lib/core/auth-decorators";
import { pgWorldEntityRepository } from "@/lib/core/pg-world-entity-repos";
import { pgPostCommitHooks } from "@/lib/core/pg-repositories";
import { createWorldEntity, listWorldEntities } from "@/lib/core/handlers/world-entities";

/**
 * Phase 2 / v4 §7 — thin AUTH ADAPTER around the shared world-entity handlers
 * (`src/lib/core/handlers/world-entities.ts`): produce a `RequestContext`,
 * call the handler, shape the response. Ownership/scoping, the insert-defaults
 * stamping (`worldEntityInsertFields`), the kind-scoped duplicate scan, the
 * embedding seam, and the §11 canonical-mutation hook all live in the handler.
 *
 * What STAYED at the transport edge, deliberately (the handler only sees
 * already-validated input): the `name is required` 400, the
 * `WorldEntityKindSchema` normalization, and `encodeWorldEntityProperties`
 * → the `invalid properties` 400. Response bodies are unchanged from the
 * pre-migration route (`NextResponse.json(rows)` for GET,
 * `{ ...row, similarEntities }` with 201 for POST).
 */
export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  const result = await listWorldEntities(fromSession(s), { projectId }, pgWorldEntityRepository);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: result.status });
  return NextResponse.json(result.entities);
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  const body = await req.json();
  if (!body?.name || typeof body.name !== "string") return NextResponse.json({ error: "name is required" }, { status: 400 });
  const kind = WorldEntityKindSchema.parse(body.kind ?? "object");
  let properties: WorldEntityProperties;
  try { properties = encodeWorldEntityProperties(body.properties ?? {}); }
  catch { return NextResponse.json({ error: "invalid properties" }, { status: 400 }); }

  const result = await createWorldEntity(
    fromSession(s),
    {
      projectId,
      entity: {
        kind,
        name: body.name,
        summary: body.summary,
        description: body.description,
        properties,
        linkedCharacterIds: body.linkedCharacterIds,
        linkedLocationIds: body.linkedLocationIds,
        linkedPlotThreadIds: body.linkedPlotThreadIds,
        linkedEntityIds: body.linkedEntityIds,
        alwaysInContext: body.alwaysInContext,
        sortOrder: body.sortOrder,
      },
    },
    pgWorldEntityRepository,
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
    // DI seam: the real embedding service the pre-migration route called.
    // A rejection is treated as no-embedding inside the handler.
    (text) => generateEmbedding(text),
  );

  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: result.status });
  return NextResponse.json({ ...result.entity, similarEntities: result.similarEntities }, { status: 201 });
}
