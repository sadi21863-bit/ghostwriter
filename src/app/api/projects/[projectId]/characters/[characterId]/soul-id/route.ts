export const dynamic = 'force-dynamic';

// src/app/api/projects/[projectId]/characters/[characterId]/soul-id/route.ts
// Trains a Higgsfield Soul ID from reference photos for consistent panel generation.
// POST: starts training, returns jobId for polling
// GET: polls training status

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { getUserTier, canAccessFeature } from "@/lib/subscription";
import { db } from "@/db";
import { characters, projects, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { trainSoulId, pollSoulIdTraining } from "@/lib/higgsfield/client";
import { decrypt } from "@/lib/crypto";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string; characterId: string }> }
) {
  const session = await getRequiredSession();
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "comic_studio")) {
    return NextResponse.json({ error: "upgrade_required", feature: "comic_studio" }, { status: 403 });
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, (await params).projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const char = await db.query.characters.findFirst({
    where: and(eq(characters.id, (await params).characterId), eq(characters.projectId, (await params).projectId)),
  });
  if (!char) return NextResponse.json({ error: "Character not found" }, { status: 404 });

  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  const higgsfieldKey    = decrypt(user?.higgsfieldApiKey ?? "");
  const higgsfieldSecret = decrypt(user?.higgsfieldApiSecret ?? "");

  if (!higgsfieldKey || !higgsfieldSecret) {
    return NextResponse.json({
      error: "Soul ID training requires your Higgsfield API key AND API secret. Add both in Settings.",
    }, { status: 400 });
  }

  const { referenceImageUrls } = await req.json();
  if (!Array.isArray(referenceImageUrls) || referenceImageUrls.length < 3) {
    return NextResponse.json({
      error: "Upload at least 3 reference photos to train a Soul ID.",
    }, { status: 400 });
  }

  const { jobId } = await trainSoulId({
    apiKey: higgsfieldKey,
    apiSecret: higgsfieldSecret,
    characterName: char.name,
    referenceImageUrls,
  });

  return NextResponse.json({ jobId, characterId: (await params).characterId, status: "training" });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string; characterId: string }> }
) {
  const session = await getRequiredSession();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, (await params).projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const { characterId, projectId } = await params;
  // jobId is optional now: a caller that already has it (the manual
  // WorldBiblePanel trigger) can pass it explicitly; generate-package's
  // auto-bootstrap (item 68's Task 2) has no way to hand the jobId to a
  // caller directly since it never blocks the original request, so it
  // stores the pending job on the character row instead - polling by
  // characterId alone picks that up.
  let jobId = searchParams.get("jobId");
  const char = await db.query.characters.findFirst({
    where: and(eq(characters.id, characterId), eq(characters.projectId, projectId)),
  });
  if (!jobId) jobId = char?.soulIdTrainingJobId || null;
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  const higgsfieldKey    = decrypt(user?.higgsfieldApiKey ?? "");
  const higgsfieldSecret = decrypt(user?.higgsfieldApiSecret ?? "");

  const result = await pollSoulIdTraining({
    apiKey: higgsfieldKey,
    apiSecret: higgsfieldSecret,
    jobId,
  });

  if (result.status === "completed" && result.soulId) {
    await db.update(characters)
      .set({ soulId: result.soulId, soulIdTrainingJobId: "" })
      .where(and(eq(characters.id, characterId), eq(characters.projectId, projectId)));

    return NextResponse.json({
      status: "completed",
      soulId: result.soulId,
      message: `Soul ID trained for this character. All future comic panels will be visually consistent.`,
    });
  }

  if (result.status === "failed") {
    await db.update(characters)
      .set({ soulIdTrainingJobId: "" })
      .where(and(eq(characters.id, characterId), eq(characters.projectId, projectId)));
  }

  return NextResponse.json({ status: result.status });
}
