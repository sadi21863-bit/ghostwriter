export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { bootstrapCharacterIntelligence } from "@/lib/ai/engine";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { fromSession } from "@/lib/core/auth-decorators";
import {
  createCharacter,
  type CharacterCreateData,
} from "@/lib/core/handlers/characters";
import { pgPostCommitHooks } from "@/lib/core/pg-repositories";
import { pgCharacterCrudRepository } from "@/lib/core/pg-character-location-repos";

/**
 * Phase 2 / v4 §7 — thin auth adapter for `createCharacter`.
 *
 * The route produces a `RequestContext`, calls the handler, and shapes a
 * response. It owns only the transport validations whose 400s must keep
 * happening HERE (in the original order): the ownership probe runs BEFORE the
 * body is read, so a wrong-project caller with a missing `name` still got
 * the 404 from today's route — the `404-before-400` order is preserved, and the
 * handler re-proves ownership itself so a same-shaped request coming from a
 * non-Next host cannot outflank it.
 *
 * The create's embedding + duplicate-detection wiring and the
 * fire-and-forget `bootstrapCharacterIntelligence` side effect live in the
 * handler (`embedText` / `postCreate` DI seams); the adapter supplies their I/O,
 * exactly like the chapter PATCH adapter supplies `onChapterContentChanged`.
 */
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }){
  const session = await getRequiredSession();
  const { projectId } = await params;
  if (!(await pgCharacterCrudRepository.ownsProject(projectId, session.user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json();
  const { name, role, age, appearance, personality, thinkingStyle, behavior, habits, fears, desires,
    speechPattern, backstory, arc, alwaysInContext, sortOrder, contextVisibility } = body;
  if (!name || typeof name !== "string") return NextResponse.json({ error: "name is required" }, { status: 400 });

  const data: CharacterCreateData = {
    name, role, age, appearance, personality, thinkingStyle, behavior, habits, fears, desires,
    speechPattern, backstory, arc, alwaysInContext, sortOrder, contextVisibility,
  };

  const result = await createCharacter(
    fromSession(session),
    { projectId, data },
    pgCharacterCrudRepository,
    { onCanonicalMutation: pgPostCommitHooks.onCanonicalMutation },
    (text) => generateEmbedding(text),
    (row, format) => {
      // Fire-and-forget, byte-for-byte the old route's side effect: an empty
      // intelligence result writes nothing, and failures surface only in logs.
      bootstrapCharacterIntelligence(
        { name: row.name, role: row.role ?? "", age: row.age ?? "", personality: row.personality ?? "" } as {
          name: string; role: string; age: string; personality: string;
        },
        "",
        format,
      )
        .then(async (intelligence) => {
          if (Object.keys(intelligence).length === 0) return;
          await pgCharacterCrudRepository.updateScoped(
            projectId,
            row.id,
            intelligence as unknown as Record<string, unknown>,
          );
        })
        .catch((err) => console.error("[bootstrap] Failed for", row.name, err));
    },
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json({ ...result.character, similarEntities: result.similarEntities }, { status: 201 });
}
