import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, productionShots } from "@/db/schema";
import { eq, and } from "drizzle-orm";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function GET(_: Request, { params }: { params: { projectId: string } }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership(params.projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const shots = await db.query.productionShots.findMany({
    where: eq(productionShots.projectId, params.projectId),
    with: { primaryCharacter: true },
    orderBy: (s, { asc }) => [asc(s.sceneNumber), asc(s.shotNumber)],
  });

  return NextResponse.json({ shots });
}
