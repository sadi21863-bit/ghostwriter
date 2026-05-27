import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { chapters } from "@/db/schema";
import { eq } from "drizzle-orm";
export async function POST(req: Request, { params }: { params: { projectId: string } }){ await getRequiredSession(); const b=await req.json(); const ex=await db.query.chapters.findMany({where:eq(chapters.projectId,params.projectId)}); const [c]=await db.insert(chapters).values({projectId:params.projectId,title:b.title||"Chapter "+(ex.length+1),sortOrder:ex.length}).returning(); return NextResponse.json(c,{status:201}); }