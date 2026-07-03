export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { db } from "@/db";
import { characters, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { decodeCharacterSkills, decodeKnowledgeMap, decodeIntelligenceProfile } from "@/lib/types/story";

const CharacterPatch = z.object({
  name: z.string().min(1).optional(),
  role: z.string().optional(),
  age: z.string().optional(),
  appearance: z.string().optional(),
  personality: z.string().optional(),
  thinkingStyle: z.string().optional(),
  behavior: z.string().optional(),
  habits: z.string().optional(),
  fears: z.string().optional(),
  desires: z.string().optional(),
  speechPattern: z.string().optional(),
  backstory: z.string().optional(),
  arc: z.string().optional(),
  portraitUrl: z.string().optional(),
  // TTS voice for Audio Novel generation (src/app/api/audio/generate) — falls
  // back to the narrator voice when unset. Kept a loose string (not a strict
  // enum) so adding a provider voice later doesn't require a schema change.
  voiceId: z.string().optional(),
  linkedLocationIds: z.array(z.string().uuid()).optional(),
  linkedPlotThreadIds: z.array(z.string().uuid()).optional(),
  alwaysInContext: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  contextVisibility: z.enum(["always", "mentioned", "never"]).optional(),
});

async function verifyOwnership(projectId: string, userId: string) {
  return db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.userId, userId)) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ projectId: string; characterId: string }> }) {
  const s = await getRequiredSession();
  const { projectId, characterId } = await params;
  if (!await verifyOwnership(projectId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const raw = await req.json();
  const parsed = CharacterPatch.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
  // Advanced character JSONB blobs aren't in the strict CharacterPatch allowlist
  // (they're free-form Record/array shapes). They were silently dropped here,
  // so edits in the World Bible never persisted. Decode each leniently through
  // the story guard so they're now saved in a known, normalized shape.
  const jsonb: Record<string, unknown> = {};
  if (raw.skills !== undefined) jsonb.skills = decodeCharacterSkills(raw.skills);
  if (raw.knowledgeMap !== undefined) jsonb.knowledgeMap = decodeKnowledgeMap(raw.knowledgeMap);
  if (raw.intelligenceProfile !== undefined) jsonb.intelligenceProfile = decodeIntelligenceProfile(raw.intelligenceProfile);
  if (Array.isArray(raw.significantFlaws)) jsonb.significantFlaws = raw.significantFlaws.filter((x: unknown): x is string => typeof x === "string");
  const [u] = await db.update(characters).set({ ...parsed.data, ...jsonb, updatedAt: new Date() })
    .where(and(eq(characters.id, characterId), eq(characters.projectId, projectId)))
    .returning();
  return NextResponse.json(u);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ projectId: string; characterId: string }> }) {
  const s = await getRequiredSession();
  const { projectId, characterId } = await params;
  if (!await verifyOwnership(projectId, s.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.delete(characters).where(and(eq(characters.id, characterId), eq(characters.projectId, projectId)));
  return NextResponse.json({ ok: true });
}
