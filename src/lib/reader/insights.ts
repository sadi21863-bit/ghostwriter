// Reader Insights — turn the (already-collected) reader sessions + reactions into
// author-facing signal. Pure aggregation so it's unit-testable; the endpoint feeds
// it DB rows and the panel renders the result. Closes the "share link only, no
// author-facing insights" gap from the underused-features audit.

export interface ReaderInsightsInput {
  sessions: { id: string }[];
  reactions: { chapterId: string; reactionType: string }[];
  chapters: { id: string; title: string; sortOrder?: number | null }[];
}

export interface ChapterInsight {
  chapterId: string;
  title: string;
  reactions: number;
  byType: Record<string, number>;
}

export interface ReaderInsights {
  totalSessions: number;
  totalReactions: number;
  reactionTypeTotals: Record<string, number>;
  byChapter: ChapterInsight[];        // in chapter order
  hottestChapterId: string | null;    // most-reacted chapter
  coldChapters: { chapterId: string; title: string }[]; // chapters with zero reactions
}

export function buildReaderInsights(input: ReaderInsightsInput): ReaderInsights {
  const { sessions, reactions, chapters } = input;
  const ordered = [...chapters].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const perChapter = new Map<string, ChapterInsight>();
  for (const ch of ordered) perChapter.set(ch.id, { chapterId: ch.id, title: ch.title, reactions: 0, byType: {} });

  const reactionTypeTotals: Record<string, number> = {};
  for (const r of reactions) {
    reactionTypeTotals[r.reactionType] = (reactionTypeTotals[r.reactionType] ?? 0) + 1;
    const ci = perChapter.get(r.chapterId);
    if (!ci) continue; // reaction on a deleted chapter — ignore
    ci.reactions++;
    ci.byType[r.reactionType] = (ci.byType[r.reactionType] ?? 0) + 1;
  }

  const byChapter = ordered.map(ch => perChapter.get(ch.id)!);
  let hottestChapterId: string | null = null;
  let max = 0;
  for (const ci of byChapter) {
    if (ci.reactions > max) { max = ci.reactions; hottestChapterId = ci.chapterId; }
  }
  const coldChapters = byChapter.filter(ci => ci.reactions === 0).map(ci => ({ chapterId: ci.chapterId, title: ci.title }));

  return {
    totalSessions: sessions.length,
    totalReactions: reactions.length,
    reactionTypeTotals,
    byChapter,
    hottestChapterId,
    coldChapters,
  };
}
