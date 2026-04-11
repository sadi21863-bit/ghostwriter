import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { generateEntity } from "@/lib/ai/engine";
export async function POST(req){ await getRequiredSession(); const {type,prompt,projectContext,existing}=await req.json(); return NextResponse.json(await generateEntity(type,prompt,projectContext,existing)); }