export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { track } from "@/lib/analytics";

const ALLOWED_EVENTS = new Set(["guide_clicked", "guide_dismissed"]);

export async function POST(req: Request) {
  const s = await getRequiredSession();
  const b = await req.json();
  const { event, properties } = b;
  if (typeof event !== "string" || !ALLOWED_EVENTS.has(event)) {
    return NextResponse.json({ error: "Unknown event" }, { status: 400 });
  }
  await track(s.user.id, event, properties ?? {});
  return NextResponse.json({ ok: true });
}
