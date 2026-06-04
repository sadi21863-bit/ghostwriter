export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { characters, locations, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function POST(_: Request, { params }: { params: { projectId: string } }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership(params.projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, params.projectId),
    with: { characters: true, locations: true, plotThreads: true, chapters: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Count co-occurrences: how many chapters each character/location pair appear in together
  const charLocCounts: Record<string, Record<string, number>> = {};
  const charPlotCounts: Record<string, Record<string, number>> = {};

  for (const chapter of project.chapters) {
    const content = (chapter.content || "").toLowerCase();
    if (!content.trim()) continue;

    const charsPresent = project.characters.filter(c => content.includes(c.name.toLowerCase()));
    const locsPresent = project.locations.filter(l => content.includes(l.name.toLowerCase()));
    const plotsPresent = project.plotThreads.filter(t => content.includes(t.name.toLowerCase()));

    for (const char of charsPresent) {
      for (const loc of locsPresent) {
        charLocCounts[char.id] ??= {};
        charLocCounts[char.id][loc.id] = (charLocCounts[char.id][loc.id] ?? 0) + 1;
      }
      for (const plot of plotsPresent) {
        charPlotCounts[char.id] ??= {};
        charPlotCounts[char.id][plot.id] = (charPlotCounts[char.id][plot.id] ?? 0) + 1;
      }
    }
  }

  const suggestions: { type: string; characterId: string; characterName: string; targetId: string; targetName: string; coOccurrences: number }[] = [];

  for (const [charId, locs] of Object.entries(charLocCounts)) {
    const char = project.characters.find(c => c.id === charId);
    if (!char) continue;
    for (const [locId, count] of Object.entries(locs)) {
      if (count < 2) continue; // only suggest if they appear together in 2+ chapters
      const alreadyLinked = (char.linkedLocationIds || []).includes(locId);
      if (alreadyLinked) continue;
      const loc = project.locations.find(l => l.id === locId);
      if (!loc) continue;
      suggestions.push({ type: "char-loc", characterId: charId, characterName: char.name, targetId: locId, targetName: loc.name, coOccurrences: count });
    }
  }

  for (const [charId, plots] of Object.entries(charPlotCounts)) {
    const char = project.characters.find(c => c.id === charId);
    if (!char) continue;
    for (const [plotId, count] of Object.entries(plots)) {
      if (count < 2) continue;
      const alreadyLinked = (char.linkedPlotThreadIds || []).includes(plotId);
      if (alreadyLinked) continue;
      const plot = project.plotThreads.find(t => t.id === plotId);
      if (!plot) continue;
      suggestions.push({ type: "char-plot", characterId: charId, characterName: char.name, targetId: plotId, targetName: plot.name, coOccurrences: count });
    }
  }

  return NextResponse.json({ suggestions });
}

export async function PATCH(req: Request, { params }: { params: { projectId: string } }) {
  const s = await getRequiredSession();
  if (!await verifyOwnership(params.projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { type, characterId, targetId } = await req.json();

  if (type === "char-loc") {
    const char = await db.query.characters.findFirst({ where: eq(characters.id, characterId) });
    const loc = await db.query.locations.findFirst({ where: eq(locations.id, targetId) });
    if (!char || !loc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.update(characters).set({ linkedLocationIds: [...(char.linkedLocationIds || []), targetId] }).where(eq(characters.id, characterId));
    await db.update(locations).set({ linkedCharacterIds: [...(loc.linkedCharacterIds || []), characterId] }).where(eq(locations.id, targetId));
  } else if (type === "char-plot") {
    const char = await db.query.characters.findFirst({ where: eq(characters.id, characterId) });
    if (!char) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await db.update(characters).set({ linkedPlotThreadIds: [...(char.linkedPlotThreadIds || []), targetId] }).where(eq(characters.id, characterId));
  }

  return NextResponse.json({ ok: true });
}
