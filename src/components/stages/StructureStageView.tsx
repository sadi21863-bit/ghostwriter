// src/components/stages/StructureStageView.tsx
"use client";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import { parseBeatList } from "@/lib/modes/beats";
import type { GenerationMode } from "@/lib/modes/registry";
import { isCreatorFormat } from "@/lib/formats";
import { HookABPanel } from "@/components/panels/toolbar/tools/HookABPanel";
import { ThumbnailConceptsPanel } from "@/components/panels/toolbar/tools/ThumbnailConceptsPanel";
import { TitleHookPanel } from "@/components/panels/toolbar/tools/TitleHookPanel";

interface StructureStageViewProps {
  project: any;
  setPrompt: (value: string) => void;
  onSelectMode: (mode: GenerationMode) => void;
  prompt: string;
  mode: string;
  topic: string;
  setSavedMsg: (msg: string) => void;
  onUpgradeRequired: (feature: string) => void;
  onOpenActions: () => void;
}

export default function StructureStageView({ project, setPrompt, onSelectMode, prompt, mode, topic, setSavedMsg, onUpgradeRequired, onOpenActions }: StructureStageViewProps) {
  const beats = parseBeatList(project.notes || "");

  const handleGenerateOutline = () => {
    setPrompt(`Create a chapter-by-chapter outline for this story: ${project.controllingIdea ?? ""}`);
    onSelectMode("outline");
  };

  const handleExpandBeat = (beat: string) => {
    setPrompt(`Write this scene: ${beat}`);
  };

  if (!beats) {
    return (
      <div style={{ flex: 1, overflow: "auto", padding: "32px 24px", display: "flex", justifyContent: "center" }}>
        <div style={{ maxWidth: 560, width: "100%", textAlign: "center", paddingTop: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
            Structure
          </div>
          <p style={{ fontSize: 14, color: co.muted, lineHeight: 1.6, marginBottom: 16 }}>
            No outline yet. Generate a chapter-by-chapter beat list to map out the story before you start drafting.
          </p>
          <button style={sBtn} onClick={handleGenerateOutline}>Generate outline →</button>
          {isCreatorFormat(project.format) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 20 }}>
              <HookABPanel format={project.format} projectId={project.id} onUpgradeRequired={onUpgradeRequired} />
              <ThumbnailConceptsPanel format={project.format} onUpgradeRequired={onUpgradeRequired} />
              <TitleHookPanel format={project.format} mode={mode} prompt={prompt} topic={topic} setSavedMsg={setSavedMsg} onUpgradeRequired={onUpgradeRequired} />
              <button style={sBtnSm} onClick={onOpenActions}>More →</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "32px 24px", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 560, width: "100%" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: co.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
          Structure
        </div>
        <p style={{ fontSize: 12, color: co.muted, lineHeight: 1.6, marginBottom: 16 }}>
          {beats.length} beats. Expand a beat to draft it as the opening of this chapter.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {beats.map((beat, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", borderRadius: 10, border: `1px solid ${co.border}`, background: co.surface }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: co.accent, flexShrink: 0, minWidth: 20 }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 13, color: co.text, lineHeight: 1.6 }}>{beat}</span>
              <button style={{ ...sBtnSm, flexShrink: 0 }} onClick={() => handleExpandBeat(beat)}>Expand to draft →</button>
            </div>
          ))}
        </div>
        <button style={{ ...sBtnSm, marginTop: 16 }} onClick={handleGenerateOutline}>Regenerate outline</button>
        {isCreatorFormat(project.format) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 20, paddingTop: 16, borderTop: `1px solid ${co.border}` }}>
            <HookABPanel format={project.format} projectId={project.id} onUpgradeRequired={onUpgradeRequired} />
            <ThumbnailConceptsPanel format={project.format} onUpgradeRequired={onUpgradeRequired} />
            <TitleHookPanel format={project.format} mode={mode} prompt={prompt} topic={topic} setSavedMsg={setSavedMsg} onUpgradeRequired={onUpgradeRequired} />
            <button style={sBtnSm} onClick={onOpenActions}>More →</button>
          </div>
        )}
      </div>
    </div>
  );
}
