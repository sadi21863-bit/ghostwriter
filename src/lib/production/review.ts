// Pure helpers for the Phase C review UI (docs/2026-06-25-ai-director-editor-
// production-studio-gap-analysis.md). Kept out of the React components so the
// score→color mapping and review-state labels are unit-testable without a DOM.

export type ReviewStatus = "draft" | "approved" | "needs_rework";

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  needs_rework: "Needs Rework",
};

/** Traffic-light color for a Phase B vision-critic overall score (0-1). Null/undefined
 * (not yet scored) returns null so the caller can omit the pill entirely. */
export function qualityScoreColor(score: number | null | undefined): string | null {
  if (score == null) return null;
  if (score >= 0.7) return "#22c55e";
  if (score >= 0.4) return "#f59e0b";
  return "#ef4444";
}

/** Humanize a camelCase EvalDimensions key ("characterConsistency") into a label
 * ("Character Consistency") for the quality pill's tooltip/subtext. */
export function formatWeakestDimension(weakest: string | null | undefined): string | null {
  if (!weakest) return null;
  const spaced = weakest.replace(/([A-Z])/g, " $1");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
