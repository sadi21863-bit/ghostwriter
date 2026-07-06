// src/components/stages/PolishStageView.tsx
"use client";
import { useMemo } from "react";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import { nextAction, type GuideAction } from "@/lib/guide/next-action";
import type { QualityReview } from "@/components/panels/QualityReviewPanel";
import { isCreatorFormat } from "@/lib/formats";
import { RetentionEditPanel } from "@/components/panels/toolbar/tools/RetentionEditPanel";
import { CreatorSEOPanel } from "@/components/panels/toolbar/tools/CreatorSEOPanel";
import { isValidTipTapJson, tiptapToPlainText } from "@/lib/editor/content-migration";
import { analyzeProseRhythm } from "@/lib/analysis/rhythm";
import { analyzeHumanize } from "@/lib/analysis/humanize";
import { voiceLockStatus } from "@/lib/ai/voice-lock";
import EditorNotesPanel from "@/components/EditorNotesPanel";
import { isStoryFormat } from "@/lib/formats";

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

  // Deterministic, zero-cost rhythm signal — read-only, never blocks or alters
  // anything, runs entirely client-side on the plain-text chapter content (no
  // LLM, no server round-trip). Part of the free default-on subset confirmed
  // by the 2026-06-21 panel eval — unconditional, no flag (see growthbook.ts).
  const rhythm = useMemo(() => {
    if (!content) return null;
    const plain = isValidTipTapJson(content) ? tiptapToPlainText(JSON.parse(content)) : content;
    if (!plain.trim()) return null;
    return analyzeProseRhythm(plain);
  }, [content]);

  // Second-opinion deterministic "humanize" signal — same zero-cost, no-LLM,
  // read-only convention as the rhythm signal above, but a different pattern set
  // (assistant-voice breaks, named-emotion-without-body, formal AI constructions,
  // generic wrap-ups) extracted from conorbronsdon/avoid-ai-writing's approach.
  // See src/lib/analysis/humanize.ts for the full provenance note.
  const humanize = useMemo(() => {
    if (!content) return null;
    const plain = isValidTipTapJson(content) ? tiptapToPlainText(JSON.parse(content)) : content;
    if (!plain.trim()) return null;
    return analyzeHumanize(plain);
  }, [content]);

  // "Lock Voice" lever — surfaces the (already-automatic) voice fingerprint as a
  // visible status chip, computed from all chapters' plain text. Zero cost.
  const voice = useMemo(() => {
    const texts = (project.chapters || []).map((c: any) => {
      const raw = c.content || "";
      return isValidTipTapJson(raw) ? tiptapToPlainText(JSON.parse(raw)) : raw;
    });
    return voiceLockStatus(texts);
  }, [project.chapters]);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "32px 24px", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 560, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1.5 }}>
            Polish
          </div>
          <span title={voice.detail} style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, cursor: "default", background: voice.ready ? co.accentBg : "transparent", color: voice.ready ? co.accent : co.muted, border: `1px solid ${voice.ready ? co.accent : co.border}` }}>
            {voice.label}
          </span>
        </div>
        {isStoryFormat(project.format) && <EditorNotesPanel project={project} updateProject={updateProject} />}
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

        {humanize && humanize.flags.length > 0 && (
          <div style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${co.border}`, background: co.surface, margin: "12px 0 0" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
              Humanize signal (read-only) — {humanize.label} ({humanize.score}/100)
            </div>
            {humanize.flags.map((f) => (
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
