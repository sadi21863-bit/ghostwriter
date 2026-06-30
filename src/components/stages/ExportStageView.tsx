// src/components/stages/ExportStageView.tsx
"use client";
import { useState } from "react";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import { type GuideAction } from "@/lib/guide/next-action";
import { isStoryFormat } from "@/lib/formats";
import { AdaptPanel } from "@/components/AdaptPanel";
import { chapterApprovalSummary } from "@/lib/editor/approval";
import ReaderInsightsPanel from "@/components/ReaderInsightsPanel";

interface ExportStageViewProps {
  project: any;
  onGuideRun: (action: GuideAction) => void;
  onOpenProductionStudio: () => void;
  onOpenComicStudio: () => void;
}

// The Export stage's CTA must always open export — it is not a guide
// suggestion to follow, unlike the GuideBar's ladder-driven prompts. Do not
// route this through nextAction(): that returns whatever rung of the
// idea->structure->draft->polish->export ladder still applies (e.g. a
// story-health check, or "keep writing chapter X"), which previously caused
// this button to open Story Health or jump to a different chapter instead
// of exporting.
const EXPORT_ACTION: GuideAction = {
  id: "export-manuscript",
  stage: "export",
  message: "",
  cta: "Export manuscript",
  run: { mode: "export" },
};

export default function ExportStageView({ project, onGuideRun, onOpenProductionStudio, onOpenComicStudio }: ExportStageViewProps) {
  const [adaptOpen, setAdaptOpen] = useState(false);
  const chapters = project.chapters || [];
  const totalWords = chapters.reduce((sum: number, c: any) => sum + (c.wordCount || 0), 0);
  // Soft approve-gate: warn (don't block) before launching paid media generation
  // on chapters the Editor hasn't approved. The hard gate folds into #5.
  const approval = chapterApprovalSummary(chapters.map((c: any) => ({ title: c.title, reviewStatus: c.reviewStatus })));
  const showApprovalNudge = isStoryFormat(project.format) && approval.total > 0 && !approval.allApproved;

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "32px 24px", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 560, width: "100%" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
          Export
        </div>
        <p style={{ fontSize: 16, color: co.text, lineHeight: 1.6, marginBottom: 4 }}>
          🎉 Your draft is complete.
        </p>
        <p style={{ fontSize: 13, color: co.muted, lineHeight: 1.6, marginBottom: 16 }}>
          {chapters.length} chapter{chapters.length === 1 ? "" : "s"}, {totalWords.toLocaleString()} words total. Export it, adapt it into another format, or start your next story.
        </p>

        {isStoryFormat(project.format) && <ReaderInsightsPanel project={project} />}
        {showApprovalNudge && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: 8, background: `${co.orange}14`, border: `1px solid ${co.orange}40`, marginBottom: 12, fontSize: 12, color: co.text }}>
            <span>⚠️</span>
            <span>
              {approval.unapproved.length} of {approval.total} chapter{approval.total === 1 ? "" : "s"} not yet Editor-approved
              ({approval.unapproved.slice(0, 3).join(", ")}{approval.unapproved.length > 3 ? "…" : ""}).
              Review in the Editor panel (Polish) before generating comics or video — you can still proceed if you want.
            </span>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={sBtn} onClick={() => onGuideRun(EXPORT_ACTION)}>Open Export →</button>
          {project.isHiggsfieldProject && (
            <button style={sBtnSm} onClick={onOpenProductionStudio}>Open Production Studio →</button>
          )}
          {isStoryFormat(project.format) && (
            <button style={sBtnSm} onClick={onOpenComicStudio}>🎨 Open Comic Studio →</button>
          )}
          {isStoryFormat(project.format) && (
            <button style={sBtnSm} onClick={() => setAdaptOpen(true)}>🎭 Adapt this story →</button>
          )}
          <a href="/dashboard" style={{ ...sBtnSm, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>+ Start your next story →</a>
        </div>
      </div>
      {adaptOpen && <AdaptPanel project={project} onClose={() => setAdaptOpen(false)} />}
    </div>
  );
}
