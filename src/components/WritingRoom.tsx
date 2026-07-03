"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ChapterEditor } from "@/components/editor/ChapterEditor";
import type { ChapterEditorHandle } from "@/components/editor/ChapterEditor";
import { co, sBtn, sBtnSm, sTextarea } from "@/lib/styles";
import { toast } from "@/lib/toast";
import { getChapterLabel, isCreatorFormat } from "@/lib/formats";
import { currentStage, type GuideStage, type GuideAction } from "@/lib/guide/next-action";
import { FUNNEL_ORDER, FUNNEL_LABELS, CREATOR_FUNNEL_LABELS, guideStageToFunnel, funnelStageToGuide } from "@/lib/guide/funnel";
import StageRoleRail from "@/components/StageRoleRail";
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";
import { getVisibleModes, filterModesByQuery } from "@/lib/modes/slash-menu";
import { LIBRARY_MODES, classifyBeat } from "@/lib/modes/classify";
import BeatDetectionChip from "@/components/BeatDetectionChip";
import CraftDepthChip from "@/components/CraftDepthChip";
import { AudioNovelPanel } from "@/components/AudioNovelPanel";
import { SprintMode } from "@/components/SprintMode";
import type { WorkPacket } from "@/lib/ai/influence-context";
import { useFeatureIsOn } from "@growthbook/growthbook-react";
import { FLAGS } from "@/lib/growthbook";

const StoryInsightsPanel = dynamic(
  () => import("@/components/StoryInsightsPanel").then(m => ({ default: m.StoryInsightsPanel })),
  { ssr: false }
);
import SlashMenu from "@/components/SlashMenu";
import IdeaStageView from "@/components/stages/IdeaStageView";
import StructureStageView from "@/components/stages/StructureStageView";
import PolishStageView from "@/components/stages/PolishStageView";
import ExportStageView from "@/components/stages/ExportStageView";
import { TikTokNativePanel } from "@/components/panels/toolbar/tools/TikTokNativePanel";
import { RepurposePanel } from "@/components/panels/toolbar/tools/RepurposePanel";
import { ResearchScaffoldPanel } from "@/components/panels/toolbar/tools/ResearchScaffoldPanel";
import type { QualityReview } from "@/components/panels/QualityReviewPanel";

interface WritingRoomProps {
  project: any;
  activeChap: any;
  updateProject: (fn: (p: any) => any) => void;
  updateChapter: (field: string, value: any) => void;
  generating: boolean;
  generate: (opts?: { insertViaEditor?: (text: string) => void; editorStream?: { start: () => void; delta: (t: string) => void; end: (full: string) => void } }) => Promise<void>;
  onOpenBible: () => void;
  onOpenActions: () => void;
  prompt: string;
  setPrompt: (value: string) => void;
  onSelectMode: (mode: GenerationMode) => void;
  onGuideRun: (action: GuideAction) => void;
  onGuideDismiss: (id: string) => void;
  qualityReview: QualityReview | null;
  onOpenProductionStudio: () => void;
  onOpenComicStudio: () => void;
  onOpenStoryHealth: (tab: "validator") => void;
  deepLinkInsightsTab?: "arc" | "tension" | null;
  deepLinkStage?: GuideStage | null;
  mode: string;
  setSavedMsg: (msg: string) => void;
  onUpgradeRequired: (feature: string) => void;
  onRegisterInsert?: (fn: (text: string) => void) => void;
  activeInfluence?: WorkPacket | null;
  onClearInfluence?: () => void;
  addChapter: () => Promise<void>;
}

