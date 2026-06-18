// src/components/stages/PolishStageView.tsx
"use client";
import { useState } from "react";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import { nextAction, type GuideAction } from "@/lib/guide/next-action";
import type { QualityReview } from "@/components/panels/QualityReviewPanel";
import { isCreatorFormat } from "@/lib/formats";
import { plainTextToTipTap } from "@/lib/editor/content-migration";
import { RetentionEditPanel } from "@/components/panels/toolbar/tools/RetentionEditPanel";
import { CreatorSEOPanel } from "@/components/panels/toolbar/tools/CreatorSEOPanel";

interface PolishStageViewProps {
  project: any;
  qualityReview: QualityReview | null;
  onGuideRun: (action: GuideAction) => void;
  onGuideDismiss: (id: string) => void;
  mode: string;
  content: string;
  activeChapId?: string;
  updateChapter?: (field: string, value: any) => void;
  updateProject: (fn: (p: any) => any) => void;
  setSavedMsg: (msg: string) => void;
  onUpgradeRequired: (feature: string) => void;
  onOpenActions: () => void;
}

// Extract plain text from a TipTap JSON document for the refine pass.
function tipTapToText(raw: string): string {
  if (!raw) return "";
  try {
    const doc = JSON.parse(raw);
    const walk = (n: any): string => {
      if (!n) return "";
      if (n.type === "text") return n.text || "";
      const children = (n.content || []).map(walk).join("");
      if (n.type === "paragraph" || n.type === "heading") return children + "\n\n";
      if (n.type === "hardBreak") return "\n";
      return children;
    };
    return (doc.content || []).map(walk).join("").trim();
  } catch {
    return raw;
  }
}

export default function PolishStageView({ project, qualityReview, onGuideRun, onGuideDismiss, mode, content, activeChapId, updateChapter, updateProject, setSavedMsg, onUpgradeRequired, onOpenActions }: PolishStageViewProps) {
  const [polishing, setPolishing] = useState(false);
  const [prevContent, setPrevContent] = useState<string | null>(null);

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

  const runPolish = async () => {
    const text = tipTapToText(content || "");
    if (text.trim().length < 40) { setSavedMsg("Write a bit more before polishing."); return; }
    setPolishing(true);
    try {
      const res = await fetch("/api/ai/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, format: project.format, projectId: project.id, chapterId: activeChapId }),
      });
      const data = await res.json();
      if (data.error) {
        if (data.error === "upgrade_required") onUpgradeRequired?.(data.feature);
        else setSavedMsg(data.error);
      } else if (data.text && updateChapter) {
        setPrevContent(content);
        updateChapter("content", JSON.stringify(plainTextToTipTap(data.text)));
        setSavedMsg("Polished — clichés, filler & repetition cleaned. Plot & voice preserved.");
      }
    } catch {
      setSavedMsg("Polish failed. Please try again.");
    } finally {
      setPolishing(false);
    }
  };

  const revert = () => {
    if (prevContent != null && updateChapter) {
      updateChapter("content", prevContent);
      setPrevContent(null);
      setSavedMsg("Reverted to the pre-polish version.");
    }
  };

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

        {/* Anti-slop critic-editor: rewrites the chapter to remove AI-slop while preserving plot & voice. */}
        {!isCreatorFormat(project.format) && (
          <div style={{ padding: "16px 18px", borderRadius: 10, border: `1px solid ${co.border}`, background: co.surface, marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: co.text, margin: "0 0 4px" }}>One-click prose polish</p>
            <p style={{ fontSize: 12, color: co.muted, lineHeight: 1.6, margin: "0 0 12px" }}>
              A line-edit pass that strips clichés, filler transitions, vague emotion, repetition and forced metaphor — without changing your plot, facts, or voice.
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button style={{ ...sBtn, opacity: polishing ? 0.6 : 1 }} disabled={polishing} onClick={runPolish} data-testid="polish-prose-btn">
                {polishing ? "Polishing…" : "Polish this chapter"}
              </button>
              {prevContent != null && (
                <button style={sBtnSm} onClick={revert} data-testid="polish-revert-btn">Revert</button>
              )}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button style={sBtn} onClick={() => onGuideRun(action)}>Open full story health report →</button>
          <button style={sBtnSm} onClick={() => onGuideDismiss(action.id)}>Mark as reviewed</button>
        </div>

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
