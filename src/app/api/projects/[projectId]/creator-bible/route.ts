import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { creatorBibles, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const DEFAULTS = {
  channelName: "", niche: "", audienceAge: "",
  audienceInterests: "", audiencePainPoints: "",
  channelVoice: "", contentPillars: [] as string[],
  competitorNotes: "", defaultCta: "",
};

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function GET(_: Request, { params }: { params: { projectId: string } }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership(params.projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bible = await db.query.creatorBibles.findFirst({
    where: eq(creatorBibles.projectId, params.projectId),
  });

  return NextResponse.json(bible ?? { ...DEFAULTS, projectId: params.projectId });
}

export async function PATCH(req: Request, { params }: { params: { projectId: string } }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership(params.projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const now = new Date();

  const [result] = await db
    .insert(creatorBibles)
    .values({ ...DEFAULTS, ...body, projectId: params.projectId, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: creatorBibles.projectId,
      set: { ...body, updatedAt: now },
    })
    .returning();

  return NextResponse.json(result);
}
