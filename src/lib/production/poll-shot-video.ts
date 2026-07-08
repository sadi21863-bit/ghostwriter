// Shared "check the external video job & update the shot row" logic — extracted
// so both the client-driven status route (GET, polled by the browser on an
// interval) and the QStash-driven server-side poll (src/app/api/queue/segmind-
// video-poll/route.ts) update the shot the same way. Idempotent: whichever side
// reaches "final_ready" first wins, and the other simply reads that state next
// time rather than double-uploading to Blob.
import { db } from "@/db";
import { productionShots } from "@/db/schema";
import { eq } from "drizzle-orm";
import { pollJob } from "@/lib/higgsfield/client";
import { put } from "@vercel/blob";

export type ShotPollOutcome =
  | { outcome: "final_ready"; videoUrl: string }
  | { outcome: "error"; error?: string }
  | { outcome: "generating_final" }
  | { outcome: "no_job" };

export async function pollAndUpdateShotVideo(params: {
  shotId: string;
  projectId: string;
  segmindApiKey: string;
}): Promise<ShotPollOutcome> {
  const shot = await db.query.productionShots.findFirst({
    where: eq(productionShots.id, params.shotId),
  });
  if (!shot) return { outcome: "no_job" };
  if (shot.generationStatus === "final_ready" && shot.finalVideoUrl) {
    return { outcome: "final_ready", videoUrl: shot.finalVideoUrl };
  }
  if (!shot.higgsfieldJobId) return { outcome: "no_job" };

  const [, pollingUrl] = shot.higgsfieldJobId.split("|");
  const { status, mediaUrl, error } = await pollJob({ apiKey: params.segmindApiKey, pollingUrl });

  if (status === "COMPLETED" && mediaUrl) {
    let finalVideoUrl = mediaUrl;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const vidRes = await fetch(mediaUrl);
      const vidBuf = await vidRes.arrayBuffer();
      const blob = await put(
        `production/${params.projectId}/${params.shotId}/final-${Date.now()}.mp4`,
        vidBuf,
        { access: "public", contentType: "video/mp4" }
      );
      finalVideoUrl = blob.url;
    }
    await db.update(productionShots)
      .set({ finalVideoUrl, generationStatus: "final_ready", updatedAt: new Date() })
      .where(eq(productionShots.id, params.shotId));
    return { outcome: "final_ready", videoUrl: finalVideoUrl };
  }

  if (status === "FAILED" || status === "ERROR") {
    await db.update(productionShots)
      .set({ generationStatus: "error", generationError: error ?? "", updatedAt: new Date() })
      .where(eq(productionShots.id, params.shotId));
    return { outcome: "error", error };
  }

  return { outcome: "generating_final" };
}
