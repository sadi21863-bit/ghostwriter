"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import type { SkillSuggestion } from "@/lib/ai/skill-router";
import { useProjectState } from "@/hooks/useProjectState";
import { useAIActions } from "@/hooks/useAIActions";
import { useWorldBible } from "@/hooks/useWorldBible";
import { ToastContainer } from "@/components/ToastContainer";
import type { FeatureGate } from "@/types/subscription";
import type { CompositionLayer } from "@/lib/ai/composer";
import { co, sBtn, sBtnSm } from "@/lib/styles";
import { resolveInitiative } from "@/lib/ai/initiative";
import { GuideBar } from "@/components/GuideBar";
import { nextAction, type GuideAction, type GuideStage } from "@/lib/guide/next-action";
import WritingRoom from "@/components/WritingRoom";
import EntitySuggestionsChip from "@/components/EntitySuggestionsChip";
import type { GenerationMode } from "@/lib/modes/registry";

const StoryHealthPanel  = dynamic(() => import("@/components/panels/StoryHealthPanel").then(m => ({ default: m.StoryHealthPanel })), { ssr: false });
const ExportPanel       = dynamic(() => import("@/components/panels/ExportPanel").then(m => ({ default: m.ExportPanel })), { ssr: false });
const AltDraftPanel     = dynamic(() => import("@/components/panels/toolbar/tools/AltDraftPanel").then(m => ({ default: m.AltDraftPanel })), { ssr: false });
const SprintMode        = dynamic(() => import("@/components/SprintMode").then(m => ({ default: m.SprintMode })), { ssr: false });
const UpgradePrompt     = dynamic(() => import("@/components/upgrade/UpgradePrompt").then(m => ({ default: m.UpgradePrompt })), { ssr: false });
const CommandPalette    = dynamic(() => import("@/components/CommandPalette").then(m => ({ default: m.CommandPalette })), { ssr: false });
const QualityReviewPanel = dynamic(() => import("@/components/panels/QualityReviewPanel").then(m => ({ default: m.QualityReviewPanel })), { ssr: false });
const WorldBiblePanel    = dynamic(() => import("@/components/panels/WorldBiblePanel"), { ssr: false });
const ToolbarPanel       = dynamic(() => import("@/components/panels/ToolbarPanel"), { ssr: false });
const StoryBible         = dynamic(() => import("@/components/StoryBible"), { ssr: false });
const ChapterPlanPanel  = dynamic(() => import("@/components/ChapterPlanPanel"), { ssr: false });

