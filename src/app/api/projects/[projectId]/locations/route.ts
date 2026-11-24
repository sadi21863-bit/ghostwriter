export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { fromSession } from "@/lib/core/auth-decorators";
import {
  createLocation,
  type LocationCreateData,
} from "@/lib/core/handlers/locations";
import { pgPostCommitHooks } from "@/lib/core/pg-repositories";
import { pgLocationCrudRepository } from "@/lib/core/pg-character-location-repos";

/**
 * Phase 2 / v4 §7 — thin auth adapter for `createLocation`.
 *
 * The route produces a `RequestContext`, calls the handler, and shapes a
 * response. It owns only the transport validations whose 400s must keep
 * happening HERE (in the original order): the ownership probe runs BEFORE the
 * body is read, so a wrong-project caller with a missing `name` still got
 * the 404 from today's route — the `404-before-400` order is preserved, and the
 * handler re-proves ownership itself so a same-shaped request coming from a
 * non-Next host cannot outflank it.
 *
 * The create's embedding + duplicate-detection wiring lives in the handler
 * (`embedText` DI seam); the adapter supplies the I/O, exactly like the
 * chapter PATCH adapter supplies `onChapterContentChanged`.
 */
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }){
  const session = await getRequiredSession();
  const { projectId } = await params;
  if (!(await pgLocationCrudRepository.ownsProject(projectId, session.user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { name, description, atmosphere, history, sensoryDetails, alwaysInContext, sortOrder } = await req.json();
  if (!name || typeof name !== "string") return NextResponse.json({ error: "name is required" }, { status: 400 });

  const data: LocationCreateData = { name, description, atmosphere, history, sensoryDetails, alwaysInContext, sortOrder };

  const result = await createLocation(
    fromSession(session),
    { projectId, data },
    pgLocationCrudRepository,
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
    (text) => generateEmbedding(text),
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json({ ...result.location, similarEntities: result.similarEntities }, { status: 201 });
}
