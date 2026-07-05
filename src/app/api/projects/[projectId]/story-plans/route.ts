export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { db } from "@/db";
import { projects, storyPlans, chapters } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { MODELS } from "@/lib/ai/engine";
import { beatSheetSystemPrompt, runDirectorCall } from "@/lib/roles/director";
import { encodeStoryBeats, type StoryBeat } from "@/lib/types/story";
import { expandArcPreset, getArcPreset } from "@/lib/graph/arc-presets";
import { buildSceneBlueprint } from "@/lib/ai/scene-blueprint";


function safeParseJson(raw: string) {
  const clean = raw.replace(/```json\n?|```/g, "").trim();
  try { return JSON.parse(clean); } catch { return null; }
}

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  if (!await verifyOwnership(projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const plans = await db.query.storyPlans.findMany({
    where: eq(storyPlans.projectId, projectId),
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });
  return NextResponse.json({ plans });
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const rl = await checkAiRateLimit(s.user.id);
  if (rl) return rl;
  const { projectId } = await params;

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, s.user.id)),
    with: { characters: true, plotThreads: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { prompt = "", title, presetId, kind, chapterId } = await req.json().catch(() => ({}));
  const cast = (project as any).characters ?? [];
  const threads = (project as any).plotThreads ?? [];

  if (kind === "chapter_plan") {
    if (!chapterId) return NextResponse.json({ error: "chapterId is required for a chapter plan." }, { status: 400 });
    // The project query above only loads `with: { characters, plotThreads }` — chapters
    // are not included, so look the chapter up directly rather than assuming it's on `project`.
    const chapter = await db.query.chapters.findFirst({
      where: and(eq(chapters.id, chapterId), eq(chapters.projectId, projectId)),
    });
    if (!chapter) return NextResponse.json({ error: "Chapter not found." }, { status: 404 });

    const staticContext = cast.map((c: any) => `${c.name}: ${c.personality ?? ""}`).join("\n");
    const blueprint = await buildSceneBlueprint({
      prompt: prompt || `Plan the next scene for "${chapter.title}".`,
      staticContext,
      format: project.format,
    });
    if (!blueprint) return NextResponse.json({ error: "Couldn't draft a scene plan. Try again." }, { status: 500 });

    const beats = encodeStoryBeats([{
      id: crypto.randomUUID(),
      order: 1,
      label: chapter.title,
      summary: blueprint,
      purpose: "rising",
      characterIds: [],
      threadIds: [],
      chapterId,
    }]);
    const [plan] = await db.insert(storyPlans).values({
      projectId, kind: "chapter_plan", title: `Plan: ${chapter.title}`, beats,
    }).returning();
    return NextResponse.json({ plan });
  }

  // Phase 4 subgraph/arc preset: scaffold a beat sheet from a known structure
  // (Three-Act / Hero's Journey / Save the Cat / Detective) — zero AI spend,
  // instant, ready to flesh out.
  if (presetId) {
    const preset = getArcPreset(presetId);
    if (!preset) return NextResponse.json({ error: "Unknown arc preset." }, { status: 400 });
    const beats = encodeStoryBeats(expandArcPreset(presetId));
    const [plan] = await db.insert(storyPlans).values({
      projectId, kind: "beat_sheet", title: title || preset.label, beats,
    }).returning();
    return NextResponse.json({ plan });
  }

  const result = await runDirectorCall({
    userId: s.user.id,
    operation: "beat-sheet",
    model: MODELS.default,
    maxTokens: 2000,
    system: beatSheetSystemPrompt(project.format, cast, threads),
    messages: [{ role: "user", content: prompt || "Build the beat sheet for this story." }],
  });
  if (!result.ok) return result.response;

  const parsed = safeParseJson(result.text);
  if (!parsed || !Array.isArray(parsed.beats))
    return NextResponse.json({ error: "Couldn't structure a beat sheet. Try a longer prompt." }, { status: 500 });

  // The model reasons in names; we persist ids. Map each beat's character/thread
  // names back to World Bible ids, assign order + a stable id, then validate.
  const nameToId = (list: { id: string; name: string }[]) =>
    (names: unknown): string[] => Array.isArray(names)
      ? names.map(n => list.find(x => x.name === n)?.id).filter((id): id is string => !!id)
      : [];
  const mapChars = nameToId(cast);
  const mapThreads = nameToId(threads);

  const beats = encodeStoryBeats((parsed.beats as any[]).map((b, i) => ({
    id: crypto.randomUUID(),
    order: i + 1,
    label: String(b?.label ?? `Beat ${i + 1}`),
    summary: String(b?.summary ?? ""),
    purpose: b?.purpose,
    characterIds: mapChars(b?.characters),
    threadIds: mapThreads(b?.threads),
  })));

  const [plan] = await db.insert(storyPlans).values({
    projectId,
    kind: "beat_sheet",
    title: title || "Beat Sheet",
    beats,
  }).returning();

  return NextResponse.json({ plan });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  if (!await verifyOwnership(projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { planId, title, beats } = await req.json();
  const set: { title?: string; beats?: StoryBeat[]; updatedAt: Date } = { updatedAt: new Date() };
  if (title !== undefined) set.title = title;
  if (beats !== undefined) {
    try { set.beats = encodeStoryBeats(beats); }
    catch { return NextResponse.json({ error: "Invalid beats shape." }, { status: 400 }); }
  }

  const [updated] = await db.update(storyPlans).set(set)
    .where(and(eq(storyPlans.id, planId), eq(storyPlans.projectId, projectId)))
    .returning();
  return NextResponse.json({ plan: updated });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const s = await getRequiredSession();
  const { projectId } = await params;
  if (!await verifyOwnership(projectId, s.user.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { planId } = await req.json();
  await db.delete(storyPlans).where(and(eq(storyPlans.id, planId), eq(storyPlans.projectId, projectId)));
  return NextResponse.json({ ok: true });
}
