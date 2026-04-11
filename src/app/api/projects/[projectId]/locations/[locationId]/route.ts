import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { eq } from "drizzle-orm";
export async function PATCH(req,{params}){ await getRequiredSession(); const b=await req.json(); const [u]=await db.update(locations).set(b).where(eq(locations.id,params.locationId)).returning(); return NextResponse.json(u); }
export async function DELETE(_,{params}){ await getRequiredSession(); await db.delete(locations).where(eq(locations.id,params.locationId)); return NextResponse.json({ok:true}); }