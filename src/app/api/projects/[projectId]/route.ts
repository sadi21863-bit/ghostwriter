import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
export async function GET(_,{params}){ const s=await getRequiredSession(); const p=await db.query.projects.findFirst({where:and(eq(projects.id,params.projectId),eq(projects.userId,s.user.id)),with:{chapters:{orderBy:(c,{asc})=>[asc(c.sortOrder)]},characters:true,locations:true,plotThreads:true,referenceWorks:true}}); if(!p) return NextResponse.json({error:"Not found"},{status:404}); return NextResponse.json(p); }
export async function PATCH(req,{params}){ const s=await getRequiredSession(); const b=await req.json(); const [u]=await db.update(projects).set({...b,updatedAt:new Date()}).where(and(eq(projects.id,params.projectId),eq(projects.userId,s.user.id))).returning(); return NextResponse.json(u); }
export async function DELETE(_,{params}){ const s=await getRequiredSession(); await db.delete(projects).where(and(eq(projects.id,params.projectId),eq(projects.userId,s.user.id))); return NextResponse.json({ok:true}); }