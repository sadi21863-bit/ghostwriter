// src/lib/guide/__tests__/next-action.test.ts
import { describe, it, expect } from "vitest";
import { nextAction, currentStage, getContinueChapterId, STAGE_ORDER, type GuideProject, type GuideChapter } from "../next-action";

const base: GuideProject = {
  format: "Novel",
  controllingIdea: "",
  characters: [],
  chapters: [],
  dismissedGuideIds: [],
};

describe("nextAction", () => {
  it("suggests brainstorming a premise when controllingIdea is empty", () => {
    const action = nextAction(base);
    expect(action?.id).toBe("idea-premise");
    expect(action?.stage).toBe("idea");
    expect(action?.run.mode).toBe("brainstorm");
  });

  it("suggests brainstorming characters once a premise exists but no characters", () => {
    const action = nextAction({ ...base, controllingIdea: "A thief discovers her mark is her sister." });
    expect(action?.id).toBe("idea-characters");
    expect(action?.run.mode).toBe("brainstorm");
    expect(action?.run.prompt).toContain("A thief discovers her mark is her sister.");
  });

  it("skips the characters check for creator-format projects and goes straight to outlining", () => {
    const action = nextAction({
      ...base,
      format: "YouTube Long-form",
      controllingIdea: "A productivity channel premise.",
      characters: [],
      chapters: [{ id: "ch-1", title: "Chapter 1", wordCount: 0, sortOrder: 0 }],
    });
    expect(action?.id).toBe("structure-outline");
    expect(action?.stage).toBe("structure");
  });

  it("still requires characters for non-creator formats with the same premise", () => {
    const action = nextAction({
      ...base,
      format: "Novel",
      controllingIdea: "A productivity channel premise.",
      characters: [],
      chapters: [{ id: "ch-1", title: "Chapter 1", wordCount: 0, sortOrder: 0 }],
    });
    expect(action?.id).toBe("idea-characters");
    expect(action?.stage).toBe("idea");
  });

  it("suggests outlining once characters exist but no chapter has a draft", () => {
    const action = nextAction({
      ...base,
      controllingIdea: "Premise.",
      characters: [{ id: "char-1" }],
      chapters: [{ id: "ch-1", title: "Chapter 1", wordCount: 0, sortOrder: 0 }],
    });
    expect(action?.id).toBe("structure-outline");
    expect(action?.run.mode).toBe("outline");
  });

  it("suggests drafting the earliest empty chapter once at least one chapter has content", () => {
    const action = nextAction({
      ...base,
      controllingIdea: "Premise.",
      characters: [{ id: "char-1" }],
      chapters: [
        { id: "ch-1", title: "Chapter 1", wordCount: 800, sortOrder: 0 },
        { id: "ch-2", title: "Chapter 2", wordCount: 0, sortOrder: 1 },
        { id: "ch-3", title: "Chapter 3", wordCount: 0, sortOrder: 2 },
      ],
    });
    expect(action?.id).toBe("draft-chapter-ch-2");
    expect(action?.run.mode).toBe("write");
    expect(action?.run.chapterId).toBe("ch-2");
  });

  it("suggests a story health review once the first chapter crosses the threshold", () => {
    const action = nextAction({
      ...base,
      controllingIdea: "Premise.",
      characters: [{ id: "char-1" }],
      chapters: [
        { id: "ch-1", title: "Chapter 1", wordCount: 600, sortOrder: 0 },
        { id: "ch-2", title: "Chapter 2", wordCount: 100, sortOrder: 1 },
      ],
    });
    expect(action?.id).toBe("polish-review-manuscript");
    expect(action?.run.mode).toBe("story_health");
    expect(action?.run.chapterId).toBe("ch-1");
  });

  it("suggests continuing the last chapter when nothing has crossed the review threshold and none are empty", () => {
    const action = nextAction({
      ...base,
      controllingIdea: "Premise.",
      characters: [{ id: "char-1" }],
      chapters: [
        { id: "ch-1", title: "Chapter 1", wordCount: 200, sortOrder: 0 },
        { id: "ch-2", title: "Chapter 2", wordCount: 150, sortOrder: 1 },
      ],
    });
    expect(action?.id).toBe("keep-writing-ch-2");
    expect(action?.run.chapterId).toBe("ch-2");
  });

  it("suggests exporting once all chapters are past the threshold and the review is dismissed", () => {
    const action = nextAction({
      ...base,
      controllingIdea: "Premise.",
      characters: [{ id: "char-1" }],
      chapters: [
        { id: "ch-1", title: "Chapter 1", wordCount: 600, sortOrder: 0 },
        { id: "ch-2", title: "Chapter 2", wordCount: 700, sortOrder: 1 },
      ],
      dismissedGuideIds: ["polish-review-manuscript"],
    });
    expect(action?.id).toBe("export-manuscript");
    expect(action?.run.mode).toBe("export");
  });

  it("suggests a story health review for short-form creator content well below the novel threshold", () => {
    const action = nextAction({
      ...base,
      format: "TikTok Native",
      controllingIdea: "Premise.",
      characters: [],
      chapters: [
        { id: "ch-1", title: "Beat 1", wordCount: 120, sortOrder: 0 },
      ],
    });
    expect(action?.id).toBe("polish-review-manuscript");
    expect(action?.run.chapterId).toBe("ch-1");
  });

  it("suggests exporting once all creator-format beats are past the creator threshold and the review is dismissed", () => {
    const action = nextAction({
      ...base,
      format: "Instagram Reel",
      controllingIdea: "Premise.",
      characters: [],
      chapters: [
        { id: "ch-1", title: "Beat 1", wordCount: 140, sortOrder: 0 },
      ],
      dismissedGuideIds: ["polish-review-manuscript"],
    });
    expect(action?.id).toBe("export-manuscript");
  });

  it("does not yet suggest review for creator-format content still below even the lower creator threshold", () => {
    const action = nextAction({
      ...base,
      format: "TikTok Script",
      controllingIdea: "Premise.",
      characters: [],
      chapters: [
        { id: "ch-1", title: "Beat 1", wordCount: 40, sortOrder: 0 },
      ],
    });
    expect(action?.id).toBe("keep-writing-ch-1");
  });

  it("returns null once the current suggestion has been dismissed and state hasn't changed", () => {
    const action = nextAction({ ...base, dismissedGuideIds: ["idea-premise"] });
    expect(action).toBeNull();
  });

  it("falls back to a keep-writing suggestion once export-manuscript has been dismissed, instead of dead-ending into null", () => {
    // Dismissing "ready to export?" means the writer wants to keep going, not
    // that the Guide should have nothing left to suggest (see docs/gotchas.md
    // "Continuous-Drafting Momentum"). This intentionally changed behavior —
    // it used to return null here.
    const action = nextAction({
      ...base,
      controllingIdea: "Premise.",
      characters: [{ id: "char-1" }],
      chapters: [
        { id: "ch-1", title: "Chapter 1", wordCount: 600, sortOrder: 0 },
      ],
      dismissedGuideIds: ["polish-review-manuscript", "export-manuscript"],
    });
    expect(action?.id).toBe("keep-writing-ch-1");
    expect(action?.stage).toBe("draft");
  });
});

