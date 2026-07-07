export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";
import { verifyQstashRequest, scheduleCallback, isQstashConfigured } from "@/lib/queue/qstash";
import { pollAndUpdateLipsync } from "@/lib/audio/poll-lipsync";

// QStash-driven leg of the audio-lipsync job poll — same pattern as
// segmind-video-poll/route.ts (see src/lib/queue/qstash.ts for the full
// rationale). Lipsync can run several minutes for a full chapter, so this
// keeps the job progressing even if the user closes the tab. A deployment
// without QSTASH_TOKEN set never reaches this route at all (scheduleCallback()
// is a no-op — see /api/audio/lipsync's POST route).
const MAX_ATTEMPTS = 40; // ~10 minutes at the 15s cadence scheduleCallback defaults to

export async function POST(req: Request) {
  let payload: any;
  try {
    payload = await verifyQstashRequest(req);
  } catch (e) {
    return NextResponse.json({ error: `Invalid QStash signature: ${(e as Error).message}` }, { status: 401 });
  }

  const { userId, audioExportId, attempt = 0 } = payload ?? {};
  if (!userId || !audioExportId) {
    return NextResponse.json({ error: "Missing userId/audioExportId" }, { status: 400 });
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const segmindApiKey = decrypt(user?.segmindApiKey ?? "");
  if (!segmindApiKey) {
    // Nothing we can do without a key — stop rescheduling rather than loop forever.
    return NextResponse.json({ outcome: "no_key" });
  }

  const result = await pollAndUpdateLipsync({ audioExportId, segmindApiKey });

  if (result.outcome === "processing" && attempt < MAX_ATTEMPTS && isQstashConfigured()) {
    const origin = new URL(req.url).origin;
    await scheduleCallback({
      url: `${origin}/api/queue/segmind-lipsync-poll`,
      body: { userId, audioExportId, attempt: attempt + 1 },
      delaySeconds: 15,
    });
  }

  return NextResponse.json({ outcome: result.outcome, attempt });
}
