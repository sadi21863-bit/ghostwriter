import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { referenceWorks } from "@/db/schema";
export async function POST(req,{params}){ await getRequiredSession(); const b=await req.json(); const [r]=await db.insert(referenceWorks).values({projectId:params.projectId,...b}).returning(); return NextResponse.json(r,{status:201}); }