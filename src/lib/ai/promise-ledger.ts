import { db } from "@/db";
import { storyMemories } from "@/db/schema";
import { eq } from "drizzle-orm";

// Reader-Promise Ledger (P1): aggregate unresolved story promises from continuity
// memory and feed them back to the writer so long threads aren't dropped or resolved
// prematurely. DB-only — no LLM cost. Lives in the DYNAMIC context block.
export async function buildPromiseLedger(projectId: string): Promise<string> {
  try {
    const memories = await db.query.storyMemories.findMany({
      where: eq(storyMemories.projectId, projectId),
      orderBy: (m, { asc }) => [asc(m.chapterIndex)],
    });
    const created: string[] = [];
    const resolved: string[] = [];
    for (const m of memories) {
      const sd = (m as any).structuredData || {};
      (sd.openPromisesCreated || []).forEach((p: string) => { if (p?.trim()) created.push(p.trim()); });
      (sd.openPromisesResolved || []).forEach((p: string) => { if (p?.trim()) resolved.push(p.trim()); });
    }
    // Unresolved = created promises not fuzzily matched by any resolution.
    const open = created.filter(
      (p) => !resolved.some((r) => r && (r.includes(p) || p.includes(r))),
    );
    // De-dupe, keep the 8 most recent.
    const uniq = [...new Set(open)].slice(-8);
    if (!uniq.length) return "";
    return (
      "OPEN STORY PROMISES (honor these threads — advance or deepen them; do NOT resolve prematurely or let them vanish):\n" +
      uniq.map((p) => `- ${p}`).join("\n")
    );
  } catch {
    return "";
  }
}
