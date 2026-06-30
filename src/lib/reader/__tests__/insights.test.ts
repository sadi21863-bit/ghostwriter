import { describe, it, expect } from "vitest";
import { buildReaderInsights } from "../insights";

const chapters = [
  { id: "c1", title: "One", sortOrder: 0 },
  { id: "c2", title: "Two", sortOrder: 1 },
  { id: "c3", title: "Three", sortOrder: 2 },
];

describe("buildReaderInsights", () => {
  it("counts sessions, reactions, and per-type totals", () => {
    const out = buildReaderInsights({
      sessions: [{ id: "s1" }, { id: "s2" }],
      reactions: [
        { chapterId: "c1", reactionType: "love" },
        { chapterId: "c1", reactionType: "love" },
        { chapterId: "c2", reactionType: "confused" },
      ],
      chapters,
    });
    expect(out.totalSessions).toBe(2);
    expect(out.totalReactions).toBe(3);
    expect(out.reactionTypeTotals).toEqual({ love: 2, confused: 1 });
  });

  it("orders chapters by sortOrder and tallies per-chapter reactions/types", () => {
    const out = buildReaderInsights({
      sessions: [],
      reactions: [
        { chapterId: "c2", reactionType: "love" },
        { chapterId: "c1", reactionType: "wow" },
        { chapterId: "c1", reactionType: "love" },
      ],
      chapters,
    });
    expect(out.byChapter.map(c => c.chapterId)).toEqual(["c1", "c2", "c3"]);
    expect(out.byChapter[0]).toMatchObject({ reactions: 2, byType: { wow: 1, love: 1 } });
  });

  it("identifies the hottest chapter and the cold (zero-reaction) ones", () => {
    const out = buildReaderInsights({
      sessions: [],
      reactions: [
        { chapterId: "c2", reactionType: "love" },
        { chapterId: "c2", reactionType: "love" },
        { chapterId: "c1", reactionType: "love" },
      ],
      chapters,
    });
    expect(out.hottestChapterId).toBe("c2");
    expect(out.coldChapters.map(c => c.chapterId)).toEqual(["c3"]);
  });

  it("ignores reactions on chapters that no longer exist", () => {
    const out = buildReaderInsights({
      sessions: [],
      reactions: [{ chapterId: "deleted", reactionType: "love" }],
      chapters,
    });
    expect(out.totalReactions).toBe(1); // still counted in the global total
    expect(out.byChapter.every(c => c.reactions === 0)).toBe(true); // but not attributed
  });

  it("handles an empty project", () => {
    const out = buildReaderInsights({ sessions: [], reactions: [], chapters: [] });
    expect(out.hottestChapterId).toBeNull();
    expect(out.byChapter).toEqual([]);
  });
});
