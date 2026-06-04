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
  { params }: { params: { projectId: string; characterId: string } }
) {
  const session = await getRequiredSession();
  const tier = await getUserTier(session.user.id);
  if (!canAccessFeature(tier, "comic_studio")) {
    return NextResponse.json({ error: "upgrade_required", feature: "comic_studio" }, { status: 403 });
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const char = await db.query.characters.findFirst({
    where: eq(characters.id, params.characterId),
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

  return NextResponse.json({ jobId, characterId: params.characterId, status: "training" });
}

export async function GET(
  req: Request,
  { params }: { params: { projectId: string; characterId: string } }
) {
  const session = await getRequiredSession();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
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
      .set({ soulId: result.soulId })
      .where(eq(characters.id, params.characterId));

    return NextResponse.json({
      status: "completed",
      soulId: result.soulId,
      message: `Soul ID trained for this character. All future comic panels will be visually consistent.`,
    });
  }

  return NextResponse.json({ status: result.status });
}
