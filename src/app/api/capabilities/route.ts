export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { getUserTier } from "@/lib/subscription";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";
import { supportEnvelope } from "@/lib/capabilities/registry";

export async function GET(req: Request) {
  const s = await getRequiredSession();
  const tier = await getUserTier(s.user.id);
  const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
  const format = new URL(req.url).searchParams.get("format") ?? "Novel";

  const envelope = supportEnvelope({
    tier,
    hasSegmindKey: !!decrypt(user?.segmindApiKey ?? ""),
    hasOpenAIKey: !!decrypt(user?.openaiApiKey ?? ""),
    format,
  });

  return NextResponse.json({ envelope });
}
