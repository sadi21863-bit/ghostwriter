import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, productionShots, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateTextVideo } from "@/lib/higgsfield/client";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function POST(req: Request, { params }: { params: { projectId: string; shotId: string } }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership(params.projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
  if (!user?.higgsfieldApiKey)
    return NextResponse.json({ error: "Add your Higgsfield API key in Settings." }, { status: 400 });

  const shot = await db.query.productionShots.findFirst({ where: eq(productionShots.id, params.shotId) });
  if (!shot) return NextResponse.json({ error: "Shot not found" }, { status: 404 });

  const { model } = await req.json();
  const validModels = ["kling", "veo", "sora", "seedance", "wan"] as const;
  if (!validModels.includes(model))
    return NextResponse.json({ error: "Invalid model" }, { status: 400 });

  const { requestId, pollingUrl } = await generateTextVideo({
    apiKey: user.higgsfieldApiKey,
    prompt: shot.videoPrompt || shot.soulPrompt || "Cinematic scene",
    model,
  });

  const [updated] = await db
    .update(productionShots)
    .set({ generationStatus: "generating_final", higgsfieldJobId: `${requestId}|${pollingUrl}`, updatedAt: new Date() })
    .where(eq(productionShots.id, params.shotId))
    .returning();

  return NextResponse.json({ shot: updated, jobId: requestId, status: "generating_final" });
}
