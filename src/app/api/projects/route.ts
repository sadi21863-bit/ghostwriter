export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { projects, chapters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { track } from "@/lib/analytics";
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
    },
    with: {
      chapters: { columns: { id: true, title: true, wordCount: true, sortOrder: true } },
      characters: { columns: { id: true, name: true } },
    },
    orderBy: (p, { desc }) => [desc(p.updatedAt)],
  });
  return NextResponse.json(r);
}
export async function POST(req: Request) { const s = await getRequiredSession(); const b = await req.json(); const [p] = await db.insert(projects).values({ userId: s.user.id, name: b.name || "Untitled", format: b.format || "Novel", skillLevel: b.skillLevel || "beginner", genres: b.genres || [], storyType: b.storyType || "linear" }).returning(); await db.insert(chapters).values({ projectId: p.id, title: "Chapter 1", sortOrder: 0 }); await track(s.user.id, 'project_created', { format: b.format || 'Novel' }); return NextResponse.json(p, { status: 201 }); }
