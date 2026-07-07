export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth-helpers";
import { bootstrapCharacterIntelligence } from "@/lib/ai/engine";
import { db } from "@/db";
import { characters, projects } from "@/db/schema";
import { eq, and, ne, isNotNull } from "drizzle-orm";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { buildCharacterEmbeddingText, findSimilarEntities } from "@/lib/world-bible/duplicate-detection";
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }){
  const session = await getRequiredSession();
  const { projectId } = await params;
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)) });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const { name, role, age, appearance, personality, thinkingStyle, behavior, habits, fears, desires,
    speechPattern, backstory, arc, alwaysInContext, sortOrder, contextVisibility } = body;
  if (!name || typeof name !== "string") return NextResponse.json({ error: "name is required" }, { status: 400 });

  const embedding = await generateEmbedding(buildCharacterEmbeddingText({ name, role, appearance, personality, backstory })).catch(() => null);

  const [r] = await db.insert(characters).values({
    projectId, name, role, age, appearance, personality, thinkingStyle, behavior, habits, fears,
    desires, speechPattern, backstory, arc, alwaysInContext, sortOrder, contextVisibility, embedding,
  }).returning();

  let similarEntities: ReturnType<typeof findSimilarEntities> = [];
  if (r && embedding) {
    const others = await db.query.characters.findMany({
      where: and(eq(characters.projectId, projectId), ne(characters.id, r.id), isNotNull(characters.embedding)),
      columns: { id: true, name: true, embedding: true },
    });
    similarEntities = findSimilarEntities(embedding, others);
  }

  if (r) {
    bootstrapCharacterIntelligence(
      { name: r.name, role: r.role ?? "", age: r.age ?? "", personality: r.personality ?? "" },
      "",
      project.format,
    )
      .then(async (intelligence) => {
        if (Object.keys(intelligence).length === 0) return;
        await db.update(characters).set(intelligence as any).where(eq(characters.id, r.id));
      })
      .catch((err) => console.error("[bootstrap] Failed for", r.name, err));
  }

  return NextResponse.json({ ...r, similarEntities }, { status: 201 });
}