describe("currentStage", () => {
  it("returns 'idea' when there is no controlling idea", () => {
    expect(currentStage(base)).toBe("idea");
  });

  it("falls back to 'draft' once export-manuscript has been dismissed, instead of freezing on 'export' with no suggestion", () => {
    // Previously this stayed pinned on "export" forever once dismissed, even
    // though nextAction() had already gone null — a confusing combination
    // (stage pill says Export, but there's nothing to do). Now that
    // dismissing export falls back to a real keep-writing suggestion, the
    // stage indicator correctly reflects that too.
    const project: GuideProject = {
      ...base,
      controllingIdea: "Premise.",
      characters: [{ id: "char-1" }],
      chapters: [{ id: "ch-1", title: "Chapter 1", wordCount: 600, sortOrder: 0 }],
      dismissedGuideIds: ["polish-review-manuscript", "export-manuscript"],
    };
    expect(nextAction(project)?.id).toBe("keep-writing-ch-1");
    expect(currentStage(project)).toBe("draft");
  });

  it("matches the expected stage order", () => {
    expect(STAGE_ORDER).toEqual(["idea", "structure", "draft", "polish", "export"]);
  });
});

describe("getContinueChapterId", () => {
  const chapters: GuideChapter[] = [
    { id: "ch-2", title: "Chapter 2", wordCount: 0, sortOrder: 1 },
    { id: "ch-1", title: "Chapter 1", wordCount: 600, sortOrder: 0 },
  ];

  it("returns the action's chapterId when the Guide's suggestion targets a chapter", () => {
    const action = nextAction({
      format: "Novel",
      controllingIdea: "Premise.",
      characters: [{ id: "char-1" }],
      chapters,
      dismissedGuideIds: [],
    });
    expect(action?.run.chapterId).toBe("ch-2");
    expect(getContinueChapterId(chapters, action)).toBe("ch-2");
  });

  it("falls back to the first chapter by sortOrder when the action has no chapterId", () => {
    const action = nextAction({
      format: "Novel",
      controllingIdea: "",
      characters: [],
      chapters,
      dismissedGuideIds: [],
    });
    expect(action?.run.chapterId).toBeUndefined();
    expect(getContinueChapterId(chapters, action)).toBe("ch-1");
  });

  it("falls back to the first chapter by sortOrder when there is no action", () => {
    expect(getContinueChapterId(chapters, null)).toBe("ch-1");
  });

  it("returns null when there are no chapters and no action chapterId", () => {
    expect(getContinueChapterId([], null)).toBeNull();
  });
});
