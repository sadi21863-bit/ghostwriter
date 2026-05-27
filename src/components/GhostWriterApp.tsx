"use client";
import { useState } from "react";
import { useProjectState } from "@/hooks/useProjectState";
import { useAIActions } from "@/hooks/useAIActions";
import { useWorldBible } from "@/hooks/useWorldBible";
import WorldBiblePanel from "@/components/panels/WorldBiblePanel";
import ToolbarPanel from "@/components/panels/ToolbarPanel";
import ChapterEditor from "@/components/panels/ChapterEditor";
import { co, sBtn, sBtnSm } from "@/lib/styles";

export default function GhostWriterApp({ projectId }: { projectId: string }) {
  const [mode, setMode] = useState("brainstorm");
  const [prompt, setPrompt] = useState("");
  const [expandedPrompt, setExpandedPrompt] = useState(false);
  const [showAgents, setShowAgents] = useState(false);
  const [showComicStudio, setShowComicStudio] = useState(false);
  const [showProductionStudio, setShowProductionStudio] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [cohostVoice, setCohostVoice] = useState("curious_generalist");
  const [dialogueArchetype, setDialogueArchetype] = useState("Argument");
  const [combatStyleA, setCombatStyleA] = useState("");
  const [combatStyleB, setCombatStyleB] = useState("");
  const [emotionalEmotion, setEmotionalEmotion] = useState("Grief");
  const [atmosphereEnvironment, setAtmosphereEnvironment] = useState("Natural");
  const [tensionType, setTensionType] = useState("Suspense");

  const projectState = useProjectState(projectId);
  const {
    project, loadError,
    errorMsg, setErrorMsg,
    confirmModal, setConfirmModal,
    higgsfieldKey, savedMsg, setSavedMsg,
    dialogueCharA, setDialogueCharA,
    dialogueCharB, setDialogueCharB,
  } = projectState;

  const activeChap = project?.chapters?.find((c: any) => c.id === project.activeChapter)
    || project?.chapters?.[0]
    || { id: "", title: "Chapter 1", content: "", summary: "" };

  const aiActions = useAIActions({
    project: project || {},
    mode,
    prompt,
    activeChap,
    updateChapter: projectState.updateChapter,
    setErrorMsg,
    setSavedMsg,
    creatorBible: projectState.creatorBible,
    cohostVoice,
  });

  const worldBible = useWorldBible({
    project: project || {},
    updateProject: projectState.updateProject,
    setProject: projectState.setProject,
    setErrorMsg,
  });

  if (loadError) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui", flexDirection: "column", gap: 12 }}>
      <span style={{ color: "#d94545", fontSize: 15 }}>{loadError}</span>
      <button onClick={() => window.location.reload()} style={{ padding: "8px 20px", background: "#5b4ccc", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>Retry</button>
    </div>
  );

  if (!project) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui" }}>Loading...</div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Inter',system-ui,sans-serif", background: co.bg, color: co.text, overflow: "hidden" }}>
      {errorMsg && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, background: "#d94545", color: "#fff", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, zIndex: 2000 }}>
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      <WorldBiblePanel
        project={project}
        updateProject={projectState.updateProject}
        storyMemories={projectState.storyMemories}
        setStoryMemories={projectState.setStoryMemories}
        creatorBible={projectState.creatorBible}
        updateCreatorBible={projectState.updateCreatorBible}
        save={projectState.save}
        savedMsg={savedMsg}
        exportAll={projectState.exportAll}
        setErrorMsg={setErrorMsg}
        setConfirmModal={setConfirmModal}
        generating={aiActions.generating}
        genTarget={aiActions.genTarget}
        setGenerating={aiActions.setGenerating}
        setGenTarget={aiActions.setGenTarget}
        callAI={aiActions.callAI}
        buildFullContext={aiActions.buildFullContext}
        setStreamText={aiActions.setStreamText}
        setMode={setMode}
        setPrompt={setPrompt}
        quickStartLoading={worldBible.quickStartLoading}
        quickStartStory={worldBible.quickStartStory}
        portraitLoading={worldBible.portraitLoading}
        generatePortrait={worldBible.generatePortrait}
        linkSuggestions={worldBible.linkSuggestions}
        setLinkSuggestions={worldBible.setLinkSuggestions}
        suggestingLinks={worldBible.suggestingLinks}
        suggestLinks={worldBible.suggestLinks}
        confirmLink={worldBible.confirmLink}
        toggleAlwaysInContext={projectState.toggleAlwaysInContext}
        setSavedMsg={setSavedMsg}
        leftCollapsed={leftCollapsed}
        setLeftCollapsed={setLeftCollapsed}
      />

      <ToolbarPanel
        project={project}
        higgsfieldKey={higgsfieldKey}
        mode={mode}
        setMode={setMode}
        activeChap={activeChap}
        updateChapter={projectState.updateChapter}
        prompt={prompt}
        setPrompt={setPrompt}
        expandedPrompt={expandedPrompt}
        setExpandedPrompt={setExpandedPrompt}
        showAgents={showAgents}
        setShowAgents={setShowAgents}
        showComicStudio={showComicStudio}
        setShowComicStudio={setShowComicStudio}
        showProductionStudio={showProductionStudio}
        setShowProductionStudio={setShowProductionStudio}
        generating={aiActions.generating}
        genTarget={aiActions.genTarget}
        streamText={aiActions.streamText}
        setStreamText={aiActions.setStreamText}
        undoStack={aiActions.undoStack}
        undoGeneration={aiActions.undoGeneration}
        pipelineRunning={aiActions.pipelineRunning}
        pipelineResults={aiActions.pipelineResults}
        setPipelineResults={aiActions.setPipelineResults}
        expandedAgent={aiActions.expandedAgent}
        setExpandedAgent={aiActions.setExpandedAgent}
        activePipelineId={aiActions.activePipelineId}
        runPipeline={aiActions.runPipeline}
        usePipelineOutput={aiActions.usePipelineOutput}
        selectedText={aiActions.selectedText}
        setSelectedText={aiActions.setSelectedText}
        setSelectedRange={aiActions.setSelectedRange}
        proseLoading={aiActions.proseLoading}
        proseResult={aiActions.proseResult}
        setProseResult={aiActions.setProseResult}
        runProse={aiActions.runProse}
        replaceSelection={aiActions.replaceSelection}
        hookScore={aiActions.hookScore}
        hookScoring={aiActions.hookScoring}
        scoreHook={aiActions.scoreHook}
        generate={aiActions.generate}
        generateDialogue={aiActions.generateDialogue}
        updateProject={projectState.updateProject}
        handleTextareaSelect={aiActions.handleTextareaSelect}
        setSavedMsg={setSavedMsg}
        dialogueCharA={dialogueCharA}
        setDialogueCharA={setDialogueCharA}
        dialogueCharB={dialogueCharB}
        setDialogueCharB={setDialogueCharB}
        cohostVoice={cohostVoice}
        setCohostVoice={setCohostVoice}
        dialogueArchetype={dialogueArchetype}
        setDialogueArchetype={setDialogueArchetype}
        combatStyleA={combatStyleA}
        setCombatStyleA={setCombatStyleA}
        combatStyleB={combatStyleB}
        setCombatStyleB={setCombatStyleB}
        generateCombat={aiActions.generateCombat}
        emotionalEmotion={emotionalEmotion}
        setEmotionalEmotion={setEmotionalEmotion}
        atmosphereEnvironment={atmosphereEnvironment}
        setAtmosphereEnvironment={setAtmosphereEnvironment}
        tensionType={tensionType}
        setTensionType={setTensionType}
        generateEmotionalScene={aiActions.generateEmotionalScene}
        generateAtmosphere={aiActions.generateAtmosphere}
        generateTension={aiActions.generateTension}
      />

      <ChapterEditor
        project={project}
        updateProject={projectState.updateProject}
        updateChapter={projectState.updateChapter}
        addChapter={projectState.addChapter}
        deleteChapter={projectState.deleteChapter}
        moveChapter={projectState.moveChapter}
        rightCollapsed={rightCollapsed}
        setRightCollapsed={setRightCollapsed}
      />

      {confirmModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 24, width: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{confirmModal.msg}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={sBtnSm} onClick={() => setConfirmModal(null)}>Cancel</button>
              <button style={{ ...sBtn, background: co.danger }} onClick={confirmModal.action}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
