export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { getUserTier } from "@/lib/subscription";
import { buildSceneBlueprint } from "@/lib/ai/scene-blueprint";
import { db } from "@/db";
import { projects, storyMemories } from "@/db/schema";
import { and, eq } from "drizzle-orm";

// On-demand Scene Blueprint. Returns the planner output so the writer can see and
// edit it before generating. Builds a light context server-side from the project,
// so the client only needs to send { prompt, projectId }.
export async function POST(req: Request) {
  const session = await getRequiredSession();
  const rl = await checkAiRateLimit(session.user.id);
  if (rl) return rl;

  const { prompt, projectId } = await req.json();
  if (!prompt?.trim()) return NextResponse.json({ error: "Describe the scene first." }, { status: 400 });

  const tier = await getUserTier(session.user.id);
  if (tier === 'free') return NextResponse.json({ error: "upgrade_required", feature: "scene_planning" }, { status: 403 });

  let format = "Novel";
  const lines: string[] = [];
  if (projectId) {
    const proj = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
      columns: { name: true, format: true, genres: true, controllingIdea: true, premise: true },
    });
    if (proj) {
      format = (proj as any).format || "Novel";
      if ((proj as any).name) lines.push(`Title: ${(proj as any).name}`);
      const genres = (proj as any).genres;
      if (Array.isArray(genres) && genres.length) lines.push(`Genre: ${genres.join(", ")}`);
      if ((proj as any).controllingIdea) lines.push(`Controlling idea: ${(proj as any).controllingIdea}`);
      if ((proj as any).premise) lines.push(`Premise: ${(proj as any).premise}`);
    }
    const mems = await db.query.storyMemories.findMany({
      where: eq(storyMemories.projectId, projectId),
      orderBy: (m, { desc }) => [desc(m.chapterIndex)],
      limit: 2,
    });
    const recent = mems.map((m: any) => m.fact).filter(Boolean);
    if (recent.length) lines.push(`Recent events: ${recent.reverse().join(" | ")}`);
  }

  const text = await buildSceneBlueprint({ prompt, dynamicContext: lines.join("\n"), format });
  return NextResponse.json({ text });
}
