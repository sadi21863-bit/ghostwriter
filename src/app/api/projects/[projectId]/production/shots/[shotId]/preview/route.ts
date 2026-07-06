export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, productionShots, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateSoulImage } from "@/lib/higgsfield/client";
import { put } from "@vercel/blob";
import { decrypt } from "@/lib/crypto";
import { critiqueShot } from "@/lib/production/vision-critic";
import { scoreShot, retryHint } from "@/lib/production/self-eval";
import { getCharacterSoulReference } from "@/lib/production/character-reference";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string; shotId: string }> }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership((await params).projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
  // Preview generation routes through Segmind (api.segmind.com), not Higgsfield's native API.
  const segmindKey = decrypt(user?.segmindApiKey ?? "");
  if (!segmindKey)
    return NextResponse.json({ error: "Add your Segmind API key in Settings to generate previews." }, { status: 400 });

  const shot = await db.query.productionShots.findFirst({
    where: and(eq(productionShots.id, (await params).shotId), eq(productionShots.projectId, (await params).projectId)),
    with: { primaryCharacter: true },
  });
  if (!shot) return NextResponse.json({ error: "Shot not found" }, { status: 404 });

  // Phase C "keep N candidates" mode: when there's already a primary preview,
  // generating "another" adds to candidatePreviewUrls instead of overwriting it.
  // Only meaningful once a primary exists — the very first generation always
  // sets the primary, same as before this option existed.
  const body = await req.json().catch(() => ({}));
  const keepAsCandidate = body?.keepAsCandidate === true && !!shot.previewImageUrl;

  await db.update(productionShots)
    .set({ generationStatus: "generating_preview", updatedAt: new Date() })
    .where(eq(productionShots.id, (await params).shotId));

  try {
    const primaryCharacter = shot.primaryCharacter as any;
    const { referenceImageUrl, soulId } = getCharacterSoulReference(primaryCharacter?.name, primaryCharacter ? [primaryCharacter] : []);
    const soulUrl = await generateSoulImage({
      apiKey: segmindKey,
      prompt: shot.soulPrompt || `${shot.subject}. ${shot.action}. ${shot.location}. Cinematic, photorealistic.`,
      referenceImageUrl,
      soulId,
    });

    let previewImageUrl = soulUrl;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const imgRes = await fetch(soulUrl);
      const imgBuf = await imgRes.arrayBuffer();
      const blob = await put(
        `production/${(await params).projectId}/${(await params).shotId}/preview.jpg`,
        imgBuf,
        { access: "public", contentType: "image/jpeg" }
      );
      previewImageUrl = blob.url;
    }

    if (keepAsCandidate) {
      const existing: string[] = (shot as any).candidatePreviewUrls ?? [];
      const [updated] = await db
        .update(productionShots)
        .set({ candidatePreviewUrls: [...existing, previewImageUrl], generationStatus: "preview_ready", updatedAt: new Date() })
        .where(eq(productionShots.id, (await params).shotId))
        .returning();
      // Candidates aren't auto-scored by the vision-critic — qualityScore/Weakest/Note
      // are singular per-shot fields tracking the PRIMARY, and scoring a candidate
      // would need per-candidate score storage this pass doesn't add. The user
      // compares candidates visually and promotes one; scoring the winner can
      // happen naturally the next time it becomes primary and gets regenerated,
      // or in a later pass if per-candidate scores turn out to matter.
      return NextResponse.json({ shot: updated });
    }

    const [updated] = await db
      .update(productionShots)
      .set({ previewImageUrl, generationStatus: "preview_ready", updatedAt: new Date() })
      .where(eq(productionShots.id, (await params).shotId))
      .returning();

    // Phase B vision-critic (docs/2026-06-25-ai-director-editor-production-studio-gap-analysis.md):
    // score the shot in the background. Never blocks the response and never
    // gates anything — pure data collection for the future review UI.
    (async () => {
      const prevShot = await db.query.productionShots.findFirst({
        where: and(
          eq(productionShots.projectId, (await params).projectId),
          eq(productionShots.sceneNumber, shot.sceneNumber),
          eq(productionShots.shotNumber, shot.shotNumber - 1),
        ),
      });
      const raw = await critiqueShot({
        imageUrl: previewImageUrl,
        prompt: shot.soulPrompt || `${shot.subject}. ${shot.action}. ${shot.location}.`,
        // The critic needs an actual image to compare against, not a soulId
        // string — always the character's portrait, independent of whether
        // generation itself used soulId or referenceImageUrl.
        referenceImageUrl: primaryCharacter?.portraitUrl || undefined,
        previousShotImageUrl: prevShot?.previewImageUrl || undefined,
      });
      if (Object.keys(raw).length === 0) return;
      const result = scoreShot(raw);
      await db.update(productionShots)
        .set({ qualityScore: result.overall, qualityWeakest: result.weakest, qualityNote: retryHint(result) })
        .where(eq(productionShots.id, (await params).shotId));
    })().catch(err => console.error('[critiqueShot] shot preview failed:', err));

    return NextResponse.json({ shot: updated });
  } catch (err: any) {
    await db.update(productionShots)
      .set({ generationStatus: "error", updatedAt: new Date() })
      .where(eq(productionShots.id, (await params).shotId));
    console.error('[preview] Error:', err);
    return NextResponse.json({ error: "Preview generation failed. Please try again." }, { status: 500 });
  }
}
