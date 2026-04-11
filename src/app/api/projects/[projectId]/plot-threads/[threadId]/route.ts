import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { plotThreads } from "@/db/schema";
import { eq } from "drizzle-orm";
export async function PATCH(req,{params}){ await getRequiredSession(); const b=await req.json(); const [u]=await db.update(plotThreads).set(b).where(eq(plotThreads.id,params.threadId)).returning(); return NextResponse.json(u); }
export async function DELETE(_,{params}){ await getRequiredSession(); await db.delete(plotThreads).where(eq(plotThreads.id,params.threadId)); return NextResponse.json({ok:true}); }