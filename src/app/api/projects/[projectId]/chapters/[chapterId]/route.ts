import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { chapters } from "@/db/schema";
import { eq } from "drizzle-orm";
export async function PATCH(req,{params}){ await getRequiredSession(); const b=await req.json(); if(b.content!==undefined) b.wordCount=b.content.trim().split(/\s+/).filter(Boolean).length; const [u]=await db.update(chapters).set({...b,updatedAt:new Date()}).where(eq(chapters.id,params.chapterId)).returning(); return NextResponse.json(u); }
export async function DELETE(_,{params}){ await getRequiredSession(); await db.delete(chapters).where(eq(chapters.id,params.chapterId)); return NextResponse.json({ok:true}); }