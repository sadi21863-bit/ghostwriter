import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { referenceWorks } from "@/db/schema";
import { eq } from "drizzle-orm";
export async function DELETE(_,{params}){ await getRequiredSession(); await db.delete(referenceWorks).where(eq(referenceWorks.id,params.refId)); return NextResponse.json({ok:true}); }