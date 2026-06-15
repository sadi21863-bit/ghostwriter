"use client";
import { useState, useRef } from "react";
import { toast } from "@/lib/toast";
import { buildStaticContext, buildDynamicContext, buildBeginnerContext, buildCreatorContext } from "@/lib/ai/context-builder";
import { isCreatorFormat } from "@/lib/formats";
import { MODE_REGISTRY, type GenerationMode } from "@/lib/modes/registry";
import type { CompositionLayer } from "@/lib/ai/composer";
import { getWordCount } from "@/lib/editor/content-migration";
import { parseBeatList } from "@/lib/modes/beats";
import { appendToTipTap, buildNeighbourContext, callAI } from "./ai-shared";

export function useGeneration({
  project, mode, prompt, activeChap,
  updateChapter, updateProject, setUpgradeRequired,
  creatorBible, cohostVoice,
  activeInfluence, activePatterns, writingRoomEnabled,
  setUndoStack, setStreamText, buildFullContext,
  runQualityCheck, runEntityExtraction,
}: {
  project: any; mode: string; prompt: string; activeChap: any;
  updateChapter: (f: string, v: any) => void;
  updateProject?: (fn: (p: any) => any) => void;
  setUpgradeRequired?: (feature: string) => void;
  creatorBible: any;
  cohostVoice?: string;
  activeInfluence?: any;
  activePatterns?: any[];
  writingRoomEnabled?: boolean;
  setUndoStack: React.Dispatch<React.SetStateAction<string[]>>;
  setStreamText: React.Dispatch<React.SetStateAction<string>>;
  buildFullContext: (p?: any) => string;
  runQualityCheck: (output: string, projectId: string) => Promise<void>;
  runEntityExtraction: (text: string) => Promise<void>;
}) {
  const lastGenRef = useRef<{ fn: () => Promise<void> } | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 2;

  const [generating, setGenerating] = useState(false);
  const [genTarget, setGenTarget] = useState("");
  const [hookScore, setHookScore] = useState<{ score: number; feedback: string } | null>(null);
  const [hookScoring, setHookScoring] = useState(false);
  const [violationBanner, setViolationBanner] = useState<{ violationType: string; flagMessage: string; supportMode: string } | null>(null);

  const generate = async (opts?: { cameraPresetId?: string; referencePassage?: string; additionalContext?: string }) => {
    if (!prompt.trim()) return;
    retryCountRef.current = 0;
    lastGenRef.current = { fn: () => generate(opts) };
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const isCohost = mode === "cohost";
      const effectiveMode = isCohost ? "write" : mode;
      const effectiveFormat = isCohost ? "Podcast Episode (Co-host)" : project.format;
      const effectivePrompt = isCohost && cohostVoice
        ? `${prompt}\n\nCo-host voice persona: ${cohostVoice}`
        : prompt;

      const extended = { ...project, activeMode: effectiveMode, currentPrompt: effectivePrompt, activeInfluence, activePatterns };
      let staticCtx: string;
      let dynamicCtx: string;
      if (isCreatorFormat(project.format)) {
        staticCtx = buildCreatorContext({ ...extended, creatorBible });
        dynamicCtx = '';
      } else if (project.skillLevel === 'beginner') {
        staticCtx = buildBeginnerContext(extended);
        dynamicCtx = '';
      } else {
        staticCtx = buildStaticContext(extended);
        dynamicCtx = buildDynamicContext(extended);
      }
      const neighbourCtx = buildNeighbourContext(project);
      if (neighbourCtx) dynamicCtx += '\n\n' + neighbourCtx;

      if (opts?.cameraPresetId) {
        const { CAMERA_PRESETS, VIRAL_PRESETS } = await import('@/lib/higgsfield/presets');
        const preset = CAMERA_PRESETS[opts.cameraPresetId] ?? VIRAL_PRESETS[opts.cameraPresetId];
        if (preset) {
          dynamicCtx += [
            '',
            'CAMERA LANGUAGE MODE:',
            'Write this scene as prose that establishes clear visual grammar.',
            `Apply this camera perspective: ${preset.label}`,
            preset.promptInjection,
            'Describe action and space in terms that translate directly to shot descriptions.',
            'End each paragraph with a clear sense of where the camera is and what it sees.',
          ].join('\n');
        }
      }

      // Reference passage analysis — extract craft techniques before generation
      let additionalContext = opts?.additionalContext ?? '';
      if (opts?.referencePassage?.trim() && opts.referencePassage.length > 50) {
        try {
          const passageRes = await fetch('/api/ai/analyze-passage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passage: opts.referencePassage }),
          });
          const passageData = await passageRes.json();
          if (passageData.directives) additionalContext = additionalContext ? additionalContext + '\n\n' + passageData.directives : passageData.directives;
        } catch { /* passage analysis must never block generation */ }
      }

      const r = await callAI("generate", { mode: effectiveMode, prompt: effectivePrompt, staticContext: staticCtx, dynamicContext: dynamicCtx, format: effectiveFormat, projectId: project.id, chapterId: activeChap.id, narrativeStructure: (project as any).narrativeStructure, additionalContext: additionalContext || undefined });
      if (r.retryable) {
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          const retryFn = lastGenRef.current?.fn;
          toast.error(`AI is busy — retrying in 5 seconds... (${retryCountRef.current}/${MAX_RETRIES})`, {
            label: 'Retry now', onClick: () => { retryCountRef.current = MAX_RETRIES; retryFn?.(); },
          });
          setTimeout(() => retryFn?.(), 5000);
        } else {
          retryCountRef.current = 0;
          toast.error('AI rate limit reached. Please wait a moment before generating again.');
        }
      } else if (r.requiresConfirmation) { setViolationBanner({ violationType: r.violationType, flagMessage: r.flagMessage, supportMode: r.supportMode }); }
      else if (r.error === "upgrade_required") { setUpgradeRequired?.(r.feature); }
      else {
        if (mode === "write") {
          setUndoStack(s => [...s.slice(-9), activeChap.content]);
          const merged = appendToTipTap(activeChap.content, r.text);
          updateChapter("content", merged);
          updateChapter("wordCount", getWordCount(merged));
        } else {
          setStreamText(r.text);
          if (mode === "outline" && parseBeatList(r.text)) {
            updateProject?.((p: any) => ({ ...p, notes: r.text }));
            fetch(`/api/projects/${project.id}`, {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ notes: r.text }),
            }).catch(() => {});
          }
        }
        if (MODE_REGISTRY[mode as GenerationMode]?.qualityCheck && (project as any).qualityGradingEnabled) {
          runQualityCheck(r.text, project.id);
        }
        if (mode === "write" && writingRoomEnabled) {
          runEntityExtraction(r.text);
        }
      }
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (msg.includes('rate') || msg.includes('429') || msg.includes('529')) {
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          const retryFn = lastGenRef.current?.fn;
          toast.error(`AI is busy — retrying in 5 seconds... (${retryCountRef.current}/${MAX_RETRIES})`, {
            label: 'Retry now', onClick: () => { retryCountRef.current = MAX_RETRIES; retryFn?.(); },
          });
          setTimeout(() => retryFn?.(), 5000);
        } else {
          retryCountRef.current = 0;
          toast.error('AI rate limit reached. Please wait a moment before generating again.');
        }
      } else if (msg.includes('network') || msg.includes('fetch')) {
        toast.error('Connection lost. Check your internet and try again.');
      } else {
        toast.error('Generation failed. Your work is safe — try again.');
      }
    }
    setGenerating(false); setGenTarget("");
  };

  const expandBeat = async (beatText: string) => {
    const effectivePrompt = `Write this scene: ${beatText}`;
    const extended = { ...project, activeMode: 'write', currentPrompt: effectivePrompt, activeInfluence, activePatterns };
    let staticCtx: string;
    let dynamicCtx: string;
    if (isCreatorFormat(project.format)) {
      staticCtx = buildCreatorContext({ ...extended, creatorBible });
      dynamicCtx = '';
    } else if (project.skillLevel === 'beginner') {
      staticCtx = buildBeginnerContext(extended);
      dynamicCtx = '';
    } else {
      staticCtx = buildStaticContext(extended);
      dynamicCtx = buildDynamicContext(extended);
    }
    const neighbourCtx = buildNeighbourContext(project);
    if (neighbourCtx) dynamicCtx += '\n\n' + neighbourCtx;

    const r = await callAI("generate", { mode: 'write', prompt: effectivePrompt, staticContext: staticCtx, dynamicContext: dynamicCtx, format: project.format, projectId: project.id, chapterId: activeChap.id, narrativeStructure: (project as any).narrativeStructure });
    if (r.error || !r.text) {
      throw new Error(r.error || 'Expansion failed');
    }
    setUndoStack(s => [...s.slice(-9), activeChap.content]);
    const merged = appendToTipTap(activeChap.content, r.text);
    updateChapter("content", merged);
    updateChapter("wordCount", getWordCount(merged));
  };

  const autoSummarize = async () => {
    if (!activeChap.content) return;
    setGenerating(true); setGenTarget("summary");
    try { const r = await callAI("summarize", { content: activeChap.content }); updateChapter("summary", r.summary); }
    catch (e) { toast.error("Failed to summarize chapter. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateDialogue = async (charAId: string, charBId: string, dialoguePrompt: string, archetypeName = "Argument") => {
    if (!charAId || !charBId) { toast.error("Select both characters before generating dialogue."); return; }
    const p = project;
    const charA = p.characters?.find((c: any) => c.id === charAId);
    const charB = p.characters?.find((c: any) => c.id === charBId);
    if (!charA || !charB) return;
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const extended = { ...p, activeMode: 'dialogue', currentPrompt: dialoguePrompt, activeInfluence, activePatterns };
      const { buildDialogueContext } = await import('@/lib/dialogue');
      const libraryPrefix = buildDialogueContext(charA, charB, archetypeName) + "\n---\n";
      const staticCtx = libraryPrefix + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "dialogue", prompt: dialoguePrompt || `Write a ${archetypeName.toLowerCase()} scene between ${charA.name} and ${charB.name}.`, staticContext: staticCtx, dynamicContext: dynamicCtx, format: p.format }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) {
        setUndoStack(prev => [...prev.slice(-4), activeChap?.content || ""]);
        setStreamText(data.text);
      }
    } catch (e) { toast.error("Dialogue generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateInterrogation = async (interrogatorId: string, subjectId: string, goal: string, interrogationPrompt: string) => {
    if (!interrogatorId || !subjectId) { toast.error("Select both characters before generating."); return; }
    const p = project;
    const interrogator = p.characters?.find((c: any) => c.id === interrogatorId);
    const subject = p.characters?.find((c: any) => c.id === subjectId);
    if (!interrogator || !subject) return;
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const extended = { ...p, activeMode: 'interrogation', currentPrompt: interrogationPrompt, activeInfluence, activePatterns };
      const { buildInterrogationContext } = await import('@/lib/modes/interrogation');
      const libraryPrefix = buildInterrogationContext(interrogator.name, subject.name, '', '', goal || '') + "\n---\n";
      const staticCtx = libraryPrefix + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "interrogation", prompt: interrogationPrompt || `Write an interrogation scene where ${interrogator.name} interrogates ${subject.name}.`, staticContext: staticCtx, dynamicContext: dynamicCtx, format: p.format }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) { setUndoStack(prev => [...prev.slice(-4), activeChap?.content || ""]); setStreamText(data.text); }
    } catch (e) { toast.error("Interrogation generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateChase = async (pursuedId: string, pursuerId: string, terrain: string, stakes: string, chasePrompt: string) => {
    if (!pursuedId || !pursuerId) { toast.error("Select both characters before generating."); return; }
    const p = project;
    const pursued = p.characters?.find((c: any) => c.id === pursuedId);
    const pursuer = p.characters?.find((c: any) => c.id === pursuerId);
    if (!pursued || !pursuer) return;
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const extended = { ...p, activeMode: 'chase', currentPrompt: chasePrompt, activeInfluence, activePatterns };
      const { buildChaseContext } = await import('@/lib/modes/chase');
      const libraryPrefix = buildChaseContext(pursued.name, pursuer.name, terrain || 'unknown terrain', 'unknown', 'unknown', stakes || 'capture') + "\n---\n";
      const staticCtx = libraryPrefix + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "chase", prompt: chasePrompt || `Write a chase scene where ${pursuer.name} pursues ${pursued.name}.`, staticContext: staticCtx, dynamicContext: dynamicCtx, format: p.format }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) { setUndoStack(prev => [...prev.slice(-4), activeChap?.content || ""]); setStreamText(data.text); }
    } catch (e) { toast.error("Chase generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  // ---------------------------------------------------------------------
  // The 19 library-mode generators below share an identical flow: validate
  // an archetype/style param, build a library-specific context prefix, then
  // POST to /api/ai/generate. runLibraryGeneration() captures that flow;
  // each wrapper supplies only its mode-specific pieces.
  // ---------------------------------------------------------------------
  const runLibraryGeneration = async (opts: {
    modeKey: string;
    contextPrefix: string;
    prompt: string;
    defaultPrompt: string;
    errorMessage: string;
    includeIds?: boolean;
  }) => {
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const extended = { ...project, activeMode: opts.modeKey, currentPrompt: opts.prompt, activeInfluence, activePatterns };
      const staticCtx = opts.contextPrefix + "\n---\n" + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const body: Record<string, unknown> = { mode: opts.modeKey, prompt: opts.prompt || opts.defaultPrompt, staticContext: staticCtx, dynamicContext: dynamicCtx, format: project.format };
      if (opts.includeIds !== false) { body.projectId = project.id; body.chapterId = activeChap.id; }
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch { toast.error(opts.errorMessage); }
    setGenerating(false); setGenTarget("");
  };

  const generateCombat = async (styleA: string, styleB: string, combatPrompt: string) => {
    if (!styleA || !styleB) { toast.error("Select both fighting styles before generating."); return; }
    const { buildCombatContext } = await import('@/lib/combat');
    await runLibraryGeneration({
      modeKey: 'combat',
      contextPrefix: buildCombatContext(styleA, styleB),
      prompt: combatPrompt,
      defaultPrompt: `Write a fight scene between a ${styleA} fighter and a ${styleB} fighter.`,
      errorMessage: "Combat generation failed. Please try again.",
      includeIds: false,
    });
  };

  const generateEmotionalScene = async (emotionName: string, emotionalPrompt: string) => {
    if (!emotionName) { toast.error("Select an emotion before generating."); return; }
    const { buildEmotionalContext } = await import('@/lib/emotional');
    await runLibraryGeneration({
      modeKey: 'emotional',
      contextPrefix: buildEmotionalContext(emotionName),
      prompt: emotionalPrompt,
      defaultPrompt: `Write a scene that physicalizes ${emotionName}.`,
      errorMessage: "Emotional scene generation failed. Please try again.",
      includeIds: false,
    });
  };

  const generateAtmosphere = async (environmentName: string, atmospherePrompt: string) => {
    if (!environmentName) { toast.error("Select an environment before generating."); return; }
    const { buildAtmosphereContext } = await import('@/lib/atmosphere');
    await runLibraryGeneration({
      modeKey: 'atmosphere',
      contextPrefix: buildAtmosphereContext(environmentName),
      prompt: atmospherePrompt,
      defaultPrompt: `Write a scene set in a ${environmentName.toLowerCase()} environment.`,
      errorMessage: "Atmosphere generation failed. Please try again.",
      includeIds: false,
    });
  };

  const generateTension = async (tensionType: string, tensionPrompt: string) => {
    if (!tensionType) { toast.error("Select a tension type before generating."); return; }
    const { buildTensionContext } = await import('@/lib/tension');
    await runLibraryGeneration({
      modeKey: 'tension',
      contextPrefix: buildTensionContext(tensionType),
      prompt: tensionPrompt,
      defaultPrompt: `Write a scene using ${tensionType.toLowerCase()} tension structure.`,
      errorMessage: "Tension generation failed. Please try again.",
      includeIds: false,
    });
  };

  const generateHorror = async (archetypeName: string, horrorPrompt: string) => {
    if (!archetypeName) { toast.error("Select a horror archetype."); return; }
    const { buildHorrorContext } = await import('@/lib/horror');
    await runLibraryGeneration({
      modeKey: 'horror',
      contextPrefix: buildHorrorContext(archetypeName),
      prompt: horrorPrompt,
      defaultPrompt: `Write a ${archetypeName.toLowerCase()} horror scene.`,
      errorMessage: "Horror generation failed. Please try again.",
    });
  };

  const generateComedy = async (archetypeName: string, comedyPrompt: string) => {
    if (!archetypeName) { toast.error("Select a comedy archetype."); return; }
    const { buildComedyContext } = await import('@/lib/comedy');
    await runLibraryGeneration({
      modeKey: 'comedy',
      contextPrefix: buildComedyContext(archetypeName),
      prompt: comedyPrompt,
      defaultPrompt: `Write a ${archetypeName.toLowerCase()} comedy scene.`,
      errorMessage: "Comedy generation failed. Please try again.",
    });
  };

  const generateMystery = async (archetypeName: string, mysteryPrompt: string) => {
    if (!archetypeName) { toast.error("Select a mystery archetype."); return; }
    const { buildMysteryContext } = await import('@/lib/mystery');
    await runLibraryGeneration({
      modeKey: 'mystery',
      contextPrefix: buildMysteryContext(archetypeName),
      prompt: mysteryPrompt,
      defaultPrompt: `Write a ${archetypeName.toLowerCase()} mystery scene.`,
      errorMessage: "Mystery generation failed. Please try again.",
    });
  };

  const generateRomance = async (archetypeName: string, romancePrompt: string) => {
    if (!archetypeName) { toast.error("Select a romance archetype."); return; }
    const { buildRomanceContext } = await import('@/lib/romance');
    await runLibraryGeneration({
      modeKey: 'romance',
      contextPrefix: buildRomanceContext(archetypeName),
      prompt: romancePrompt,
      defaultPrompt: `Write a ${archetypeName.toLowerCase()} romance scene.`,
      errorMessage: "Romance generation failed. Please try again.",
    });
  };

  const generateMonologue = async (archetypeName: string, monologuePrompt: string) => {
    if (!archetypeName) { toast.error("Select a monologue archetype."); return; }
    const { buildMonologueContext } = await import('@/lib/monologue');
    await runLibraryGeneration({
      modeKey: 'monologue',
      contextPrefix: buildMonologueContext(archetypeName),
      prompt: monologuePrompt,
      defaultPrompt: `Write a ${archetypeName.toLowerCase()} interior monologue.`,
      errorMessage: "Monologue generation failed. Please try again.",
    });
  };

  const generateVoice = async (profileName: string, voicePrompt: string) => {
    if (!profileName) { toast.error("Select a voice profile."); return; }
    const { buildVoiceContext } = await import('@/lib/voice');
    await runLibraryGeneration({
      modeKey: 'voice',
      contextPrefix: buildVoiceContext(profileName),
      prompt: voicePrompt,
      defaultPrompt: `Write a scene using the ${profileName} voice profile.`,
      errorMessage: "Voice generation failed. Please try again.",
    });
  };

  const generateThriller = async (archetypeName: string, thrillerPrompt: string) => {
    if (!archetypeName) { toast.error("Select a thriller archetype."); return; }
    const { buildThrillerContext } = await import('@/lib/thriller');
    await runLibraryGeneration({
      modeKey: 'thriller',
      contextPrefix: buildThrillerContext(archetypeName),
      prompt: thrillerPrompt,
      defaultPrompt: `Write a ${archetypeName.toLowerCase()} thriller scene.`,
      errorMessage: "Thriller generation failed. Please try again.",
    });
  };

  const generateSports = async (archetypeName: string, sportsPrompt: string) => {
    if (!archetypeName) { toast.error("Select a sports archetype."); return; }
    const { buildSportsContext } = await import('@/lib/sports');
    await runLibraryGeneration({
      modeKey: 'sports',
      contextPrefix: buildSportsContext(archetypeName),
      prompt: sportsPrompt,
      defaultPrompt: `Write a ${archetypeName.toLowerCase()} sports scene.`,
      errorMessage: "Sports generation failed. Please try again.",
    });
  };

  const generateAction = async (archetypeName: string, actionPrompt: string) => {
    if (!archetypeName) { toast.error("Select an action archetype."); return; }
    const { buildActionContext } = await import('@/lib/action');
    await runLibraryGeneration({
      modeKey: 'action',
      contextPrefix: buildActionContext(archetypeName),
      prompt: actionPrompt,
      defaultPrompt: `Write a ${archetypeName.toLowerCase()} action scene.`,
      errorMessage: "Action generation failed. Please try again.",
    });
  };

  const generateSetting = async (archetypeName: string, settingPrompt: string) => {
    if (!archetypeName) { toast.error("Select a setting archetype."); return; }
    const { buildSettingContext } = await import('@/lib/setting');
    await runLibraryGeneration({
      modeKey: 'setting',
      contextPrefix: buildSettingContext(archetypeName),
      prompt: settingPrompt,
      defaultPrompt: `Write a scene using the ${archetypeName} setting archetype.`,
      errorMessage: "Setting generation failed. Please try again.",
    });
  };

  const generateHistorical = async (archetypeName: string, historicalPrompt: string) => {
    if (!archetypeName) { toast.error("Select a historical archetype."); return; }
    const { buildHistoricalContext } = await import('@/lib/historical');
    await runLibraryGeneration({
      modeKey: 'historical',
      contextPrefix: buildHistoricalContext(archetypeName),
      prompt: historicalPrompt,
      defaultPrompt: `Write a scene using the ${archetypeName} historical texture.`,
      errorMessage: "Historical generation failed. Please try again.",
    });
  };

  const generateScitech = async (archetypeName: string, scitechPrompt: string) => {
    if (!archetypeName) { toast.error("Select a science/technology archetype."); return; }
    const { buildScitechContext } = await import('@/lib/scitech');
    await runLibraryGeneration({
      modeKey: 'scitech',
      contextPrefix: buildScitechContext(archetypeName),
      prompt: scitechPrompt,
      defaultPrompt: `Write a scene using the ${archetypeName} science/technology archetype.`,
      errorMessage: "Scitech generation failed. Please try again.",
    });
  };

  const generateEthics = async (archetypeName: string, ethicsPrompt: string) => {
    if (!archetypeName) { toast.error("Select an ethics archetype."); return; }
    const { buildEthicsContext } = await import('@/lib/ethics');
    await runLibraryGeneration({
      modeKey: 'ethics',
      contextPrefix: buildEthicsContext(archetypeName),
      prompt: ethicsPrompt,
      defaultPrompt: `Write a scene using the ${archetypeName} moral archetype.`,
      errorMessage: "Ethics generation failed. Please try again.",
    });
  };

  const generateEndings = async (archetypeName: string, endingsPrompt: string) => {
    if (!archetypeName) { toast.error("Select an endings archetype."); return; }
    const { buildEndingsContext } = await import('@/lib/endings');
    await runLibraryGeneration({
      modeKey: 'endings',
      contextPrefix: buildEndingsContext(archetypeName),
      prompt: endingsPrompt,
      defaultPrompt: `Write a scene using the ${archetypeName} ending archetype.`,
      errorMessage: "Endings generation failed. Please try again.",
    });
  };

  const generateIsekai = async (archetypeName: string, isekaiPrompt: string) => {
    if (!archetypeName) { toast.error("Select an isekai subgenre."); return; }
    const { buildIsekaiContext } = await import('@/lib/isekai');
    await runLibraryGeneration({
      modeKey: 'isekai',
      contextPrefix: buildIsekaiContext(archetypeName),
      prompt: isekaiPrompt,
      defaultPrompt: `Write a ${archetypeName} isekai scene.`,
      errorMessage: "Isekai generation failed. Please try again.",
    });
  };

  const generateComposition = async (layers: CompositionLayer[], compositionPrompt: string) => {
    if (!layers.length) { toast.error("Select at least one layer before generating."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const { buildCompositionContext } = await import('@/lib/ai/composer');
      const { compactContext } = await import('@/lib/compact');
      const libraryCtx = buildCompositionContext(layers);
      const storyCtx = buildFullContext();
      const fullCtx = compactContext(libraryCtx + "\n\n---\n\n" + storyCtx);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "composition",
          prompt: compositionPrompt || "Write a scene using the active composition layers.",
          context: fullCtx,
          format: project.format,
          projectId: project.id,
          chapterId: activeChap.id,
        }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch (e) { toast.error("Composition generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const confirmViolation = async (violationType: string, purpose: string) => {
    setViolationBanner(null);
    if (!project.id) return;
    await fetch(`/api/projects/${project.id}/intentional-violation`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ violationType, purpose }),
    });
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const isCohost = mode === "cohost";
      const effectiveMode = isCohost ? "write" : mode;
      const effectiveFormat = isCohost ? "Podcast Episode (Co-host)" : project.format;
      const r = await callAI("generate", { mode: effectiveMode, prompt, context: buildFullContext(), format: effectiveFormat, projectId: project.id, chapterId: activeChap.id, bypassViolationCheck: true });
      if (r.error === "upgrade_required") { setUpgradeRequired?.(r.feature); }
      else if (mode === "write") {
        setUndoStack(s => [...s.slice(-9), activeChap.content]);
        const merged2 = appendToTipTap(activeChap.content, r.text);
        updateChapter("content", merged2);
        updateChapter("wordCount", getWordCount(merged2));
      } else setStreamText(r.text);
    } catch { toast.error("Generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const scoreHook = async () => {
    if (!prompt.trim() || hookScoring) return;
    setHookScoring(true); setHookScore(null);
    try {
      const res = await fetch("/api/ai/score-hook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hook: prompt, format: project.format }) });
      const data = await res.json();
      if (data.score != null) setHookScore(data);
    } catch (e) { toast.error("Hook scoring failed. Please try again."); }
    setHookScoring(false);
  };

  return {
    generating, setGenerating, genTarget, setGenTarget,
    hookScore, hookScoring,
    violationBanner, setViolationBanner,
    generate, expandBeat, autoSummarize,
    generateDialogue, generateInterrogation, generateChase,
    generateCombat, generateEmotionalScene, generateAtmosphere, generateTension, generateComposition,
    generateHorror, generateComedy, generateMystery, generateRomance, generateAction,
    generateMonologue, generateVoice, generateThriller, generateSports,
    generateSetting, generateHistorical, generateScitech, generateEthics, generateEndings,
    generateIsekai,
    confirmViolation, scoreHook,
  };
}
