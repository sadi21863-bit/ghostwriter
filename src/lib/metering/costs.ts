export const OPERATION_CREDITS: Record<string, number> = {
  "generate":          1.0,
  "braindump":         1.0,
  "analyze-passage":   0.5,
  "quick-start":       2.0,
  "trend-youtube":     0.3, "trend-niche": 0.3, "trend-instagram": 0.3, "trend-angles": 0.3,
  "title-hook":        0.2, "score-hook": 0.2, "hook-ab": 0.2, "thumbnail-concepts": 0.3,
  "virality-predict":  0.3, "series-plan": 0.4, "guest-intel": 0.3, "retention-edit": 0.4,
  "repurpose":         0.3, "creator-seo": 0.2, "creator-research": 0.5, "channel-autopsy": 0.4,
  "tiktok-native":     0.3,
  "dissect-video":     1.5,
  "entity":            0.1, "suggest": 0.1, "summarize": 0.2,
  "adapt-chapter":     1.0,
  "refine":            0.5,
  // Previously unmetered (2026-07-05 route-consolidation audit) — director/editor/writer
  // tools that called the model with no meterAndGate/refundCredits at all.
  "tension-curve":       0.4, "arc-heatmap": 0.4, "villain-pov": 0.5,
  "generate-package":    0.6, "beat-sheet": 0.5,
  "knowledge-audit":     0.5, "transportation-check": 0.4,
  "alt-draft":           1.0,
};

export const DEFAULT_OPERATION_CREDIT = 0.3;

export function creditsFor(operation: string): number {
  return OPERATION_CREDITS[operation] ?? DEFAULT_OPERATION_CREDIT;
}

export const MAX_PROJECTS: Record<string, number> = {
  free:        3,
  story_pro:   -1,
  creator_pro: -1,
  all_access:  -1,
};
