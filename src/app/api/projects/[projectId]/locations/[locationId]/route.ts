export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { z } from "zod";
import { fromSession } from "@/lib/core/auth-decorators";
import {
  deleteLocation,
  updateLocation,
} from "@/lib/core/handlers/locations";
import { pgPostCommitHooks } from "@/lib/core/pg-repositories";
import { pgLocationCrudRepository } from "@/lib/core/pg-character-location-repos";

const LocationPatch = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  atmosphere: z.string().optional(),
  history: z.string().optional(),
  sensoryDetails: z.string().optional(),
  linkedCharacterIds: z.array(z.string().uuid()).optional(),
  alwaysInContext: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

/**
 * Phase 2 / v4 §7 — thin auth adapter for `updateLocation` / `deleteLocation`.
 *
 * Transport validation stays HERE, in the original order: the ownership probe
 * runs BEFORE the body is read, so a wrong-project caller with an invalid patch
 * still 404s instead of leaking "Invalid fields" (the `404-before-400` order of
 * today's route). Everything else — the scoped write, the server-owned
 * `updatedAt`, and the §11 revision bump after a non-empty patch or a delete —
 * lives in the handler.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ projectId: string; locationId: string }> }) {
  const s = await getRequiredSession();
  const { projectId, locationId } = await params;
  if (!(await pgLocationCrudRepository.ownsProject(projectId, s.user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const parsed = LocationPatch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
  const result = await updateLocation(
    fromSession(s),
    { projectId, locationId, patch: parsed.data },
    pgLocationCrudRepository,
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json(result.location);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ projectId: string; locationId: string }> }) {
  const s = await getRequiredSession();
  const { projectId, locationId } = await params;
  const result = await deleteLocation(
    fromSession(s),
    { projectId, locationId },
    pgLocationCrudRepository,
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
