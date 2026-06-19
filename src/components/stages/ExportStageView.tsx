// src/components/stages/ExportStageView.tsx
"use client";
import { useState } from "react";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import { nextAction, type GuideAction } from "@/lib/guide/next-action";
import { isStoryFormat } from "@/lib/formats";
import { AdaptPanel } from "@/components/AdaptPanel";

interface ExportStageViewProps {
  project: any;
  onGuideRun: (action: GuideAction) => void;
  onOpenProductionStudio: () => void;
  onOpenComicStudio: () => void;
}

export default function ExportStageView({ project, onGuideRun, onOpenProductionStudio, onOpenComicStudio }: ExportStageViewProps) {
  const [adaptOpen, setAdaptOpen] = useState(false);
  const action: GuideAction = nextAction({
    format: project.format,
    controllingIdea: project.controllingIdea,
    characters: project.characters || [],
    chapters: project.chapters || [],
    dismissedGuideIds: project.dismissedGuideIds,
  }) ?? {
    id: "export-manuscript",
    stage: "export",
    message: "",
    cta: "Export manuscript",
    run: { mode: "export" },
  };
  const chapters = project.chapters || [];
  const totalWords = chapters.reduce((sum: number, c: any) => sum + (c.wordCount || 0), 0);

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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={sBtn} onClick={() => onGuideRun(action)}>Open Export →</button>
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
