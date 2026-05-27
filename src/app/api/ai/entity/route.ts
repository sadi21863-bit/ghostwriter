import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { generateEntity } from "@/lib/ai/engine";
export async function POST(req: Request){ const session=await getRequiredSession(); const rl=await checkAiRateLimit(session.user.id); if(rl) return rl; const {type,prompt,projectContext,existing}=await req.json(); return NextResponse.json(await generateEntity(type,prompt,projectContext,existing)); }