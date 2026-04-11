import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { eq } from "drizzle-orm";
export async function PATCH(req,{params}){ await getRequiredSession(); const b=await req.json(); const [u]=await db.update(characters).set(b).where(eq(characters.id,params.characterId)).returning(); return NextResponse.json(u); }
export async function DELETE(_,{params}){ await getRequiredSession(); await db.delete(characters).where(eq(characters.id,params.characterId)); return NextResponse.json({ok:true}); }