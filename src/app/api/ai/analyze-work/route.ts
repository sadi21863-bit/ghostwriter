import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { analyzeWork } from "@/lib/ai/engine";
export async function POST(req: NextRequest){ await getRequiredSession(); const {title}=await req.json(); return NextResponse.json({attributes:await analyzeWork(title)}); }