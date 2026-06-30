export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { getUserTier } from "@/lib/subscription";
import { db } from "@/db";
import { users, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";
import type { CapabilityContext } from "@/lib/capabilities/registry";
import { buildRunPlan, runnableCapabilities, type GraphNodeKind } from "@/lib/graph/graph-program";

// Story Graph Phase 2 surface: preflight what a wired capability run would do/cost
// for a node selection. PURE preflight only — it returns a plan (with
// requiresConfirm), it does NOT execute anything. The client confirms, then hits
// the capability's own endpoint. With a capabilityId → one plan; without → every
// runnable capability for the selection.
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, s.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const kinds: GraphNodeKind[] = Array.isArray(body?.kinds) ? body.kinds : [];
  const nodeIds: string[] = Array.isArray(body?.nodeIds) ? body.nodeIds : [];
  const capabilityId: string | undefined = typeof body?.capabilityId === "string" ? body.capabilityId : undefined;

  const tier = await getUserTier(s.user.id);
  const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
  const ctx: CapabilityContext = {
    tier,
    hasSegmindKey: !!decrypt(user?.segmindApiKey ?? ""),
    hasOpenAIKey: !!decrypt(user?.openaiApiKey ?? ""),
    format: project.format,
  };

  if (capabilityId) {
    const plan = buildRunPlan(capabilityId, nodeIds, ctx);
    if (!plan) return NextResponse.json({ error: "Unknown capability" }, { status: 400 });
    return NextResponse.json({ plan });
  }

  return NextResponse.json({ options: runnableCapabilities({ kinds, nodeIds }, ctx) });
}