export default function GhostWriterApp({ projectId }: { projectId: string }) {
  const [mode, setMode] = useState("brainstorm");
  const [prompt, setPrompt] = useState("");
  const [expandedPrompt, setExpandedPrompt] = useState(false);
  const [showAgents, setShowAgents] = useState(false);
  const [showComicStudio, setShowComicStudio] = useState(false);
  const [showProductionStudio, setShowProductionStudio] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [storyBibleOpen, setStoryBibleOpen] = useState(false);
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
  const [showChapterPlan, setShowChapterPlan] = useState(false);
  const [chapterPlanChapterId, setChapterPlanChapterId] = useState<string | null>(null);
  const [deepLinkInsightsTab, setDeepLinkInsightsTab] = useState<"arc" | "tension" | null>(null);
  const [deepLinkStage, setDeepLinkStage] = useState<GuideStage | null>(null);
  const [storyHealthInitialTab, setStoryHealthInitialTab] = useState<"validator" | "dead-scenes" | "theme" | "tension" | "transport" | "promises" | "heatmap" | "checkpoints" | "audit">("validator");
  const [plannedChapterIds, setPlannedChapterIds] = useState<string[]>([]);
  const [showAltDraft, setShowAltDraft] = useState(false);
  const [showSprintMode, setShowSprintMode] = useState(false);
  const [skillSuggestion, setSkillSuggestion] = useState<SkillSuggestion | null>(null);
  const [activeInfluence, setActiveInfluence] = useState<any | null>(null);
  const [activePatterns, setActivePatterns] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<{ status: string; currentPeriodEnd: string | null; emailVerified?: boolean } | null>(null);
  const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const insertIntoEditorRef = useRef<((text: string) => void) | null>(null);
  const autoFireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/subscription').then(r => r.json()).then(setSubscription).catch(() => {});
  }, []);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/story-plans`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        const plans = Array.isArray(data?.plans) ? data.plans : [];
        const ids = plans
          .filter((p: any) => p.kind === "chapter_plan")
          .map((p: any) => p.beats?.[0]?.chapterId)
          .filter((id: unknown): id is string => typeof id === "string");
        setPlannedChapterIds(ids);
      })
      .catch(() => {});
  }, [projectId]);

  function getTrialDaysLeft(trialEnd: string | null): number | null {
    if (!trialEnd) return null;
    const diff = Math.ceil((new Date(trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }

  const trialDaysLeft = subscription?.status === 'trialing'
    ? getTrialDaysLeft(subscription.currentPeriodEnd)
    : null;

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

  // The writing room starts with the left (toolbar) panel collapsed — it's reached
  // on demand via the Actions drawer, not always-visible.
  useEffect(() => {
    setLeftCollapsed(true);
  }, []);

  const projectState = useProjectState(projectId);
  const {
    project, loadError,
    setErrorMsg,
    confirmModal, setConfirmModal,
    segmindKey, savedMsg, setSavedMsg,
    dialogueCharA, setDialogueCharA,
    dialogueCharB, setDialogueCharB,
  } = projectState;

  const activeChap = project?.chapters?.find((c: any) => c.id === project.activeChapter)
    || project?.chapters?.[0]
    || { id: "", title: "Chapter 1", content: "", summary: "" };

  const guideAction = useMemo(() => nextAction({
    format: project?.format ?? "",
    controllingIdea: project?.controllingIdea,
    characters: project?.characters || [],
    chapters: project?.chapters || [],
    dismissedGuideIds: project?.dismissedGuideIds,
    plannedChapterIds,
  }), [project?.format, project?.controllingIdea, project?.characters, project?.chapters, project?.dismissedGuideIds, plannedChapterIds]);

  // Default to "write" unless the Actions overlay is open for a mode the user picked
  // via the slash menu (see handleSelectMode below).
  const effectiveMode = actionsOpen ? mode : "write";
  const effectivePrompt = effectiveMode === "write"
    ? (prompt.trim() || guideAction?.run.prompt || "Continue this scene.")
    : prompt;

  const handleSelectMode = (selected: GenerationMode) => {
    setMode(selected);
    if (selected !== "write") setActionsOpen(true);
  };

  // Studio (/project/[id]/studio) is a separate route and navigates back here with a
  // one-shot query param to dispatch a confirmed capability run through this
  // component's own state — the project's one execution path, never a parallel one.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const studioMode = params.get("studioMode");
    const studioOpen = params.get("studioOpen");
    if (studioMode) {
      setMode(studioMode);
      setActionsOpen(true);
    } else if (studioOpen === "comic") {
      setShowComicStudio(true);
      setActionsOpen(true);
    } else if (studioOpen === "production") {
      setShowProductionStudio(true);
      setActionsOpen(true);
    } else if (studioOpen === "insights") {
      const tab = params.get("tab");
      setDeepLinkInsightsTab(tab === "arc" || tab === "tension" ? tab : "arc");
    } else if (studioOpen === "story-health") {
      setStoryHealthInitialTab("validator");
      setShowStoryHealth(true);
    } else if (studioOpen === "polish") {
      setDeepLinkStage("polish");
    } else if (studioOpen === "actions") {
      setActionsOpen(true);
    }
    window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aiActions = useAIActions({
    project: project || {},
    mode: effectiveMode,
    prompt: effectivePrompt,
    activeChap,
    updateChapter: projectState.updateChapter,
    updateProject: projectState.updateProject,
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
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', gap: 12, padding: 24,
      background: '#0d0d10', color: '#f2f2f3',
    }}>
      <div style={{ fontSize: 32 }}>⚠️</div>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Could not load project</h2>
      <p style={{ fontSize: 14, color: '#9898a6', textAlign: 'center', maxWidth: 320, margin: 0, lineHeight: 1.6 }}>
        This is usually caused by a connection issue. Your work is saved.
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '10px 24px', borderRadius: 8, background: '#d97706', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          Try again
        </button>
        <a
          href="/dashboard"
          style={{ padding: '10px 24px', borderRadius: 8, background: 'transparent', color: '#9898a6', border: '1px solid rgba(255,255,255,0.1)', textDecoration: 'none', fontWeight: 600 }}
        >
          Dashboard
        </a>
      </div>
    </div>
  );

  if (!project) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui" }}>Loading...</div>
  );

  const handleGuideRun = (action: GuideAction) => {
    if (autoFireTimerRef.current) { clearTimeout(autoFireTimerRef.current); autoFireTimerRef.current = null; }
    fetch("/api/events", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "guide_clicked", properties: { actionId: action.id, stage: action.stage } }),
    }).catch(() => {});

    const { mode: runMode, prompt: runPrompt, chapterId: runChapterId } = action.run;
    if (runMode === "story_health") { setShowStoryHealth(true); return; }
    if (runMode === "export") { setShowExport(true); return; }
    if (runMode === "plan_chapter") {
      setChapterPlanChapterId(runChapterId ?? null);
      setShowChapterPlan(true);
      // Switch the active chapter now, mirroring the draft-rung branch below —
      // otherwise "Draft this chapter →" in the panel generates into whatever
      // chapter was already active, not the one that was just planned.
      if (runChapterId && runChapterId !== project.activeChapter) {
        projectState.updateProject((p: any) => ({ ...p, activeChapter: runChapterId }));
      }
      return;
    }
    setMode(runMode);
    setPrompt(runPrompt ?? "");
    if (runChapterId && runChapterId !== project.activeChapter) {
      projectState.updateProject((p: any) => ({ ...p, activeChapter: runChapterId }));
    }

    if (resolveInitiative(project.aiInitiative).autoFires) {
      autoFireTimerRef.current = setTimeout(() => {
        autoFireTimerRef.current = null;
        aiActions.generate({ insertViaEditor: insertIntoEditorRef.current ?? undefined });
      }, 4000);
    }
  };

  const handleGuideDismiss = (id: string) => {
    if (autoFireTimerRef.current) { clearTimeout(autoFireTimerRef.current); autoFireTimerRef.current = null; }
    fetch("/api/events", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "guide_dismissed", properties: { actionId: id } }),
    }).catch(() => {});

    const next = [...(project.dismissedGuideIds ?? []), id];
    projectState.updateProject((p: any) => ({ ...p, dismissedGuideIds: next }));
    fetch(`/api/projects/${project.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissedGuideIds: next }),
    }).catch(() => {});
  };

  const toolbarPanelElement = (
    <ToolbarPanel
      project={project}
      segmindKey={segmindKey}
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
      expandBeat={aiActions.expandBeat}
      insertIntoEditor={insertIntoEditorRef.current ?? undefined}
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
      generateInterrogation={aiActions.generateInterrogation}
      generateChase={aiActions.generateChase}
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
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "'Inter',system-ui,sans-serif", background: co.bg, color: co.text, overflow: "hidden" }}>
      {trialDaysLeft !== null && (
        <div style={{ background: 'rgba(217,119,6,0.1)', borderBottom: '1px solid rgba(217,119,6,0.2)', padding: '7px 16px', fontSize: 12, textAlign: 'center', color: '#d97706', flexShrink: 0 }}>
          {trialDaysLeft > 0
            ? <><strong>{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} left</strong> in your free trial — you have full Story Pro access.{' '}<a href="/settings" style={{ color: '#d97706', fontWeight: 700 }}>Upgrade to keep it →</a></>
            : <>Your trial has ended.{' '}<a href="/settings" style={{ color: '#d97706', fontWeight: 700 }}>Upgrade to continue →</a></>
          }
        </div>
      )}
      {subscription?.emailVerified === false && !verifyBannerDismissed && (
        <div style={{ background: 'rgba(79,70,229,0.1)', borderBottom: '1px solid rgba(79,70,229,0.2)', padding: '7px 16px', fontSize: 12, textAlign: 'center', color: '#4F46E5', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <span>Verify your email to secure your account.</span>
          <button
            onClick={async () => {
              setResendingVerification(true);
              try {
                await fetch('/api/auth/resend-verification', { method: 'POST' });
                setResendSent(true);
              } finally {
                setResendingVerification(false);
              }
            }}
            disabled={resendingVerification || resendSent}
            style={{ background: 'none', border: '1px solid #4F46E5', color: '#4F46E5', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >
            {resendSent ? 'Sent!' : resendingVerification ? 'Sending…' : 'Resend email'}
          </button>
          <button
            onClick={() => setVerifyBannerDismissed(true)}
            style={{ background: 'none', border: 'none', color: '#4F46E5', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      {(() => {
        const init = resolveInitiative(project.aiInitiative);
        const next = init.mode === "Leads" ? "Collaborates" : init.mode === "Collaborates" ? "Assists" : "Leads";
        const cycle = () => {
          projectState.updateProject((p: any) => ({ ...p, aiInitiative: next }));
          fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aiInitiative: next }) });
        };
        return (
          <button onClick={cycle} title={`${init.description} (click → AI ${next})`} style={{ ...sBtnSm, alignSelf: "flex-start", margin: "6px 0 0 12px" }}>
            ⚡ {init.label}
          </button>
        );
      })()}
      {!resolveInitiative(project.aiInitiative).hidesGuide && <GuideBar action={guideAction} onRun={handleGuideRun} onDismiss={handleGuideDismiss} />}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {aiActions.violationBanner && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, background: "#92400e", color: "#fef3c7", padding: "12px 20px", zIndex: 1999, borderBottom: "1px solid #d97706" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>⚠ Craft Notice — Read before generating</div>
          <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>{aiActions.violationBanner.flagMessage}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => aiActions.confirmViolation(aiActions.violationBanner!.violationType, "intentional choice", insertIntoEditorRef.current ?? undefined)}
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

      <WritingRoom
        project={project}
        activeChap={activeChap}
        updateProject={projectState.updateProject}
        updateChapter={projectState.updateChapter}
        generating={aiActions.generating}
        generate={aiActions.generate}
        onOpenBible={() => setStoryBibleOpen(true)}
        onOpenActions={() => setActionsOpen(true)}
        prompt={prompt}
        setPrompt={setPrompt}
        onSelectMode={handleSelectMode}
        onGuideRun={handleGuideRun}
        onGuideDismiss={handleGuideDismiss}
        qualityReview={aiActions.qualityReview}
        onOpenProductionStudio={() => { setShowProductionStudio(true); setActionsOpen(true); }}
        onOpenComicStudio={() => { setShowComicStudio(true); setActionsOpen(true); }}
        onOpenStoryHealth={(tab) => { setStoryHealthInitialTab(tab); setShowStoryHealth(true); }}
        deepLinkInsightsTab={deepLinkInsightsTab}
        deepLinkStage={deepLinkStage}
        mode={mode}
        setSavedMsg={setSavedMsg}
        onUpgradeRequired={(f) => setUpgradeRequired(f as FeatureGate)}
        onRegisterInsert={(fn) => { insertIntoEditorRef.current = fn; }}
        activeInfluence={activeInfluence}
        onClearInfluence={() => setActiveInfluence(null)}
        addChapter={projectState.addChapter}
      />
      {actionsOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 1500, display: "flex", justifyContent: "flex-end" }}
          onClick={() => setActionsOpen(false)}
        >
          <div
            style={{ width: 420, maxWidth: "100%", height: "100%", background: co.surface, overflow: "auto", position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActionsOpen(false)}
              style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", fontSize: 22, lineHeight: 1, cursor: "pointer", color: co.muted, zIndex: 1 }}
              aria-label="Close"
            >
              ×
            </button>
            {toolbarPanelElement}
          </div>
        </div>
      )}

      <StoryBible
        project={project}
        updateProject={projectState.updateProject}
        open={storyBibleOpen}
        onClose={() => setStoryBibleOpen(false)}
        onOpenAdvanced={() => { setStoryBibleOpen(false); setLeftCollapsed(false); }}
        setConfirmModal={setConfirmModal}
      />

      <EntitySuggestionsChip
        suggestions={aiActions.entitySuggestions}
        onAccept={aiActions.acceptEntitySuggestion}
        onReject={aiActions.rejectEntitySuggestion}
      />

      {showStoryHealth && (
        <StoryHealthPanel
          key={storyHealthInitialTab}
          project={project}
          projectId={project.id}
          activeChapContent={activeChap?.content || ""}
          onClose={() => setShowStoryHealth(false)}
          onApplyFix={(content: string) => projectState.updateChapter("content", content)}
          initialTab={storyHealthInitialTab}
        />
      )}

      {showExport && (
        <ExportPanel
          projectId={project.id}
          projectFormat={project.format}
          onClose={() => setShowExport(false)}
        />
      )}

      {showChapterPlan && chapterPlanChapterId && (
        <ChapterPlanPanel
          projectId={project.id}
          chapterId={chapterPlanChapterId}
          chapterTitle={project.chapters?.find((c: any) => c.id === chapterPlanChapterId)?.title ?? "Chapter"}
          onClose={() => setShowChapterPlan(false)}
          onSelectMode={(m) => setMode(m)}
          setPrompt={setPrompt}
          onDismissGuide={() => handleGuideDismiss(`plan-chapter-${chapterPlanChapterId}`)}
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

      {aiActions.qualityReview && (
        <QualityReviewPanel
          review={aiActions.qualityReview}
          onDismiss={() => aiActions.setQualityReview(null)}
          project={project}
        />
      )}

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

      <ToastContainer />
      </div>
    </div>
  );
}
