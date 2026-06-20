// src/components/stages/PolishStageView.tsx
"use client";
import { useMemo } from "react";
import { useFeatureIsOn } from "@growthbook/growthbook-react";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import { nextAction, type GuideAction } from "@/lib/guide/next-action";
import type { QualityReview } from "@/components/panels/QualityReviewPanel";
import { isCreatorFormat } from "@/lib/formats";
import { RetentionEditPanel } from "@/components/panels/toolbar/tools/RetentionEditPanel";
import { CreatorSEOPanel } from "@/components/panels/toolbar/tools/CreatorSEOPanel";
import { FLAGS } from "@/lib/growthbook";
import { isValidTipTapJson, tiptapToPlainText } from "@/lib/editor/content-migration";
import { analyzeProseRhythm } from "@/lib/analysis/rhythm";

interface PolishStageViewProps {
  project: any;
  qualityReview: QualityReview | null;
  onGuideRun: (action: GuideAction) => void;
  onGuideDismiss: (id: string) => void;
  mode: string;
  content: string;
  updateProject: (fn: (p: any) => any) => void;
  setSavedMsg: (msg: string) => void;
  onUpgradeRequired: (feature: string) => void;
  onOpenActions: () => void;
}

export default function PolishStageView({ project, qualityReview, onGuideRun, onGuideDismiss, mode, content, updateProject, setSavedMsg, onUpgradeRequired, onOpenActions }: PolishStageViewProps) {
  const action = nextAction({
    format: project.format,
    controllingIdea: project.controllingIdea,
    characters: project.characters || [],
    chapters: project.chapters || [],
    dismissedGuideIds: project.dismissedGuideIds,
  }) ?? {
    id: "polish-review-manuscript",
    stage: "polish" as const,
    message: "Your manuscript is ready for a story health check.",
    cta: "Review story health",
    run: { mode: "story_health" as const },
  };
  const chapter = (project.chapters || []).find((c: any) => c.id === action.run.chapterId);

  const issueCount = qualityReview
    ? qualityReview.ruleViolations.length + qualityReview.knowledgeViolations.length + qualityReview.slopMarkers.length
    : 0;
  const topIssue = qualityReview?.ruleViolations[0] ?? qualityReview?.knowledgeViolations[0] ?? qualityReview?.slopMarkers[0];

  // quality_stack: deterministic, zero-cost rhythm signal — read-only, never
  // blocks or alters anything. Runs entirely client-side on the plain-text
  // chapter content (no LLM, no server round-trip).
  const qualityStackOn = useFeatureIsOn(FLAGS.qualityStack);
  const rhythm = useMemo(() => {
    if (!qualityStackOn || !content) return null;
    const plain = isValidTipTapJson(content) ? tiptapToPlainText(JSON.parse(content)) : content;
    if (!plain.trim()) return null;
    return analyzeProseRhythm(plain);
  }, [qualityStackOn, content]);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "32px 24px", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 560, width: "100%" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
          Polish
        </div>
        <p style={{ fontSize: 14, color: co.text, lineHeight: 1.6, marginBottom: 4 }}>
          {chapter ? <>&ldquo;{chapter.title}&rdquo; — {chapter.wordCount} words</> : "This chapter is ready for a story health check."}
        </p>

        <div style={{ padding: "16px 18px", borderRadius: 10, border: `1px solid ${co.border}`, background: co.surface, margin: "12px 0 16px" }}>
          {qualityReview ? (
            issueCount > 0 ? (
              <>
                <p style={{ fontSize: 13, color: co.text, lineHeight: 1.6, marginTop: 0, marginBottom: topIssue ? 8 : 0 }}>
                  {issueCount} potential issue{issueCount === 1 ? "" : "s"} flagged — signal: {qualityReview.overallSignal}.
                </p>
                {topIssue && (
                  <p style={{ fontSize: 12, color: co.muted, lineHeight: 1.6, margin: 0 }}>
                    {topIssue.text || topIssue.violation || topIssue.suggestion}
                  </p>
                )}
              </>
            ) : (
              <p style={{ fontSize: 13, color: co.text, lineHeight: 1.6, margin: 0 }}>
                No quality issues flagged — signal: {qualityReview.overallSignal}.
              </p>
            )
          ) : (
            <p style={{ fontSize: 13, color: co.muted, lineHeight: 1.6, margin: 0 }}>
              No quality issues flagged yet.
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button style={sBtn} onClick={() => onGuideRun(action)}>Open full story health report →</button>
          <button style={sBtnSm} onClick={() => onGuideDismiss(action.id)}>Mark as reviewed</button>
        </div>

        {rhythm && rhythm.flags.length > 0 && (
          <div style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${co.border}`, background: co.surface, margin: "12px 0 0" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
              Rhythm signal (read-only)
            </div>
            {rhythm.flags.map((f) => (
              <p key={f.label} style={{ fontSize: 12, color: co.muted, lineHeight: 1.5, margin: "0 0 4px" }}>
                <span style={{ color: co.text, fontWeight: 600 }}>{f.label}:</span> {f.detail}
              </p>
            ))}
          </div>
        )}

        {isCreatorFormat(project.format) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 16, paddingTop: 16, borderTop: `1px solid ${co.border}` }}>
            <RetentionEditPanel format={project.format} mode={mode} content={content} setSavedMsg={setSavedMsg} updateProject={updateProject} onUpgradeRequired={onUpgradeRequired} />
            <CreatorSEOPanel format={project.format} mode={mode} content={content} onUpgradeRequired={onUpgradeRequired} />
            <button style={sBtnSm} onClick={onOpenActions}>More →</button>
          </div>
        )}
      </div>
    </div>
  );
}
