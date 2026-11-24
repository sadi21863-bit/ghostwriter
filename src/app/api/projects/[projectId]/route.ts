export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { encodeAIRules } from "@/lib/types/story";
import { fromSession } from "@/lib/core/auth-decorators";
import { pgProjectCrudRepository } from "@/lib/core/pg-project-crud";
import { pgPostCommitHooks } from "@/lib/core/pg-repositories";
import { deleteProject, readProject, updateProject } from "@/lib/core/handlers/projects";
type Ctx = { params: Promise<{ projectId: string }> };

/**
 * Phase 2 / v4 §7 — thin AUTH ADAPTERS around the shared `readProject` /
 * `updateProject` / `deleteProject` business handlers, mirroring
 * `chapters/[chapterId]/route.ts`. The full-graph read, the 19-field PATCH
 * allowlist (with `normalizeDensity`), the ownership probes, and the
 * §11 revision hooks all moved into the handler + `pg-project-crud.ts`.
 *
 * The one request-shape guard that stayed at the edge is the `aiRules` encode:
 * its throw IS the `400 "Invalid aiRules shape."` response, exactly where the
 * pre-migration PATCH emitted it. The handler receives the already-encoded
 * value.
 */
export async function GET(_: Request, { params }: Ctx) {
  const s = await getRequiredSession();
  const result = await readProject(fromSession(s), { projectId: (await params).projectId }, pgProjectCrudRepository);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: result.status });
  return NextResponse.json(result.project);
}
export async function PATCH(req: Request, { params }: Ctx) {
  const s = await getRequiredSession();
  const b = await req.json();
  const { aiRules } = b;
  let encodedAiRules: ReturnType<typeof encodeAIRules> | undefined;
  if (aiRules !== undefined) {
    try {
      encodedAiRules = encodeAIRules(aiRules);
    } catch {
      return NextResponse.json({ error: "Invalid aiRules shape." }, { status: 400 });
    }
  }
  const ctx = fromSession(s);
  const projectId = (await params).projectId;
  const result = await updateProject(
    ctx,
    {
      projectId,
      // aiRules arrives pre-encoded by the edge guard above; every other field
      // is passed through raw for the handler's allowlist to judge, exactly as
      // the pre-migration `...(x !== undefined && { x })` spreads did.
      patch: { ...b, ...(aiRules !== undefined ? { aiRules: encodedAiRules } : {}) },
    },
    pgProjectCrudRepository,
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json(result.project);
}
export async function DELETE(_: Request, { params }: Ctx) {
  const s = await getRequiredSession();
  const result = await deleteProject(
    fromSession(s),
    { projectId: (await params).projectId },
    pgProjectCrudRepository,
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
