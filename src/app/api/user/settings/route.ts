import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const s = await getRequiredSession();
  const user = await db.query.users.findFirst({ where: eq(users.id, s.user.id) });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const key = user.higgsfieldApiKey || "";
  return NextResponse.json({
    higgsfieldKeySet: key.length > 0,
    higgsfieldKeyLast4: key.length >= 4 ? key.slice(-4) : "",
  });
}

export async function PATCH(req: Request) {
  const s = await getRequiredSession();
  const { higgsfieldApiKey } = await req.json();
  await db.update(users).set({ higgsfieldApiKey: higgsfieldApiKey ?? "" }).where(eq(users.id, s.user.id));
  return NextResponse.json({ success: true });
}
