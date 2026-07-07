// Shared "check the external lipsync job & update the audioExport row" logic —
// mirrors src/lib/production/poll-shot-video.ts exactly, so both the client-
// driven GET route and the QStash-driven server poll update the row the same
// way. Idempotent: whichever side reaches "completed" first wins.
import { db } from "@/db";
import { audioExports } from "@/db/schema";
import { eq } from "drizzle-orm";
import { pollJob } from "@/lib/higgsfield/client";

export type LipsyncPollOutcome =
  | { outcome: "completed"; videoUrl: string }
  | { outcome: "failed" }
  | { outcome: "processing" }
  | { outcome: "no_job" };

export async function pollAndUpdateLipsync(params: {
  audioExportId: string;
  segmindApiKey: string;
}): Promise<LipsyncPollOutcome> {
  const audioExport = await db.query.audioExports.findFirst({
    where: eq(audioExports.id, params.audioExportId),
  });
  if (!audioExport) return { outcome: "no_job" };
  if (audioExport.lipsyncStatus === "completed" && audioExport.lipsyncVideoUrl) {
    return { outcome: "completed", videoUrl: audioExport.lipsyncVideoUrl };
  }
  if (!audioExport.lipsyncJobId) return { outcome: "no_job" };

  // Stored as "requestId|pollingUrl" (same convention as productionShots.higgsfieldJobId)
  // — the real pollingUrl generateLipsync returned, not a guessed URL shape.
  const [, pollingUrl] = audioExport.lipsyncJobId.split("|");
  if (!pollingUrl) return { outcome: "no_job" };

  const { status, mediaUrl } = await pollJob({ apiKey: params.segmindApiKey, pollingUrl });

  if (status === "COMPLETED" && mediaUrl) {
    await db.update(audioExports)
      .set({ lipsyncVideoUrl: mediaUrl, lipsyncStatus: "completed" })
      .where(eq(audioExports.id, params.audioExportId));
    return { outcome: "completed", videoUrl: mediaUrl };
  }

  if (status === "FAILED" || status === "ERROR") {
    await db.update(audioExports)
      .set({ lipsyncStatus: "failed" })
      .where(eq(audioExports.id, params.audioExportId));
    return { outcome: "failed" };
  }

  return { outcome: "processing" };
}
