import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { NextResponse } from "next/server";

export async function getRequiredSession(){ const s=await getServerSession(authOptions); if(!s?.user?.id) throw NextResponse.json({ error: "Unauthorized" }, { status: 401 }); return s; }
export async function getOptionalSession(){ return getServerSession(authOptions); }

/*
 * `verifyChildOwnership(table, childId, projectId)` used to live here.
 *
 * Removed in Phase 2 (v4 §7): "Ownership helpers consume RequestContext and
 * repository interfaces." The old signature took a Drizzle `PgTable`, binding
 * authorization to the ORM and taking the projectId from the caller with nothing
 * to cross-check it against.
 *
 * Use `ownsChildResource(ctx, { resource, childId, projectId }, repo)` from
 * `@/lib/core/ownership`, with `pgChildResourceRepository` (or a local adapter in
 * Phase 3). That enforces context scope, which the old helper could not.
 */