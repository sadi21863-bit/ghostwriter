export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { z } from "zod";
import { decodeCharacterSkills, decodeKnowledgeMap, decodeIntelligenceProfile } from "@/lib/types/story";
import { fromSession } from "@/lib/core/auth-decorators";
import {
  deleteCharacter,
  updateCharacter,
} from "@/lib/core/handlers/characters";
import { pgPostCommitHooks } from "@/lib/core/pg-repositories";
import { pgCharacterCrudRepository } from "@/lib/core/pg-character-location-repos";

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

/**
 * Phase 2 / v4 §7 — thin auth adapter for `updateCharacter` / `deleteCharacter`.
 *
 * Transport validation stays HERE, in the original order: the ownership probe
 * runs BEFORE the body is read, so a wrong-project caller with an invalid patch
 * still 404s instead of leaking "Invalid fields" (the `404-before-400` order of
 * today's route). The Advanced character JSONB blobs (skills/knowledgeMap/
 * intelligenceProfile/significantFlaws) are decoded through the story guard in
 * the adapter, because the strict `CharacterPatch` allowlist drops them.
 *
 * Everything else — the scoped write, the server-owned `updatedAt`, and the §11
 * revision bump after a non-empty patch or a delete — lives in the handler.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ projectId: string; characterId: string }> }) {
  const s = await getRequiredSession();
  const { projectId, characterId } = await params;
  if (!(await pgCharacterCrudRepository.ownsProject(projectId, s.user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
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
  const result = await updateCharacter(
    fromSession(s),
    { projectId, characterId, patch: { ...parsed.data, ...jsonb } },
    pgCharacterCrudRepository,
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json(result.character);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ projectId: string; characterId: string }> }) {
  const s = await getRequiredSession();
  const { projectId, characterId } = await params;
  const result = await deleteCharacter(
    fromSession(s),
    { projectId, characterId },
    pgCharacterCrudRepository,
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
