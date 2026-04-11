import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { generate } from "@/lib/ai/engine";
import { db } from "@/db";
import { generations } from "@/db/schema";
export async function POST(req){ await getRequiredSession(); const {mode,prompt,context,format,projectId,chapterId}=await req.json(); const r=await generate({mode,prompt,context,format}); await db.insert(generations).values({projectId,chapterId:chapterId||null,mode,prompt,output:r.text,model:r.model,tokensUsed:r.tokensUsed}); return NextResponse.json(r); }