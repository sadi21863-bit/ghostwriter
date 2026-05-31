import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
type Ctx = { params: { projectId: string } };
export async function GET(_: Request, { params }: Ctx){ const s=await getRequiredSession(); const p=await db.query.projects.findFirst({where:and(eq(projects.id,params.projectId),eq(projects.userId,s.user.id)),with:{chapters:{orderBy:(c,{asc})=>[asc(c.sortOrder)]},characters:true,locations:true,plotThreads:true,referenceWorks:true,storyMemories:true,characterRelationships:true}}); if(!p) return NextResponse.json({error:"Not found"},{status:404}); return NextResponse.json(p); }
export async function PATCH(req: Request, { params }: Ctx){ const s=await getRequiredSession(); const b=await req.json(); const { name, format, genres, notes, skillLevel, aiRules } = b; const [u]=await db.update(projects).set({ name, format, genres, notes, skillLevel, ...(aiRules !== undefined ? { aiRules } : {}), updatedAt:new Date() }).where(and(eq(projects.id,params.projectId),eq(projects.userId,s.user.id))).returning(); return NextResponse.json(u); }
export async function DELETE(_: Request, { params }: Ctx){ const s=await getRequiredSession(); await db.delete(projects).where(and(eq(projects.id,params.projectId),eq(projects.userId,s.user.id))); return NextResponse.json({ok:true}); }