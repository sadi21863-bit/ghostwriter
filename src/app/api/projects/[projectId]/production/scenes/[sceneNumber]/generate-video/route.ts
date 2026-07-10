export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, productionShots, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateTextVideo, pollJob } from "@/lib/higgsfield/client";
import { decrypt } from "@/lib/crypto";

const MULTI_SHOT_MAX_SCENE_SIZE = 5;
const MULTI_SHOT_POLL_TIMEOUT_MS = 240_000;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/** Builds a Seedance-style "Shot 1: ... Shot 2: ..." multi-shot script from a
 *  scene's real shots, in their real sortOrder. */
function buildMultiShotScript(sceneShots: any[]): string {
  return sceneShots
    .map((shot, i) => `Shot ${i + 1}: ${shot.videoPrompt || shot.soulPrompt || shot.action || ""}`)
    .join(" ");
}

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

// Each shot in the scene gets its OWN full-length Seedance 2.0 call (with
// reference_images for character consistency) instead of being crammed into
// one shared multi-shot prompt — confirmed live (see
// docs/superpowers/plans/2026-06-25-anti-slop-multishot-remediation.md) that
// 6 shots in one <=15s clip reads as too compressed for a deliberately-paced
// trailer. The status route (Task 5 of the per-shot-stitching plan) stitches
// the resulting independent clips together once all are ready.
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string; sceneNumber: string }> }) {
  const s = await getRequiredSession();
  const { projectId, sceneNumber: sceneNumberRaw } = await params;
  const useMultiShot = new URL(req.url).searchParams.get("multiShot") === "1";
  if (!await verifyOwnership(projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sceneNumber = Number(sceneNumberRaw);

  // Ordered by sortOrder (falling back to shotNumber as a tiebreaker) to match
  // ProductionStudio.tsx's filmstrip/list — Phase C's drag-reorder updates
  // sortOrder, and the final stitch must respect it, not the original
  // generation order.
  const sceneShots = await db.query.productionShots.findMany({
    where: and(eq(productionShots.projectId, projectId), eq(productionShots.sceneNumber, sceneNumber)),
    with: { primaryCharacter: true },
    orderBy: (sh, { asc }) => [asc(sh.sortOrder), asc(sh.shotNumber)],
  });
  if (sceneShots.length === 0) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

  // Found during the final whole-branch review: without this, a duplicate
  // click on an already-stitched scene would resubmit N fresh (real-money)
  // Seedance jobs — the status route already short-circuits on repeat polls,
  // but nothing stopped a second POST from spending again.
  const alreadyStitched = sceneShots.find((sh: any) => sh.sceneFinalVideoUrl);
  if (alreadyStitched) return NextResponse.json({ status: "final_ready", videoUrl: alreadyStitched.sceneFinalVideoUrl });

  const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
  const segmindKey = decrypt(user?.segmindApiKey ?? "");
  if (!segmindKey)
    return NextResponse.json({ error: "Add your Segmind API key in Settings." }, { status: 400 });

  // Only character.portraitUrl (AI-generated via generateSoulImage, this feature's
  // own portrait pipeline) is ever used as a reference — never a user-supplied photo.
  //
  // Scene-wide fallback only — used for shots that name no character of their own
  // (e.g. an establishing shot). A shot WITH a primaryCharacter gets ONLY that
  // character's portrait (see below); without this scoping, every character in the
  // scene bled into every shot, including ones that never mention them (the shot-6
  // misfire documented in commit 373299f).
  const sceneWideReferenceImages = Array.from(new Set(
    sceneShots.map(sh => (sh as any).primaryCharacter?.portraitUrl).filter((u: any): u is string => !!u)
  )).slice(0, 9);

  // Opt-in multi-shot single call (item 68's Task 3): Seedance's own
  // multiShotPrompt renders every shot as one continuous scene, giving real
  // lighting/tone consistency a per-shot-independent-calls pipeline can't
  // fully replicate through prompting alone (confirmed via live research
  // into Seedance's own multi-shot consistency docs) - at the cost of the
  // per-shot duration control the earlier per-shot redesign (see the comment
  // below) was built to fix. Scoped to short scenes only (<=5 shots, Seedance's
  // own real per-call shot ceiling) and opt-in only - the per-shot path below
  // remains the unconditional default and the automatic fallback on any
  // failure here, so this can never make an existing generation worse.
  if (useMultiShot && sceneShots.length <= MULTI_SHOT_MAX_SCENE_SIZE) {
    try {
      const multiShotPrompt = buildMultiShotScript(sceneShots);
      const { requestId, pollingUrl, mediaUrl: immediateUrl } = await generateTextVideo({
        apiKey: segmindKey,
        model: "seedance",
        multiShotPrompt,
        referenceImages: sceneWideReferenceImages,
      });

      let mediaUrl = immediateUrl;
      if (!mediaUrl && pollingUrl) {
        const start = Date.now();
        while (Date.now() - start < MULTI_SHOT_POLL_TIMEOUT_MS) {
          await sleep(7000);
          const poll = await pollJob({ apiKey: segmindKey, pollingUrl });
          if (poll.status === "COMPLETED") { mediaUrl = poll.mediaUrl; break; }
          if (poll.status === "FAILED" || poll.status === "ERROR") {
            throw new Error(poll.error ?? "multi-shot generation failed");
          }
        }
      }

      if (!mediaUrl) throw new Error("multi-shot generation did not complete in time");

      // One combined clip already covers the whole scene - set it directly as
      // the scene's final video on every shot (matches sceneFinalVideoUrl's
      // existing per-shot-row-redundant convention from item 48), skipping
      // the per-shot ffmpeg concat entirely since there's nothing to stitch.
      for (const shot of sceneShots) {
        await db.update(productionShots)
          .set({ finalVideoUrl: mediaUrl, sceneFinalVideoUrl: mediaUrl, generationStatus: "final_ready", updatedAt: new Date() })
          .where(eq(productionShots.id, shot.id));
      }
      return NextResponse.json({ status: "final_ready", videoUrl: mediaUrl, mode: "multiShot" });
    } catch (e: any) {
      console.error("[generate-video] multi-shot path failed, falling back to per-shot:", e?.message);
      // fall through to the per-shot loop below
    }
  }

  for (const shot of sceneShots) {
    const ownPortrait = (shot as any).primaryCharacter?.portraitUrl;
    const referenceImages = ownPortrait ? [ownPortrait] : sceneWideReferenceImages;

    const { requestId, pollingUrl, mediaUrl } = await generateTextVideo({
      apiKey: segmindKey,
      model: "seedance",
      prompt: shot.videoPrompt || shot.soulPrompt || "",
      referenceImages,
      duration: (shot.duration as 5 | 10 | 15 | null) ?? 5,
    });

    if (mediaUrl) {
      await db.update(productionShots)
        .set({ finalVideoUrl: mediaUrl, generationStatus: "final_ready", updatedAt: new Date() })
        .where(eq(productionShots.id, shot.id));
    } else {
      await db.update(productionShots)
        .set({ generationStatus: "generating_final", higgsfieldJobId: `${requestId}|${pollingUrl}`, updatedAt: new Date() })
        .where(eq(productionShots.id, shot.id));
    }
  }

  return NextResponse.json({ status: "generating_final", shotCount: sceneShots.length });
}
