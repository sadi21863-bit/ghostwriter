"use client";
import { useState, useEffect } from "react";
import type { SkillSuggestion } from "@/lib/ai/skill-router";
import { useProjectState } from "@/hooks/useProjectState";
import { useAIActions } from "@/hooks/useAIActions";
import { useWorldBible } from "@/hooks/useWorldBible";
import WorldBiblePanel from "@/components/panels/WorldBiblePanel";
import ToolbarPanel from "@/components/panels/ToolbarPanel";
import ChapterEditor from "@/components/panels/ChapterEditor";
import { StoryHealthPanel } from "@/components/panels/StoryHealthPanel";
import { ExportPanel } from "@/components/panels/ExportPanel";
import { AltDraftPanel } from "@/components/panels/toolbar/tools/AltDraftPanel";
import { SprintMode } from "@/components/SprintMode";
import { UpgradePrompt } from "@/components/upgrade/UpgradePrompt";
import { CommandPalette } from "@/components/CommandPalette";
import type { FeatureGate } from "@/types/subscription";
import type { CompositionLayer } from "@/lib/ai/composer";
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
  const [horrorArchetype, setHorrorArchetype] = useState("Uncanny");
  const [comedyArchetype, setComedyArchetype] = useState("Situation");
  const [mysteryArchetype, setMysteryArchetype] = useState("Clue Planting");
  const [romanceArchetype, setRomanceArchetype] = useState("First Recognition");
  const [actionArchetype, setActionArchetype] = useState("Chase");
  const [monologueArchetype, setMonologueArchetype] = useState("Interior Monologue");
  const [voiceProfile, setVoiceProfile] = useState("Vocabulary Register");
  const [thrillerArchetype, setThrillerArchetype] = useState("Expanding Threat");
  const [sportsArchetype, setSportsArchetype] = useState("Flow State");
  const [settingArchetype, setSettingArchetype] = useState("Prospect-Refuge");
  const [historicalArchetype, setHistoricalArchetype] = useState("Longue Durée");
  const [scitechArchetype, setScitechArchetype] = useState("Normal Science");
  const [ethicsArchetype, setEthicsArchetype] = useState("Moral Dumbfounding");
  const [endingsArchetype, setEndingsArchetype] = useState("Resolution");
  const [isekaiArchetype, setIsekaiArchetype] = useState("Classic Isekai");
  const [compositionLayers, setCompositionLayers] = useState<CompositionLayer[]>([]);
  const [upgradeRequired, setUpgradeRequired] = useState<FeatureGate | null>(null);
  const [showStoryHealth, setShowStoryHealth] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showAltDraft, setShowAltDraft] = useState(false);
  const [showSprintMode, setShowSprintMode] = useState(false);
  const [skillSuggestion, setSkillSuggestion] = useState<SkillSuggestion | null>(null);
  const [activeInfluence, setActiveInfluence] = useState<any | null>(null);
  const [activePatterns, setActivePatterns] = useState<any[]>([]);

  useEffect(() => {
    const tintMap: Record<string, string> = {
      horror: "var(--tint-horror)", romance: "var(--tint-romance)",
      thriller: "var(--tint-thriller)", monologue: "var(--tint-monologue)",
      combat: "var(--tint-combat)", comedy: "var(--tint-comedy)",
      mystery: "var(--tint-mystery)", atmosphere: "var(--tint-atmosphere)",
      tension: "var(--tint-tension)", emotional: "var(--tint-emotional)",
      dialogue: "var(--tint-dialogue)", setting: "var(--tint-setting)",
      historical: "var(--tint-historical)", scitech: "var(--tint-scitech)",
      ethics: "var(--tint-ethics)", endings: "var(--tint-endings)",
      sports: "var(--tint-sports)", action: "var(--tint-action)",
    };
    const tint = tintMap[mode] ?? "rgba(217,119,6,0.08)";
    document.documentElement.style.setProperty("--library-tint", tint);
  }, [mode]);

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
    setUpgradeRequired: (f) => setUpgradeRequired(f as FeatureGate),
    activeInfluence,
    activePatterns,
  });

  const worldBible = useWorldBible({
    project: project || {},
    updateProject: projectState.updateProject,
    setProject: projectState.setProject,
    setErrorMsg,
  });

  const handleSlashCommand = (id: string) => {
    switch (id) {
      case 'alt-draft':    setShowAltDraft(true); break;
      case 'story-health': setShowStoryHealth(true); break;
      case 'export':       setShowExport(true); break;
      case 'sprint-mode':  setShowSprintMode(true); break;
    }
  };

  const handleAcceptSkillSuggestion = (suggestedMode: string) => {
    setMode(suggestedMode);
    setSkillSuggestion(null);
  };

  useEffect(() => {
    if (!activeChap?.emotionalTone) return;
    const toneToMode: Record<string, string> = {
      Grief: 'emotional', Rage: 'emotional', Fear: 'emotional',
      Shame: 'emotional', Despair: 'emotional', Tenderness: 'emotional',
      Dread: 'horror', Tension: 'tension', Wonder: 'atmosphere',
    };
    const suggested = toneToMode[activeChap.emotionalTone];
    if (suggested && suggested !== mode) {
      setSkillSuggestion({
        mode: suggested,
        label: `${suggested.charAt(0).toUpperCase() + suggested.slice(1)} Mode`,
        confidence: 'medium',
        reason: `This chapter is tagged "${activeChap.emotionalTone}" — ${suggested} mode is optimized for this register`,
      });
    }
  }, [activeChap?.emotionalTone]);

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

      {aiActions.violationBanner && (
        <div style={{ position: "fixed", top: errorMsg ? 44 : 0, left: 0, right: 0, background: "#92400e", color: "#fef3c7", padding: "12px 20px", zIndex: 1999, borderBottom: "1px solid #d97706" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>⚠ Craft Notice — Read before generating</div>
          <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>{aiActions.violationBanner.flagMessage}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => aiActions.confirmViolation(aiActions.violationBanner!.violationType, "intentional choice")}
              style={{ background: "#d97706", color: "#fff", border: "none", borderRadius: 6, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Confirm as intentional — Generate anyway
            </button>
            <button
              onClick={() => aiActions.setViolationBanner(null)}
              style={{ background: "none", border: "1px solid #d97706", color: "#fef3c7", borderRadius: 6, padding: "6px 16px", fontSize: 12, cursor: "pointer" }}
            >
              Dismiss — I'll revise the prompt
            </button>
          </div>
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
        horrorArchetype={horrorArchetype}
        setHorrorArchetype={setHorrorArchetype}
        generateHorror={aiActions.generateHorror}
        comedyArchetype={comedyArchetype}
        setComedyArchetype={setComedyArchetype}
        generateComedy={aiActions.generateComedy}
        mysteryArchetype={mysteryArchetype}
        setMysteryArchetype={setMysteryArchetype}
        generateMystery={aiActions.generateMystery}
        romanceArchetype={romanceArchetype}
        setRomanceArchetype={setRomanceArchetype}
        generateRomance={aiActions.generateRomance}
        actionArchetype={actionArchetype}
        setActionArchetype={setActionArchetype}
        generateAction={aiActions.generateAction}
        monologueArchetype={monologueArchetype}
        setMonologueArchetype={setMonologueArchetype}
        generateMonologue={aiActions.generateMonologue}
        voiceProfile={voiceProfile}
        setVoiceProfile={setVoiceProfile}
        generateVoice={aiActions.generateVoice}
        thrillerArchetype={thrillerArchetype}
        setThrillerArchetype={setThrillerArchetype}
        generateThriller={aiActions.generateThriller}
        sportsArchetype={sportsArchetype}
        setSportsArchetype={setSportsArchetype}
        generateSports={aiActions.generateSports}
        settingArchetype={settingArchetype}
        setSettingArchetype={setSettingArchetype}
        generateSetting={aiActions.generateSetting}
        historicalArchetype={historicalArchetype}
        setHistoricalArchetype={setHistoricalArchetype}
        generateHistorical={aiActions.generateHistorical}
        scitechArchetype={scitechArchetype}
        setScitechArchetype={setScitechArchetype}
        generateScitech={aiActions.generateScitech}
        ethicsArchetype={ethicsArchetype}
        setEthicsArchetype={setEthicsArchetype}
        generateEthics={aiActions.generateEthics}
        endingsArchetype={endingsArchetype}
        setEndingsArchetype={setEndingsArchetype}
        generateEndings={aiActions.generateEndings}
        isekaiArchetype={isekaiArchetype}
        setIsekaiArchetype={setIsekaiArchetype}
        generateIsekai={aiActions.generateIsekai}
        compositionLayers={compositionLayers}
        setCompositionLayers={setCompositionLayers}
        generateComposition={aiActions.generateComposition}
        setUpgradeRequired={(f) => setUpgradeRequired(f as FeatureGate)}
        onShowStoryHealth={() => setShowStoryHealth(true)}
        onShowExport={() => setShowExport(true)}
        onSlashCommand={handleSlashCommand}
        skillSuggestion={skillSuggestion}
        onSkillSuggestionChange={setSkillSuggestion}
        onDismissSkillSuggestion={() => setSkillSuggestion(null)}
        onAcceptSkillSuggestion={handleAcceptSkillSuggestion}
        activeInfluence={activeInfluence}
        setActiveInfluence={setActiveInfluence}
        activePatterns={activePatterns}
        setActivePatterns={setActivePatterns}
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
        passiveSuggestions={projectState.passiveSuggestions}
        setPassiveSuggestions={projectState.setPassiveSuggestions}
        setUpgradeRequired={(f) => setUpgradeRequired(f as FeatureGate)}
      />

      {showStoryHealth && (
        <StoryHealthPanel
          project={project}
          projectId={project.id}
          activeChapContent={activeChap?.content || ""}
          onClose={() => setShowStoryHealth(false)}
        />
      )}

      {showExport && (
        <ExportPanel
          projectId={project.id}
          projectFormat={project.format}
          onClose={() => setShowExport(false)}
        />
      )}

      {showAltDraft && (
        <AltDraftPanel
          project={project}
          activeChap={activeChap}
          updateChapter={projectState.updateChapter}
          onClose={() => setShowAltDraft(false)}
        />
      )}

      {showSprintMode && (
        <SprintMode
          content={activeChap.content || ''}
          chapterTitle={activeChap.title || 'Chapter'}
          projectName={project.name || 'Project'}
          onContentChange={(v) => projectState.updateChapter('content', v)}
          onClose={() => setShowSprintMode(false)}
        />
      )}

      {upgradeRequired && (
        <UpgradePrompt feature={upgradeRequired} onClose={() => setUpgradeRequired(null)} />
      )}

      <CommandPalette
        chapters={(project.chapters || []).map((c: any) => ({ id: c.id, title: c.title }))}
        characters={(project.characters || []).map((c: any) => ({ id: c.id, name: c.name }))}
        modes={["brainstorm", "outline", "write", "horror", "romance", "thriller", "dialogue", "combat", "emotional", "atmosphere", "tension", "comedy", "mystery", "action", "monologue", "voice", "sports", "setting", "historical", "scitech", "ethics", "endings"]}
        onNavigate={(target, _id) => {
          if (target === "dashboard") window.location.href = "/dashboard";
          else if (target === "settings") window.location.href = "/settings";
          else if (target === "production") setShowProductionStudio(true);
          else if (target === "world-bible") setLeftCollapsed(false);
        }}
        onSwitchMode={(m) => setMode(m)}
        onRunCheck={() => setShowStoryHealth(true)}
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
