export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, productionShots } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { buildShotPromptFragment } from "@/lib/ai/shot-parameters";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

const ALLOWED_FIELDS = new Set([
  "shotType", "cameraMovement", "lightingMood", "timeOfDay",
  "subject", "action", "location", "mood", "soulPrompt", "videoPrompt",
  "dialogue", "speaker", "cameraPreset", "viralPreset",
  "characterEmotion", "focalLength", "duration", "aspectRatio", "generatedVideoUrl",
  "reviewStatus", "sortOrder", "candidatePreviewUrls", "trimStartSec", "trimEndSec",
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ projectId: string; shotId: string }> }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership((await params).projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updates: Record<string, any> = {};
  for (const key of Array.from(ALLOWED_FIELDS)) {
    if (key in body) updates[key] = body[key];
  }

  // Fetch current shot to merge for prompt rebuild — include projectId to prevent cross-project IDOR
  const { projectId: pid, shotId } = await params;
  const current = await db.query.productionShots.findFirst({
    where: and(eq(productionShots.id, shotId), eq(productionShots.projectId, pid)),
  });
  if (!current) return NextResponse.json({ error: "Shot not found" }, { status: 404 });

  // Phase C "keep N candidates" — promote a candidate to primary. The old
  // primary (if any) goes back into the candidates array so nothing is lost;
  // the promoted URL is removed from candidates since it's now the primary.
  if (typeof body?.promoteCandidateUrl === "string") {
    const promoted: string = body.promoteCandidateUrl;
    const existingCandidates: string[] = (current as any).candidatePreviewUrls ?? [];
    if (!existingCandidates.includes(promoted)) {
      return NextResponse.json({ error: "Not a known candidate for this shot." }, { status: 400 });
    }
    const nextCandidates = existingCandidates.filter(u => u !== promoted);
    if (current.previewImageUrl) nextCandidates.push(current.previewImageUrl);
    updates.previewImageUrl = promoted;
    updates.candidatePreviewUrls = nextCandidates;
  }

  const merged = { ...current, ...updates };

  // Auto-rebuild prompts when any shot parameter changes
  const paramFields = ["shotType", "cameraMovement", "lightingMood", "timeOfDay", "subject", "action", "location"];
  if (paramFields.some(f => f in updates)) {
    const fragment = buildShotPromptFragment({
      shotType: merged.shotType ?? "Medium shot",
      cameraMovement: merged.cameraMovement ?? "Static",
      lightingMood: merged.lightingMood ?? "Golden hour",
      timeOfDay: merged.timeOfDay ?? "Afternoon",
    });
    if (!("soulPrompt" in updates)) {
      updates.soulPrompt = `${merged.subject}. ${merged.action}. ${merged.location}. ${fragment}. Photorealistic portrait quality.`;
    }
    if (!("videoPrompt" in updates)) {
      updates.videoPrompt = `${merged.action}. ${merged.location}. ${fragment}. Cinematic motion.`;
    }
  }

  const [updated] = await db
    .update(productionShots)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(productionShots.id, shotId), eq(productionShots.projectId, pid)))
    .returning();

  return NextResponse.json({ shot: updated });
}
