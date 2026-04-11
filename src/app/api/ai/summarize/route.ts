import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { summarizeChapter } from "@/lib/ai/engine";
export async function POST(req){ await getRequiredSession(); const {content}=await req.json(); return NextResponse.json({summary:await summarizeChapter(content)}); }