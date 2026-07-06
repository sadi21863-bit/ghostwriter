export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";
import { verifyQstashRequest, scheduleCallback, isQstashConfigured } from "@/lib/queue/qstash";
import { pollAndUpdateShotVideo } from "@/lib/production/poll-shot-video";

// QStash-driven leg of the video job poll (see src/lib/queue/qstash.ts and
// src/lib/production/poll-shot-video.ts for the full rationale). This runs the
// same check-and-update the client's own status-polling route does, but as a
// server-scheduled callback — so the job keeps progressing even if the user
// closes the tab. Purely additive: it updates the same productionShots row the
// client-polling route reads, so either side reaching "final_ready" first is
// fine, and a deployment without QSTASH_TOKEN set never reaches this route at
// all (scheduleCallback() is a no-op — see the generate-video POST route).
const MAX_ATTEMPTS = 40; // ~10 minutes at the 15s cadence scheduleCallback defaults to

export async function POST(req: Request) {
  let payload: any;
  try {
    payload = await verifyQstashRequest(req);
  } catch (e) {
    return NextResponse.json({ error: `Invalid QStash signature: ${(e as Error).message}` }, { status: 401 });
  }

  const { userId, projectId, shotId, attempt = 0 } = payload ?? {};
  if (!userId || !projectId || !shotId) {
    return NextResponse.json({ error: "Missing userId/projectId/shotId" }, { status: 400 });
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const segmindApiKey = decrypt(user?.segmindApiKey ?? "");
  if (!segmindApiKey) {
    // Nothing we can do without a key — stop rescheduling rather than loop forever.
    return NextResponse.json({ outcome: "no_key" });
  }

  const result = await pollAndUpdateShotVideo({ shotId, projectId, segmindApiKey });

  if (result.outcome === "generating_final" && attempt < MAX_ATTEMPTS && isQstashConfigured()) {
    const origin = new URL(req.url).origin;
    await scheduleCallback({
      url: `${origin}/api/queue/segmind-video-poll`,
      body: { userId, projectId, shotId, attempt: attempt + 1 },
      delaySeconds: 15,
    });
  }

  return NextResponse.json({ outcome: result.outcome, attempt });
}
