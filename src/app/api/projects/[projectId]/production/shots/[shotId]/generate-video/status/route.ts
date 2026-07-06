export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, productionShots, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { pollAndUpdateShotVideo } from "@/lib/production/poll-shot-video";
import { decrypt } from "@/lib/crypto";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string; shotId: string }> }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership((await params).projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const shot = await db.query.productionShots.findFirst({
    where: and(eq(productionShots.id, (await params).shotId), eq(productionShots.projectId, (await params).projectId)),
  });
  if (!shot) return NextResponse.json({ error: "Shot not found" }, { status: 404 });

  if (shot.generationStatus === "final_ready")
    return NextResponse.json({ status: "final_ready", videoUrl: shot.finalVideoUrl });

  if (!shot.higgsfieldJobId)
    return NextResponse.json({ status: shot.generationStatus });

  const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
  // Video status polling routes through Segmind (api.segmind.com), not Higgsfield's native API.
  const segmindKey = decrypt(user?.segmindApiKey ?? "");
  if (!segmindKey)
    return NextResponse.json({ error: "Add your Segmind API key in Settings." }, { status: 400 });

  const { projectId, shotId } = await params;
  const result = await pollAndUpdateShotVideo({ shotId, projectId, segmindApiKey: segmindKey });

  if (result.outcome === "final_ready") return NextResponse.json({ status: "final_ready", videoUrl: result.videoUrl });
  if (result.outcome === "error") return NextResponse.json({ status: "error" });
  if (result.outcome === "no_job") return NextResponse.json({ status: shot.generationStatus });
  return NextResponse.json({ status: "generating_final" });
}
