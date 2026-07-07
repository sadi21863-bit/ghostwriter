export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encrypt, keyLast4 } from "@/lib/crypto";

export async function GET() {
  const s = await getRequiredSession();
  const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    higgsfieldKeySet:          (user.higgsfieldApiKey || "").length > 0,
    higgsfieldKeyLast4:        keyLast4(user.higgsfieldApiKey || ""),
    higgsfieldSecretSet:       (user.higgsfieldApiSecret || "").length > 0,
    higgsfieldSecretLast4:     keyLast4(user.higgsfieldApiSecret || ""),
    segmindKeySet:             (user.segmindApiKey || "").length > 0,
    segmindKeyLast4:           keyLast4(user.segmindApiKey || ""),
    openaiKeySet:              (user.openaiApiKey || "").length > 0,
    openaiKeyLast4:            keyLast4(user.openaiApiKey || ""),
    imageProviderId:           user.imageProviderId || "segmind_soul",
    ttsProviderId:             user.ttsProviderId || "openai",
    trendIntelligenceKeySet:   (user.trendIntelligenceKey || "").length > 0,
    trendIntelligenceKeyLast4: keyLast4(user.trendIntelligenceKey || ""),
  });
}

export async function PATCH(req: Request) {
  const s = await getRequiredSession();
  const { higgsfieldApiKey, higgsfieldApiSecret, segmindApiKey, openaiApiKey, imageProviderId, ttsProviderId, trendIntelligenceKey } = await req.json();

  const update: Record<string, string | Date> = {};
  if (higgsfieldApiKey     !== undefined) update.higgsfieldApiKey     = encrypt(higgsfieldApiKey);
  if (higgsfieldApiSecret  !== undefined) update.higgsfieldApiSecret  = encrypt(higgsfieldApiSecret);
  if (segmindApiKey        !== undefined) update.segmindApiKey        = encrypt(segmindApiKey);
  if (openaiApiKey         !== undefined) update.openaiApiKey         = encrypt(openaiApiKey);
  if (trendIntelligenceKey !== undefined) update.trendIntelligenceKey = encrypt(trendIntelligenceKey);
  if (imageProviderId      !== undefined) update.imageProviderId      = imageProviderId;
  if (ttsProviderId        !== undefined) update.ttsProviderId        = ttsProviderId;
  update.updatedAt = new Date();

  await db.update(users).set(update).where(eq(users.id, s.user.id));
  return NextResponse.json({ success: true });
}
