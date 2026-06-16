// src/lib/guide/next-action.ts
import type { GenerationMode } from "@/lib/modes/registry";
import { isCreatorFormat } from "@/lib/formats";
import { tiptapToPlainText, isValidTipTapJson } from "@/lib/editor/content-migration";

export type GuideStage = "idea" | "structure" | "draft" | "polish" | "export";

export type GuideRunSpec = {
  mode: GenerationMode | "story_health" | "export";
  prompt?: string;
  chapterId?: string;
};

export type GuideAction = {
  id: string;
  stage: GuideStage;
  message: string;
  cta: string;
  run: GuideRunSpec;
};

export const STAGE_ORDER: readonly GuideStage[] = ["idea", "structure", "draft", "polish", "export"];

export interface GuideChapter {
  id: string;
  title: string;
  wordCount: number;
  sortOrder: number;
  content?: string;
}

export interface GuideProject {
  format: string;
  controllingIdea?: string;
  biggestChallenge?: string;
  characters: { id: string }[];
  chapters: GuideChapter[];
  dismissedGuideIds?: string[];
}

const REVIEW_THRESHOLD = 500;

/**
 * Returns the single next action the Guide bar should suggest, or null if
 * there's nothing to suggest (either the project is in a steady state, or
 * the one matching suggestion for the current state has been dismissed).
 */
export function nextAction(project: GuideProject): GuideAction | null {
  const action = computeAction(project);
  if (!action) return null;
  const dismissed = project.dismissedGuideIds ?? [];
  return dismissed.includes(action.id) ? null : action;
}

/**
 * Returns the project's current stage in the Idea -> Structure -> Draft ->
 * Polish -> Export ladder, independent of whether the matching Guide
 * suggestion has been dismissed. Used to render the writing room's stage
 * progress indicator.
 */
export function currentStage(project: GuideProject): GuideStage {
  return computeAction(project)?.stage ?? "draft";
}

function computeAction(project: GuideProject): GuideAction | null {
  if (!project.controllingIdea?.trim()) {
    const challengeLabel = project.biggestChallenge ?? "";
    const prompt = challengeLabel
      ? `Help me develop a story premise. My biggest challenge is: ${challengeLabel}. Give me a controlling idea that addresses this directly.`
      : "Help me develop a story premise and controlling idea for this project.";
    const message = challengeLabel
      ? `Let's tackle your challenge: "${challengeLabel}". Start with the premise.`
      : "Let's start with your story idea — tell me the premise and I'll help shape it.";
    return {
      id: "idea-premise",
      stage: "idea",
      message,
      cta: "Brainstorm premise",
      run: { mode: "brainstorm", prompt },
    };
  }

  if (project.characters.length === 0 && !isCreatorFormat(project.format)) {
    return {
      id: "idea-characters",
      stage: "idea",
      message: "You have a premise — now sketch your main characters.",
      cta: "Brainstorm characters",
      run: { mode: "brainstorm", prompt: `Suggest 3 main characters (name, role, core want and need) for this story: ${project.controllingIdea}` },
    };
  }

  const sortedChapters = [...project.chapters].sort((a, b) => a.sortOrder - b.sortOrder);
  const hasAnyDraft = sortedChapters.some((c) => {
    if (c.content) {
      const plain = isValidTipTapJson(c.content) ? tiptapToPlainText(JSON.parse(c.content)) : c.content;
      return plain.trim().length > 0;
    }
    return c.wordCount > 0;
  });

  if (!hasAnyDraft) {
    return {
      id: "structure-outline",
      stage: "structure",
      message: "Time to outline — map out your story's major beats.",
      cta: "Generate outline",
      run: { mode: "outline", prompt: `Create a chapter-by-chapter outline for this story: ${project.controllingIdea}` },
    };
  }

  const undrafted = sortedChapters.find((c) => c.wordCount === 0);
  if (undrafted) {
    return {
      id: `draft-chapter-${undrafted.id}`,
      stage: "draft",
      message: `Ready to draft "${undrafted.title}" — let's write the opening scene.`,
      cta: "Start writing",
      run: { mode: "write", prompt: `Write the opening scene for "${undrafted.title}".`, chapterId: undrafted.id },
    };
  }

  const dismissed = project.dismissedGuideIds ?? [];
  const longChapters = sortedChapters.filter((c) => c.wordCount >= REVIEW_THRESHOLD);
  if (longChapters.length > 0 && !dismissed.includes("polish-review-manuscript")) {
    return {
      id: "polish-review-manuscript",
      stage: "polish",
      message: `Your manuscript is ready for a story health check.`,
      cta: "Review story health",
      run: { mode: "story_health", chapterId: longChapters[0].id },
    };
  }

  const allLongEnough = sortedChapters.every((c) => c.wordCount >= REVIEW_THRESHOLD);
  if (allLongEnough) {
    return {
      id: "export-manuscript",
      stage: "export",
      message: `Your manuscript has ${sortedChapters.length} chapter${sortedChapters.length === 1 ? "" : "s"} — ready to export?`,
      cta: "Export manuscript",
      run: { mode: "export" },
    };
  }

  const last = sortedChapters[sortedChapters.length - 1];
  return {
    id: `keep-writing-${last.id}`,
    stage: "draft",
    message: `Keep going on "${last.title}" — ${last.wordCount} words so far.`,
    cta: "Continue writing",
    run: { mode: "write", prompt: "Continue this scene.", chapterId: last.id },
  };
}

/**
 * Picks which chapter Home's "Continue writing" button should deep-link to:
 * the Guide's currently suggested chapter if it targets one, otherwise the
 * first chapter by sort order.
 */
export function getContinueChapterId(chapters: GuideChapter[], action: GuideAction | null): string | null {
  if (action?.run.chapterId) return action.run.chapterId;
  const sorted = [...chapters].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted[0]?.id ?? null;
}
