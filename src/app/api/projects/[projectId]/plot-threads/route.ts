import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { plotThreads } from "@/db/schema";
export async function POST(req: Request, { params }: { params: { projectId: string } }){ await getRequiredSession(); const b=await req.json(); const [r]=await db.insert(plotThreads).values({projectId:params.projectId,...b}).returning(); return NextResponse.json(r,{status:201}); }