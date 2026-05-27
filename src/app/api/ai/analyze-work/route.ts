import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { analyzeWork } from "@/lib/ai/engine";
export async function POST(req: NextRequest){ const session=await getRequiredSession(); const rl=await checkAiRateLimit(session.user.id); if(rl) return rl; const {title}=await req.json(); return NextResponse.json({attributes:await analyzeWork(title)}); }