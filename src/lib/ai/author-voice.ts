import { db } from "@/db";
import { chapters } from "@/db/schema";
import { eq, and, ne, isNotNull } from "drizzle-orm";
import { generateEmbedding, cosineSimilarity } from "@/lib/ai/embeddings";
import { isValidTipTapJson, tiptapToPlainText } from "@/lib/editor/content-migration";

const MIN_CONTENT_CHARS = 200; // skip near-empty chapters — nothing useful to anchor on
const EXCERPT_MAX_CHARS = 280;

function toPlainText(content: string): string {
  if (!content) return "";
  return isValidTipTapJson(content) ? tiptapToPlainText(JSON.parse(content)) : content;
}

// Fire-and-forget: recomputes and stores a chapter's embedding after its content
// changes. Never awaited by the caller's main save path — mirrors the fail-open,
// non-blocking convention already used by writeSemanticCache. Skips chapters too
// short to be a useful voice anchor.
export function updateChapterEmbedding(chapterId: string, content: string): void {
  const plain = toPlainText(content).trim();
  if (plain.length < MIN_CONTENT_CHARS) return;

  generateEmbedding(plain.slice(0, 8000))
    .then(embedding => db.update(chapters).set({ embedding }).where(eq(chapters.id, chapterId)))
    .catch(() => { /* embedding refresh must never affect the main save path */ });
}

// Author's-own-voice exemplars (extends the P1 style-exemplar idea in
// src/lib/ai/exemplars.ts from the SHARED craft library to the user's OWN past
// chapters in this project) — retrieves the 2 most semantically similar
// already-written chapters to the current generation request and surfaces a
// short excerpt from each as a voice anchor. Same fail-open contract as
// buildVoiceExemplars: returns "" on any error or when nothing qualifies.
export async function buildAuthorVoiceExemplars(
  projectId: string,
  currentChapterId: string | null | undefined,
  queryText: string
): Promise<string> {
  try {
    const emb = await generateEmbedding(queryText.slice(0, 2000));
    if (!emb) return "";

    const candidates = await db.query.chapters.findMany({
      where: and(
        eq(chapters.projectId, projectId),
        isNotNull(chapters.embedding),
        ...(currentChapterId ? [ne(chapters.id, currentChapterId)] : []),
      ),
    });

    const scored = candidates
      .filter(c => Array.isArray(c.embedding) && c.embedding.length > 0)
      .map(c => ({ c, s: cosineSimilarity(emb, c.embedding as number[]) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 2)
      .filter(x => x.s > 0.3);

    if (!scored.length) return "";

    const lines = scored.map(({ c }) => {
      const plain = toPlainText(c.content ?? "").trim();
      const excerpt = plain.length > EXCERPT_MAX_CHARS ? plain.slice(0, EXCERPT_MAX_CHARS).trimEnd() + "…" : plain;
      return `- From "${c.title}": ${excerpt}`;
    });

    return (
      "YOUR OWN VOICE (match the prose texture/rhythm of your own past writing below — do not repeat its plot):\n" +
      lines.join("\n")
    );
  } catch {
    return "";
  }
}
