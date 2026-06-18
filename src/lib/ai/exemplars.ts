import { db } from "@/db";
import { workPackets } from "@/db/schema";
import { or, isNull, eq } from "drizzle-orm";
import { generateEmbedding, cosineSimilarity } from "@/lib/ai/embeddings";

// Style-Exemplar retrieval (P1): reuse the user's analyzed craft references
// (work_packets, pgvector embeddings) as VOICE ANCHORS, retrieved by semantic
// similarity to the current scene request. Anchors the prose to a target craft
// sensibility instead of generic LLM voice. Lives in the DYNAMIC context block.
// Cost: one cheap embedding call (text-embedding-3-small); fail-open (returns ""
// if OPENAI_API_KEY is absent or nothing relevant is found).
export async function buildVoiceExemplars(userId: string, queryText: string): Promise<string> {
  try {
    const emb = await generateEmbedding(queryText.slice(0, 2000));
    if (!emb) return "";
    const packets = await db.query.workPackets.findMany({
      where: or(isNull(workPackets.userId), eq(workPackets.userId, userId)),
    });
    const scored = packets
      .filter((p) => Array.isArray((p as any).embedding) && (p as any).embedding.length > 0)
      .map((p) => ({ p, s: cosineSimilarity(emb, (p as any).embedding) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 2)
      .filter((x) => x.s > 0.2);
    if (!scored.length) return "";
    const lines = scored.map(({ p }) => {
      const notes = [(p as any).thematicCore, (p as any).structuralNotes, (p as any).dialogueNotes]
        .filter(Boolean)
        .join(" — ");
      return `- "${(p as any).title}"${(p as any).creator ? ` (${(p as any).creator})` : ""}: ${notes.slice(0, 240)}`;
    });
    return (
      "VOICE & CRAFT EXEMPLARS (match this texture and craft sensibility — do NOT copy their content or name these works):\n" +
      lines.join("\n")
    );
  } catch {
    return "";
  }
}
