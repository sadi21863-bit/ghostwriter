import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const s = await getRequiredSession();
  const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    higgsfieldKeySet: (user.higgsfieldApiKey || "").length > 0,
    higgsfieldKeyLast4: user.higgsfieldApiKey?.slice(-4) || "",
    openaiKeySet: (user.openaiApiKey || "").length > 0,
    openaiKeyLast4: user.openaiApiKey?.slice(-4) || "",
    imageProviderId: user.imageProviderId || "segmind_soul",
  });
}

export async function PATCH(req: Request) {
  const s = await getRequiredSession();
  const { higgsfieldApiKey, openaiApiKey, imageProviderId } = await req.json();
  const update: Record<string, any> = {};
  if (higgsfieldApiKey !== undefined) update.higgsfieldApiKey = higgsfieldApiKey;
  if (openaiApiKey !== undefined) update.openaiApiKey = openaiApiKey;
  if (imageProviderId !== undefined) update.imageProviderId = imageProviderId;
  await db.update(users).set(update).where(eq(users.id, s.user.id));
  return NextResponse.json({ success: true });
}
