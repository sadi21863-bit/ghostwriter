export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { track } from "@/lib/analytics";
import { getUserTier } from "@/lib/subscription";
import { fromSession } from "@/lib/core/auth-decorators";
import { pgProjectCrudRepository } from "@/lib/core/pg-project-crud";
import { pgPostCommitHooks } from "@/lib/core/pg-repositories";
import { createProject, listProjects } from "@/lib/core/handlers/projects";

/**
 * Phase 2 / v4 §7 — thin AUTH ADAPTERS around the shared `listProjects` /
 * `createProject` business handlers, mirroring `chapters/[chapterId]/route.ts`:
 * produce a `RequestContext`, call the handler, shape the response. The tier
 * cap, the create defaults, and the project+Chapter-1 insert all moved into
 * the handler + `pg-project-crud.ts`. This file keeps only auth, the tier
 * resolver injection (the same `getUserTier` it always used), and the
 * `project_created` analytics wiring (now a post-commit hook).
 */
export async function GET() {
  const s = await getRequiredSession();
  const result = await listProjects(fromSession(s), pgProjectCrudRepository);
  return NextResponse.json(result.projects);
}

export async function POST(req: Request) {
  const s = await getRequiredSession();
  const b = await req.json();
  const result = await createProject(
    fromSession(s),
    { data: b },
    pgProjectCrudRepository,
    {
      onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation,
      onCreated: (userId, format) => track(userId, 'project_created', { format }),
    },
    getUserTier,
  );
  if (!result.ok) {
    return NextResponse.json(result.body ?? { error: result.reason }, { status: result.status });
  }
  return NextResponse.json(result.project, { status: 201 });
}
