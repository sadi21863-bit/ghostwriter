// Shared helper for the soft approve-gate. A chapter counts as approved only
// when reviewStatus === "approved"; anything else (draft/in_review/missing) is
// unapproved. Produce surfaces use this to warn before paid generation.
export interface ChapterApprovalInput {
  title: string;
  reviewStatus?: string | null;
}

export interface ChapterApprovalSummary {
  total: number;
  approved: number;
  unapproved: string[];
  allApproved: boolean;
}

export function chapterApprovalSummary(chapters: ChapterApprovalInput[]): ChapterApprovalSummary {
  const total = chapters.length;
  const unapproved = chapters.filter(c => c.reviewStatus !== "approved").map(c => c.title);
  const approved = total - unapproved.length;
  return { total, approved, unapproved, allApproved: total > 0 && unapproved.length === 0 };
}
