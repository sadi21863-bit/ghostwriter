import { db } from "@/db";
import { semanticCache } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

// 0.92 = very similar — safe for research/analysis reuse across sessions
const SIMILARITY_THRESHOLD = 0.92;

export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
    });
    return res.data[0].embedding;
  } catch {
    return null;
  }
}

export async function checkSemanticCache(
  cacheType: string,
  inputKey: string
): Promise<Record<string, unknown> | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const embedding = await generateEmbedding(inputKey);
    if (!embedding) return null;

    const embeddingStr = `[${embedding.join(",")}]`;

    const results = await db.execute(sql`
      SELECT id, cached_output, hit_count,
             1 - (embedding <=> ${embeddingStr}::vector) AS similarity
      FROM semantic_cache
      WHERE cache_type = ${cacheType}
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> ${embeddingStr}::vector) >= ${SIMILARITY_THRESHOLD}
      ORDER BY similarity DESC
      LIMIT 1
    `);

    if (!results.rows || results.rows.length === 0) return null;

    const row = results.rows[0] as any;

    await db.update(semanticCache)
      .set({ hitCount: (row.hit_count ?? 0) + 1, lastHitAt: new Date() })
      .where(eq(semanticCache.id, row.id));

    return row.cached_output as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function writeSemanticCache(
  cacheType: string,
  inputKey: string,
  output: Record<string, unknown>
): Promise<void> {
  if (!process.env.OPENAI_API_KEY) return;

  try {
    const embedding = await generateEmbedding(inputKey);
    if (!embedding) return;

    await db.insert(semanticCache).values({
      cacheType,
      inputKey,
      embedding,
      cachedOutput: output,
    }).onConflictDoNothing();
  } catch {
    // Cache write failure must never break the main task
  }
}
