"use client";
import { useEffect, useMemo, useState } from "react";
import { ChapterEditor } from "@/components/editor/ChapterEditor";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import { getChapterLabel, isCreatorFormat } from "@/lib/formats";
import { currentStage, STAGE_ORDER, type GuideStage, type GuideAction } from "@/lib/guide/next-action";
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";
import { getVisibleModes, filterModesByQuery } from "@/lib/modes/slash-menu";
import { LIBRARY_MODES, classifyBeat } from "@/lib/modes/classify";
import BeatDetectionChip from "@/components/BeatDetectionChip";
import SlashMenu from "@/components/SlashMenu";
import IdeaStageView from "@/components/stages/IdeaStageView";
import StructureStageView from "@/components/stages/StructureStageView";
import PolishStageView from "@/components/stages/PolishStageView";
import ExportStageView from "@/components/stages/ExportStageView";
import { TikTokNativePanel } from "@/components/panels/toolbar/tools/TikTokNativePanel";
import { RepurposePanel } from "@/components/panels/toolbar/tools/RepurposePanel";
import { ResearchScaffoldPanel } from "@/components/panels/toolbar/tools/ResearchScaffoldPanel";
import type { QualityReview } from "@/components/panels/QualityReviewPanel";

const STAGE_LABELS: Record<GuideStage, string> = {
  idea: "Idea",
  structure: "Structure",
  draft: "Draft",
  polish: "Polish",
  export: "Export",
};

const CREATOR_STAGE_LABELS: Record<GuideStage, string> = {
  idea: "Angle",
  structure: "Outline/Hooks",
  draft: "Script",
  polish: "Retention edit",
  export: "Publish pack",
};

interface WritingRoomProps {
  project: any;
  activeChap: any;
  updateProject: (fn: (p: any) => any) => void;
  updateChapter: (field: string, value: any) => void;
  generating: boolean;
  generate: () => Promise<void>;
  onOpenBible: () => void;
  onOpenActions: () => void;
  prompt: string;
  setPrompt: (value: string) => void;
  onSelectMode: (mode: GenerationMode) => void;
  onGuideRun: (action: GuideAction) => void;
  onGuideDismiss: (id: string) => void;
  qualityReview: QualityReview | null;
  onOpenProductionStudio: () => void;
  mode: string;
  setSavedMsg: (msg: string) => void;
  onUpgradeRequired: (feature: string) => void;
}

