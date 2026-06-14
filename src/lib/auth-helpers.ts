import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { and, eq } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
export async function getRequiredSession(){ const s=await getServerSession(authOptions); if(!s?.user?.id) throw NextResponse.json({ error: "Unauthorized" }, { status: 401 }); return s; }
export async function getOptionalSession(){ return getServerSession(authOptions); }

/** Confirms a child row belongs to the given project — use to scope any lookup of a resource by its own ID. */
export async function verifyChildOwnership(
  table: PgTable & { id: AnyPgColumn; projectId: AnyPgColumn },
  childId: string,
  projectId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, childId), eq(table.projectId, projectId)))
    .limit(1);
  return !!row;
}