export default function WritingRoom({
  project, activeChap, updateProject, updateChapter,
  generating, generate, onOpenBible, onOpenActions,
  prompt, setPrompt, onSelectMode,
  onGuideRun, onGuideDismiss, qualityReview, onOpenProductionStudio, onOpenComicStudio,
  onOpenStoryHealth, deepLinkInsightsTab, deepLinkStage,
  mode, setSavedMsg, onUpgradeRequired, onRegisterInsert,
  activeInfluence, onClearInfluence, addChapter,
}: WritingRoomProps) {
  const [bibleOpen, setBibleOpen] = useState(true);
  const [forceEditor, setForceEditor] = useState(false);
  const [manualStage, setManualStage] = useState<GuideStage | null>(null);
  const [addingChapter, setAddingChapter] = useState(false);
  const [sharingDraft, setSharingDraft] = useState(false);
  const editorRef = useRef<ChapterEditorHandle>(null);
  const streamingEnabled = useFeatureIsOn(FLAGS.streaming);

  const [surgicalOpen, setSurgicalOpen] = useState(false);
  const [audioNovelOpen, setAudioNovelOpen] = useState(false);
  const [sprintModeOpen, setSprintModeOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [insightsTab, setInsightsTab] = useState<"arc" | "tension">("arc");
  const [adaptedFromName, setAdaptedFromName] = useState<string | null>(null);
  const [surgicalInstruction, setSurgicalInstruction] = useState("");
  const [surgicalResult, setSurgicalResult] = useState<{
    original: string; replacement: string; explanation: string; updatedJson: object;
  } | null>(null);
  const [surgicalLoading, setSurgicalLoading] = useState(false);
  const [surgicalError, setSurgicalError] = useState<string | null>(null);
  const [shareCount, setShareCount] = useState(0);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  useEffect(() => {
    if (window.innerWidth < 900) setBibleOpen(false);
  }, []);

  useEffect(() => {
    if (onRegisterInsert) {
      onRegisterInsert((text: string) => editorRef.current?.insertContent(text));
    }
  }, []);

  useEffect(() => {
    if (deepLinkInsightsTab) {
      setInsightsOpen(true);
      setInsightsTab(deepLinkInsightsTab);
    }
  }, [deepLinkInsightsTab]);

  useEffect(() => {
    if (deepLinkStage) {
      goToStage(deepLinkStage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkStage]);

  // Generate prose with a live typewriter stream into the editor when the
  // streaming flag is on; falls back to the existing insert-on-completion
  // behavior (useGeneration's own mode==="write" check) when it's off.
  const runGenerate = () => generate({
    insertViaEditor: (text) => editorRef.current?.insertContent(text),
    editorStream: streamingEnabled ? {
      start: () => editorRef.current?.streamStart(),
      delta: (t) => editorRef.current?.streamDelta(t),
      end: (full) => editorRef.current?.streamEnd(full),
    } : undefined,
  });

  useEffect(() => {
    const sourceId = (project as any).adaptedFromProjectId;
    if (!sourceId) { setAdaptedFromName(null); return; }
    fetch(`/api/projects/${sourceId}`)
      .then(r => r.ok ? r.json() : null)
      .then(p => setAdaptedFromName(p?.name ?? null))
      .catch(() => setAdaptedFromName(null));
  }, [(project as any).adaptedFromProjectId]);

  const sortedChapters = [...(project.chapters || [])].sort((a: any, b: any) => a.sortOrder - b.sortOrder);
  const chapIndex = sortedChapters.findIndex((c: any) => c.id === activeChap.id);
  const isLastChapter = chapIndex >= 0 && chapIndex === sortedChapters.length - 1;
  const activeChapHasContent = (activeChap.wordCount ?? 0) > 0;
  const computedStage = currentStage({
    format: project.format,
    controllingIdea: project.controllingIdea,
    characters: project.characters || [],
    chapters: project.chapters || [],
    dismissedGuideIds: project.dismissedGuideIds,
  });
  const stage = manualStage ?? computedStage;
  // The UI presents 4 funnel stages over the guide engine's 5 (Polish+Export → Produce).
  const funnelStage = guideStageToFunnel(stage);
  const funnelIdx = FUNNEL_ORDER.indexOf(funnelStage);

  const goToStage = (s: GuideStage) => {
    setManualStage(s);
    if (s !== "draft") setForceEditor(false);
  };

  const handleAddChapter = async () => {
    setAddingChapter(true);
    try {
      await addChapter();
      goToStage("draft");
    } finally {
      setAddingChapter(false);
    }
  };

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

  const handleEditorChange = (json: string, _wordCount: number) => {
    updateChapter("content", json);
  };

  const funnelLabels = isCreatorFormat(project.format) ? CREATOR_FUNNEL_LABELS : FUNNEL_LABELS;

  async function handleSurgicalEdit() {
    if (!surgicalInstruction.trim() || !activeChap?.content) return;
    setSurgicalLoading(true);
    setSurgicalError(null);
    setSurgicalResult(null);
    try {
      const res = await fetch(`/api/ai/surgical-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterContent: activeChap.content,
          instruction: surgicalInstruction,
          projectId: project.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setSurgicalError(data.error ?? "Edit failed. Try rephrasing your instruction.");
      } else {
        setSurgicalResult(data);
      }
    } catch {
      setSurgicalError("Network error. Please try again.");
    } finally {
      setSurgicalLoading(false);
    }
  }

  function applySurgicalEdit() {
    if (!surgicalResult) return;
    editorRef.current?.replaceContent(surgicalResult.updatedJson);
    updateChapter("content", JSON.stringify(surgicalResult.updatedJson));
    setSurgicalResult(null);
    setSurgicalInstruction("");
    setSurgicalOpen(false);
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ flexShrink: 0, borderBottom: `1px solid ${co.border}`, padding: "10px 20px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: co.text }}>{project.name}</span>
          <span style={{ fontSize: 11, color: co.muted }}>{project.format}</span>
          {(project as any).adaptedFromProjectId && adaptedFromName && (
            <a href={`/project/${(project as any).adaptedFromProjectId}`} style={{ fontSize: 11, color: co.accent, textDecoration: "none" }}>
              Adapted from: {adaptedFromName} →
            </a>
          )}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: co.muted }}>
            <button style={{ ...sBtnSm, padding: "2px 8px" }} disabled={chapIndex <= 0} onClick={() => goToChapter(chapIndex - 1)}>‹</button>
            <span>{getChapterLabel(project.format)} {chapIndex + 1} of {sortedChapters.length}: {activeChap.title}</span>
            <button style={{ ...sBtnSm, padding: "2px 8px" }} disabled={chapIndex < 0 || chapIndex >= sortedChapters.length - 1} onClick={() => goToChapter(chapIndex + 1)}>›</button>
            <button style={{ ...sBtnSm, padding: "2px 8px" }} disabled={addingChapter} onClick={handleAddChapter}>
              {addingChapter ? "Adding…" : `+ Add ${getChapterLabel(project.format)}`}
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, fontSize: 11, alignItems: "center" }}>
          {FUNNEL_ORDER.map((fs, i) => (
            <button key={fs} onClick={() => goToStage(funnelStageToGuide(fs))} style={{
              padding: "2px 8px", borderRadius: 6, border: "none", cursor: "pointer",
              fontFamily: "inherit", fontSize: 11,
              fontWeight: i === funnelIdx ? 700 : 400,
              color: i < funnelIdx ? co.green : i === funnelIdx ? co.accent : co.muted,
              background: i === funnelIdx ? co.accentBg : "transparent",
            }}>
              {i < funnelIdx ? "✓ " : ""}{funnelLabels[fs]}
            </button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <button
              style={{
                padding: "2px 10px", borderRadius: 6, fontSize: 11,
                background: forceEditor ? co.accent : "transparent",
                color: forceEditor ? "#fff" : co.muted,
                border: `1px solid ${forceEditor ? co.accent : co.border}`,
                cursor: "pointer",
              }}
              onClick={() => setForceEditor(f => !f)}
            >
              Write
            </button>
            <div style={{ position: "relative" }}>
            <button
              disabled={sharingDraft}
              style={{
                padding: "2px 10px", borderRadius: 6, fontSize: 11,
                background: "transparent",
                color: sharingDraft ? co.muted : co.accent,
                border: `1px solid ${sharingDraft ? co.border : co.accent}`,
                cursor: sharingDraft ? "default" : "pointer",
                opacity: sharingDraft ? 0.6 : 1,
              }}
              onClick={async () => {
                setSharingDraft(true);
                try {
                  const res = await fetch(`/api/projects/${project.id}/reader-session`, { method: "POST" });
                  if (!res.ok) throw new Error("Failed to create reader session");
                  const { token } = await res.json();
                  const url = `${window.location.origin}/reader/${token}`;
                  await navigator.clipboard.writeText(url);
                  toast.success("Reader link copied! Share it with anyone to get feedback.");
                  setShareCount(c => c + 1);
                  setShareUrl(url);
                  setTimeout(() => setShareUrl(null), 8000);
                } catch {
                  toast.error("Could not create share link. Please try again.");
                } finally {
                  setSharingDraft(false);
                }
              }}
            >
              {sharingDraft ? "Creating link…" : shareCount > 0 ? `↗ Share Draft (${shareCount})` : "↗ Share Draft"}
            </button>
            {shareUrl && (
              <div style={{
                position: "absolute", top: "100%", right: 0, zIndex: 50,
                background: co.surface, border: `1px solid ${co.border}`, borderRadius: 6,
                padding: "6px 10px", fontSize: 11, color: co.muted, marginTop: 4,
                maxWidth: 280, wordBreak: "break-all",
              }}>
                <span style={{ color: co.text }}>{shareUrl}</span>
                <button onClick={() => navigator.clipboard.writeText(shareUrl)} style={{ ...sBtnSm, fontSize: 10, marginLeft: 6 }}>Copy</button>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Body: stage view, or editor + bible glance rail */}
      {forceEditor || stage === "draft" ? (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <ChapterEditor
            ref={editorRef}
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
      ) : stage === "idea" ? (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 20px 0" }}>
            <StageRoleRail funnelStage="discover" format={project.format} onSelectMode={onSelectMode} onOpenActions={onOpenActions} onOpenComicStudio={onOpenComicStudio} onOpenProductionStudio={onOpenProductionStudio} onOpenInsights={(tab) => { setInsightsOpen(true); setInsightsTab(tab); }} onOpenStoryHealth={onOpenStoryHealth} onOpenPolishStage={() => goToStage("polish")} onUpgradeRequired={onUpgradeRequired} />
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column" }}>
            <IdeaStageView project={project} updateProject={updateProject} onOpenBible={onOpenBible} prompt={prompt} setPrompt={setPrompt} onUpgradeRequired={onUpgradeRequired} onOpenActions={onOpenActions} />
          </div>
        </div>
      ) : stage === "structure" ? (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 20px 0" }}>
            <StageRoleRail funnelStage="shape" format={project.format} onSelectMode={onSelectMode} onOpenActions={onOpenActions} onOpenComicStudio={onOpenComicStudio} onOpenProductionStudio={onOpenProductionStudio} onOpenInsights={(tab) => { setInsightsOpen(true); setInsightsTab(tab); }} onOpenStoryHealth={onOpenStoryHealth} onOpenPolishStage={() => goToStage("polish")} onUpgradeRequired={onUpgradeRequired} />
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column" }}>
            <StructureStageView project={project} setPrompt={setPrompt} onSelectMode={onSelectMode} prompt={prompt} mode={mode} topic={activeChap.title} setSavedMsg={setSavedMsg} onUpgradeRequired={onUpgradeRequired} onOpenActions={onOpenActions} />
          </div>
        </div>
      ) : guideStageToFunnel(stage) === "produce" ? (
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 20px 0" }}>
            <StageRoleRail funnelStage="produce" format={project.format} onSelectMode={onSelectMode} onOpenActions={onOpenActions} onOpenComicStudio={onOpenComicStudio} onOpenProductionStudio={onOpenProductionStudio} onOpenInsights={(tab) => { setInsightsOpen(true); setInsightsTab(tab); }} onOpenStoryHealth={onOpenStoryHealth} onOpenPolishStage={() => goToStage("polish")} onUpgradeRequired={onUpgradeRequired} />
          </div>
          <PolishStageView project={project} qualityReview={qualityReview} onGuideRun={onGuideRun} onGuideDismiss={onGuideDismiss} mode={mode} content={activeChap.content} updateProject={updateProject} setSavedMsg={setSavedMsg} onUpgradeRequired={onUpgradeRequired} onOpenActions={onOpenActions} />
          <ExportStageView project={project} onGuideRun={onGuideRun} onOpenProductionStudio={onOpenProductionStudio} onOpenComicStudio={onOpenComicStudio} />
        </div>
      ) : null}

      {/* Footer */}
      <div style={{ flexShrink: 0, borderTop: `1px solid ${co.border}`, padding: "10px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {activeInfluence && (stage === "draft" || forceEditor) && (
          <CraftDepthChip
            packet={activeInfluence}
            activeMode={mode ?? "write"}
            onDismiss={onClearInfluence ?? (() => {})}
          />
        )}
        {detectedMode && detectedMode !== dismissedDetection && (
          <BeatDetectionChip
            mode={detectedMode}
            onApply={() => onSelectMode(detectedMode)}
            onDismiss={() => setDismissedDetection(detectedMode)}
          />
        )}
        {(stage === "draft" || forceEditor) && isLastChapter && activeChapHasContent && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            padding: "8px 12px", background: co.accentBg, border: `1px solid ${co.border}`, borderRadius: 8,
          }}>
            <span style={{ fontSize: 12, color: co.text }}>
              Ready for the next {getChapterLabel(project.format).toLowerCase()}?
            </span>
            <button style={sBtnSm} disabled={addingChapter} onClick={handleAddChapter}>
              {addingChapter ? "Adding…" : `Continue → Start next ${getChapterLabel(project.format)}`}
            </button>
          </div>
        )}
        {(stage === "draft" || forceEditor) && (
          <div style={{ marginBottom: 0 }}>
            <button
              onClick={() => { setSurgicalOpen(o => !o); setSurgicalResult(null); setSurgicalError(null); }}
              style={{ ...sBtnSm, fontSize: 11, opacity: 0.8 }}
            >
              {surgicalOpen ? "✕ Close Find & Edit" : "✏ Find & Edit"}
            </button>
            <button
              onClick={() => setSprintModeOpen(true)}
              style={{ ...sBtnSm, fontSize: 11, opacity: 0.8, marginLeft: 6 }}
            >
              🏃 Sprint Mode
            </button>

            {surgicalOpen && (
              <div style={{ marginTop: 8, padding: "10px 12px", background: co.surface, border: `1px solid ${co.border}`, borderRadius: 8 }}>
                <textarea
                  value={surgicalInstruction}
                  onChange={e => setSurgicalInstruction(e.target.value)}
                  placeholder='Describe what to change: "make the third dialogue more tense", "replace sword with dagger", "cut the redundant simile in paragraph 2"'
                  style={{ ...sTextarea, width: "100%", minHeight: 60, marginBottom: 8, fontSize: 12 }}
                />
                <p style={{ fontSize: 11, color: co.muted, margin: "0 0 6px", fontStyle: "italic" }}>
                  Tip: Be specific — &quot;make the third dialogue exchange more tense&quot; works better than &quot;improve the scene&quot;.
                </p>
                <button
                  onClick={handleSurgicalEdit}
                  disabled={surgicalLoading || !surgicalInstruction.trim()}
                  style={{ ...sBtn, fontSize: 12 }}
                >
                  {surgicalLoading ? "Finding & editing…" : "Apply Edit"}
                </button>

                {surgicalError && (
                  <p style={{ color: co.danger, fontSize: 12, marginTop: 8 }}>{surgicalError}</p>
                )}

                {surgicalResult && (
                  <div style={{ marginTop: 12, fontSize: 12 }}>
                    <p style={{ color: co.muted, marginBottom: 4 }}>✓ {surgicalResult.explanation}</p>
                    <div style={{ background: co.surfaceAlt, borderRadius: 6, padding: "6px 10px", marginBottom: 6, color: co.danger, fontFamily: "monospace", fontSize: 11, whiteSpace: "pre-wrap" }}>
                      − {surgicalResult.original}
                    </div>
                    <div style={{ background: co.surfaceAlt, borderRadius: 6, padding: "6px 10px", marginBottom: 8, color: co.green, fontFamily: "monospace", fontSize: 11, whiteSpace: "pre-wrap" }}>
                      + {surgicalResult.replacement}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={applySurgicalEdit} style={{ ...sBtn, fontSize: 12 }}>Apply Change</button>
                      <button onClick={() => setSurgicalResult(null)} style={{ ...sBtnSm, fontSize: 12 }}>Discard</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {(stage === "draft" || stage === "polish" || forceEditor) && (
          <div style={{ marginBottom: 0 }}>
            <button
              onClick={() => setAudioNovelOpen(o => !o)}
              style={{ ...sBtnSm, fontSize: 11, opacity: 0.8 }}
            >
              {audioNovelOpen ? "✕ Close Audio Novel" : "🎧 Audio Novel"}
            </button>
            {audioNovelOpen && (
              <div style={{ marginTop: 8 }}>
                <AudioNovelPanel project={project} activeChap={activeChap} />
              </div>
            )}
          </div>
        )}
        {(stage === "draft" || stage === "polish" || forceEditor || insightsOpen) && (
          <div style={{ marginBottom: 0 }}>
            <button
              onClick={() => setInsightsOpen(o => !o)}
              style={{ ...sBtnSm, fontSize: 11, opacity: 0.8 }}
            >
              {insightsOpen ? "✕ Close Story Insights" : "📊 Story Insights"}
            </button>
            {insightsOpen && (
              <div style={{ marginTop: 8 }}>
                <StoryInsightsPanel key={insightsTab} projectId={project.id} initialTab={insightsTab} />
              </div>
            )}
          </div>
        )}
        {sprintModeOpen && (
          <SprintMode
            content={activeChap.content || ""}
            chapterTitle={activeChap.title || "Chapter"}
            projectName={project.name || "Project"}
            onContentChange={(v) => updateChapter("content", v)}
            onClose={() => setSprintModeOpen(false)}
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
                  runGenerate();
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
          <div style={{ display: "flex", gap: 8 }}>
            <button style={sBtnSm} onClick={onOpenActions}>Actions</button>
            <Link
              href={`/project/${project.id}/studio`}
              style={{ ...sBtnSm, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
            >
              Studio →
            </Link>
          </div>
          <button style={{ ...sBtn, opacity: generating ? 0.6 : 1 }} disabled={generating} onClick={runGenerate}>
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