export default function WritingRoom({
  project, activeChap, updateProject, updateChapter,
  generating, generate, onOpenBible, onOpenActions,
  prompt, setPrompt, onSelectMode,
  onGuideRun, onGuideDismiss, qualityReview, onOpenProductionStudio,
  mode, setSavedMsg, onUpgradeRequired,
}: WritingRoomProps) {
  const [bibleOpen, setBibleOpen] = useState(true);

  useEffect(() => {
    if (window.innerWidth < 900) setBibleOpen(false);
  }, []);

  const sortedChapters = [...(project.chapters || [])].sort((a: any, b: any) => a.sortOrder - b.sortOrder);
  const chapIndex = sortedChapters.findIndex((c: any) => c.id === activeChap.id);
  const stage = currentStage({
    format: project.format,
    controllingIdea: project.controllingIdea,
    characters: project.characters || [],
    chapters: project.chapters || [],
    dismissedGuideIds: project.dismissedGuideIds,
  });
  const stageIdx = STAGE_ORDER.indexOf(stage);

  const visibleModes = useMemo(() => getVisibleModes(project.format), [project.format]);
  const slashQuery = prompt.startsWith("/") ? prompt.slice(1) : null;
  const filteredModes = slashQuery !== null ? filterModesByQuery(slashQuery, visibleModes) : [];

  const libraryCandidates = useMemo(() => LIBRARY_MODES.filter(m => visibleModes.includes(m)), [visibleModes]);
  const [dismissedDetection, setDismissedDetection] = useState<GenerationMode | null>(null);
  const detectedMode = useMemo(
    () => (stage === "draft" && slashQuery === null ? classifyBeat(prompt, libraryCandidates) : null),
    [stage, slashQuery, prompt, libraryCandidates]
  );

  useEffect(() => {
    if (!prompt.trim()) setDismissedDetection(null);
  }, [prompt]);

  const handleSelect = (m: GenerationMode) => {
    setPrompt("");
    onSelectMode(m);
  };

  const goToChapter = (i: number) => {
    const target = sortedChapters[i];
    if (target) updateProject((p: any) => ({ ...p, activeChapter: target.id }));
  };

  const handleEditorChange = (json: string, wordCount: number) => {
    updateChapter("content", json);
    updateChapter("wordCount", wordCount);
    fetch(`/api/projects/${project.id}/chapters/${activeChap.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: json }),
    }).catch(() => {});
  };

  const stageLabels = isCreatorFormat(project.format) ? CREATOR_STAGE_LABELS : STAGE_LABELS;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ flexShrink: 0, borderBottom: `1px solid ${co.border}`, padding: "10px 20px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: co.text }}>{project.name}</span>
          <span style={{ fontSize: 11, color: co.muted }}>{project.format}</span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: co.muted }}>
            <button style={{ ...sBtnSm, padding: "2px 8px" }} disabled={chapIndex <= 0} onClick={() => goToChapter(chapIndex - 1)}>‹</button>
            <span>{getChapterLabel(project.format)} {chapIndex + 1} of {sortedChapters.length}: {activeChap.title}</span>
            <button style={{ ...sBtnSm, padding: "2px 8px" }} disabled={chapIndex < 0 || chapIndex >= sortedChapters.length - 1} onClick={() => goToChapter(chapIndex + 1)}>›</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, fontSize: 11 }}>
          {STAGE_ORDER.map((s, i) => (
            <span key={s} style={{
              padding: "2px 8px", borderRadius: 6,
              fontWeight: i === stageIdx ? 700 : 400,
              color: i < stageIdx ? co.green : i === stageIdx ? co.accent : co.muted,
              background: i === stageIdx ? co.accentBg : "transparent",
            }}>
              {i < stageIdx ? "✓ " : ""}{stageLabels[s]}
            </span>
          ))}
        </div>
      </div>

      {/* Body: stage view, or editor + bible glance rail */}
      {stage === "idea" ? (
        <IdeaStageView project={project} updateProject={updateProject} onOpenBible={onOpenBible} prompt={prompt} setPrompt={setPrompt} onUpgradeRequired={onUpgradeRequired} onOpenActions={onOpenActions} />
      ) : stage === "structure" ? (
        <StructureStageView project={project} setPrompt={setPrompt} onSelectMode={onSelectMode} prompt={prompt} mode={mode} topic={activeChap.title} setSavedMsg={setSavedMsg} onUpgradeRequired={onUpgradeRequired} onOpenActions={onOpenActions} />
      ) : stage === "polish" ? (
        <PolishStageView project={project} qualityReview={qualityReview} onGuideRun={onGuideRun} onGuideDismiss={onGuideDismiss} mode={mode} content={activeChap.content} updateProject={updateProject} setSavedMsg={setSavedMsg} onUpgradeRequired={onUpgradeRequired} onOpenActions={onOpenActions} />
      ) : stage === "export" ? (
        <ExportStageView project={project} onGuideRun={onGuideRun} onOpenProductionStudio={onOpenProductionStudio} />
      ) : (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <ChapterEditor
            content={activeChap.content ?? ""}
            onChange={handleEditorChange}
            placeholder="Begin writing..."
            autoFocus
          />

          <div style={{ width: bibleOpen ? 190 : 36, minWidth: bibleOpen ? 190 : 36, borderLeft: `1px solid ${co.border}`, background: co.surface, transition: "width 0.2s", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: bibleOpen ? "space-between" : "center", alignItems: "center", padding: "8px" }}>
              {bibleOpen && <span style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1 }}>Bible</span>}
              <button style={{ background: "none", border: "none", color: co.muted, cursor: "pointer", fontSize: 14 }} onClick={() => setBibleOpen(o => !o)}>{bibleOpen ? "▶" : "◀"}</button>
            </div>
            {bibleOpen && (
              <div style={{ flex: 1, overflow: "auto", padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 14 }}>
                {isCreatorFormat(project.format) && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Script tools</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <TikTokNativePanel format={project.format} onUpgradeRequired={onUpgradeRequired} />
                      <RepurposePanel format={project.format} mode={mode} content={activeChap.content} niche={project.creatorBible?.niche} channelVoice={project.creatorBible?.channelVoice} setSavedMsg={setSavedMsg} updateProject={updateProject} onUpgradeRequired={onUpgradeRequired} />
                      <ResearchScaffoldPanel format={project.format} mode={mode} prompt={prompt} topic={activeChap.title} setSavedMsg={setSavedMsg} updateProject={updateProject} onUpgradeRequired={onUpgradeRequired} />
                      <button style={sBtnSm} onClick={onOpenActions}>More →</button>
                    </div>
                  </div>
                )}
                <BibleSection title="Characters" items={(project.characters || []).map((c: any) => c.name)} />
                <BibleSection title="Locations" items={(project.locations || []).map((l: any) => l.name)} />
                <BibleSection title="Threads" items={(project.plotThreads || []).map((t: any) => t.name)} />
                <button style={{ ...sBtnSm, marginTop: "auto" }} onClick={onOpenBible}>Open bible →</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ flexShrink: 0, borderTop: `1px solid ${co.border}`, padding: "10px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {detectedMode && detectedMode !== dismissedDetection && (
          <BeatDetectionChip
            mode={detectedMode}
            onApply={() => onSelectMode(detectedMode)}
            onDismiss={() => setDismissedDetection(detectedMode)}
          />
        )}
        <div style={{ position: "relative" }}>
          {slashQuery !== null && <SlashMenu modes={filteredModes} onSelect={handleSelect} />}
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (slashQuery !== null) {
                  if (filteredModes.length > 0) handleSelect(filteredModes[0]);
                } else {
                  generate();
                }
              } else if (e.key === "Escape" && slashQuery !== null) {
                setPrompt("");
              }
            }}
            placeholder="What happens next? Type / for commands…"
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${co.border}`, background: co.surfaceAlt, color: co.text, fontSize: 13 }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button style={sBtnSm} onClick={onOpenActions}>Actions</button>
          <button style={{ ...sBtn, opacity: generating ? 0.6 : 1 }} disabled={generating} onClick={() => generate()}>
            {generating ? `${MODE_REGISTRY.write.label}…` : MODE_REGISTRY.write.label}
          </button>
        </div>
      </div>
    </div>
  );
}

function BibleSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: co.muted }}>None yet</div>
      ) : (
        items.map((name, i) => <div key={i} style={{ fontSize: 12, color: co.text, padding: "2px 0" }}>{name}</div>)
      )}
    </div>
  );
}
