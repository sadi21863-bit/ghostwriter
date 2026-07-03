export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, chapters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { track } from "@/lib/analytics";
import { getUserTier } from "@/lib/subscription";
import { MAX_PROJECTS } from "@/lib/metering/costs";
export async function GET() {
  const s = await getRequiredSession();
  const r = await db.query.projects.findMany({
    where: eq(projects.userId, s.user.id),
    columns: {
      id: true,
      name: true,
      format: true,
      genres: true,
      updatedAt: true,
      createdAt: true,
      skillLevel: true,
      isHiggsfieldProject: true,
      universeId: true,
    },
    with: {
      chapters: { columns: { id: true, title: true, wordCount: true, sortOrder: true } },
      characters: { columns: { id: true, name: true } },
    },
    orderBy: (p, { desc }) => [desc(p.updatedAt)],
  });
  return NextResponse.json(r);
}
export async function POST(req: Request) {
  const s = await getRequiredSession();
  const b = await req.json();

  const tier = await getUserTier(s.user.id);
  const maxProjects = MAX_PROJECTS[tier] ?? 3;
  if (maxProjects !== -1) {
    const existing = await db.query.projects.findMany({
      where: eq(projects.userId, s.user.id),
      columns: { id: true },
    });
    if (existing.length >= maxProjects) {
      return NextResponse.json(
        { error: "Project limit reached for your plan", upgrade: true },
        { status: 403 }
      );
    }
  }

  const [p] = await db.insert(projects).values({
    userId: s.user.id,
    name: b.name || "Untitled",
    format: b.format || "Novel",
    skillLevel: b.skillLevel || "beginner",
    genres: b.genres || [],
    storyType: b.storyType || "linear",
    biggestChallenge: b.biggestChallenge || "",
  }).returning();

  await db.insert(chapters).values({ projectId: p.id, title: "Chapter 1", sortOrder: 0 });
  await track(s.user.id, 'project_created', { format: b.format || 'Novel' });
  return NextResponse.json(p, { status: 201 });
}
