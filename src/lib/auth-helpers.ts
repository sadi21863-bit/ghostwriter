import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { NextResponse } from "next/server";
export async function getRequiredSession(){ const s=await getServerSession(authOptions); if(!s?.user?.id) throw NextResponse.json({ error: "Unauthorized" }, { status: 401 }); return s; }
export async function getOptionalSession(){ return getServerSession(authOptions); }