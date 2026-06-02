"use client";
import { useState, useRef } from "react";

const QUALITY_CHECK_MODES = new Set([
  'write', 'emotional', 'combat', 'atmosphere', 'tension',
  'horror', 'mystery', 'romance', 'thriller', 'action', 'dialogue',
]);
import { toast } from "@/lib/toast";
import { buildStaticContext, buildDynamicContext, buildBeginnerContext, buildCreatorContext } from "@/lib/ai/context-builder";
import { getPipelines, type Pipeline } from "@/lib/ai/pipelines";
import { isCreatorFormat } from "@/lib/formats";
import { buildDialogueContext } from "@/lib/dialogue";
import { buildCombatContext } from "@/lib/combat";
import { buildEmotionalContext } from "@/lib/emotional";
import { buildAtmosphereContext } from "@/lib/atmosphere";
import { buildTensionContext } from "@/lib/tension";
import { buildCompositionContext, type CompositionLayer } from "@/lib/ai/composer";
import { compactContext } from "@/lib/compact";
import { buildHorrorContext } from "@/lib/horror";
import { buildComedyContext } from "@/lib/comedy";
import { buildMysteryContext } from "@/lib/mystery";
import { buildRomanceContext } from "@/lib/romance";
import { buildActionContext } from "@/lib/action";
import { buildMonologueContext } from "@/lib/monologue";
import { buildVoiceContext } from "@/lib/voice";
import { buildThrillerContext } from "@/lib/thriller";
import { buildSportsContext } from "@/lib/sports";
import { buildSettingContext } from "@/lib/setting";
import { buildHistoricalContext } from "@/lib/historical";
import { buildScitechContext } from "@/lib/scitech";
import { buildEthicsContext } from "@/lib/ethics";
import { buildEndingsContext } from "@/lib/endings";
import { buildIsekaiContext } from "@/lib/isekai";
import { plainTextToTipTap, isValidTipTapJson, getWordCount } from "@/lib/editor/content-migration";

function appendToTipTap(existingContent: string, newText: string): string {
  const existing = isValidTipTapJson(existingContent)
    ? JSON.parse(existingContent)
    : plainTextToTipTap(existingContent);
  const newDoc = plainTextToTipTap(newText) as any;
  return JSON.stringify({
    type: 'doc',
    content: [...((existing as any).content || []), ...(newDoc.content || [])],
  });
}

export function useAIActions({
  project, mode, prompt, activeChap,
  updateChapter, setErrorMsg, setSavedMsg,
  creatorBible, cohostVoice, setUpgradeRequired,
  activeInfluence, activePatterns,
}: {
  project: any; mode: string; prompt: string; activeChap: any;
  updateChapter: (f: string, v: any) => void;
  setErrorMsg: (msg: string | null) => void;
  setSavedMsg: (msg: string) => void;
  creatorBible: any;
  cohostVoice?: string;
  setUpgradeRequired?: (feature: string) => void;
  activeInfluence?: any;
  activePatterns?: any[];
}) {
  const lastGenRef = useRef<{ fn: () => Promise<void> } | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 2;

  const [generating, setGenerating] = useState(false);
  const [genTarget, setGenTarget] = useState("");
  const [streamText, setStreamText] = useState("");
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineResults, setPipelineResults] = useState<{ agent: string; output: string }[]>([]);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [proseResult, setProseResult] = useState<{ mode: string; variants?: string[]; result?: string; chosen?: number } | null>(null);
  const [proseLoading, setProseLoading] = useState(false);
  const [hookScore, setHookScore] = useState<{ score: number; feedback: string } | null>(null);
  const [hookScoring, setHookScoring] = useState(false);
  const [qualityReview, setQualityReview] = useState<any | null>(null);
  const [violationBanner, setViolationBanner] = useState<{ violationType: string; flagMessage: string; supportMode: string } | null>(null);

  const callAI = async (endpoint: string, body: any) => {
    const res = await fetch("/api/ai/" + endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.json();
  };

  const buildNeighbourContext = (p: any): string => {
    const activeIdx = p.chapters.findIndex((c: any) => c.id === p.activeChapter);
    const parts: string[] = [];
    const recent = p.chapters.slice(Math.max(0, activeIdx - 2), activeIdx).filter((c: any) => c.summary);
    if (recent.length) {
      parts.push("RECENT CHAPTERS:");
      recent.forEach((c: any) => {
        const typeLabel = c.chapterType && c.chapterType !== "chapter" ? ` [${c.chapterType}]` : "";
        const tagLabel = c.tags?.length ? ` (${c.tags.join(", ")})` : "";
        parts.push(`[${c.title}${typeLabel}${tagLabel}]: ${c.summary}`);
      });
    }
    const next = p.chapters[activeIdx + 1];
    if (next) parts.push(`NEXT CHAPTER: "${next.title}" (not yet written — maintain narrative momentum toward this)`);
    const distant = p.chapters.filter((c: any, i: number) => c.id !== p.activeChapter && i < activeIdx - 2);
    if (distant.length) parts.push("EARLIER CHAPTERS (titles only): " + distant.map((c: any) => c.title).join(", "));
    return parts.join("\n");
  };

  const buildFullContext = (p = project) => {
    const extended = { ...p, activeMode: mode, currentPrompt: prompt, activeInfluence, activePatterns };
    let base: string;
    if (isCreatorFormat(p.format)) { base = buildCreatorContext({ ...extended, creatorBible }); }
    else { base = p.skillLevel === "beginner" ? buildBeginnerContext(extended) : (buildStaticContext(extended) + '\n' + buildDynamicContext(extended)); }
    const neighbourContext = buildNeighbourContext(p);
    return neighbourContext ? base + "\n\n" + neighbourContext : base;
  };

  const generate = async (opts?: { cameraPresetId?: string }) => {
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

      const r = await callAI("generate", { mode: effectiveMode, prompt: effectivePrompt, staticContext: staticCtx, dynamicContext: dynamicCtx, format: effectiveFormat, projectId: project.id, chapterId: activeChap.id, narrativeStructure: (project as any).narrativeStructure });
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
        }
        if (QUALITY_CHECK_MODES.has(mode) && (project as any).qualityGradingEnabled) {
          runQualityCheck(r.text, project.id);
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

  const runQualityCheck = async (output: string, projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/quality-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          output,
          projectRules: project.aiRules?.map((r: any) => r.text) ?? [],
          involvedCharacters: project.characters
            ?.filter((c: any) => c.alwaysInContext !== false)
            ?.map((c: any) => ({
              name: c.name,
              knowledgeMap: c.knowledgeMap ?? {},
              nvcBaseline: c.kinesicsBaseline,
            })) ?? [],
          emotionalTone: activeChap.emotionalTone,
          arcPosition: activeChap.arcPosition,
        }),
      });
      const result = await res.json();
      if (result.hasIssues) setQualityReview(result);
    } catch { /* quality check must never break writing flow */ }
  };

  const undoGeneration = () => {
    if (!undoStack.length) return;
    updateChapter("content", undoStack[undoStack.length - 1]);
    setUndoStack(s => s.slice(0, -1));
  };

  const autoSummarize = async () => {
    if (!activeChap.content) return;
    setGenerating(true); setGenTarget("summary");
    try { const r = await callAI("summarize", { content: activeChap.content }); updateChapter("summary", r.summary); }
    catch (e) { toast.error("Failed to summarize chapter. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const runPipeline = async (pipeline: Pipeline) => {
    if (pipelineRunning || !prompt.trim()) return;
    setPipelineRunning(true); setActivePipelineId(pipeline.id); setPipelineResults([]); setExpandedAgent(null);
    try {
      const res = await fetch("/api/ai/pipeline", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agents: pipeline.agents, prompt, context: buildFullContext(), format: project.format }),
      });
      const data = await res.json();
      if (data.results?.length) { setPipelineResults(data.results); setExpandedAgent(data.results[data.results.length - 1].agent); }
    } catch (e) { toast.error("Agent pipeline failed. Please try again."); }
    setPipelineRunning(false);
  };

  const usePipelineOutput = (output: string) => {
    if (mode === "write") {
      setUndoStack(s => [...s.slice(-9), activeChap.content]);
      const merged = appendToTipTap(activeChap.content, output);
      updateChapter("content", merged);
      updateChapter("wordCount", getWordCount(merged));
    } else { setStreamText(output); }
    setPipelineResults([]);
  };

  const handleTextareaSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const selected = el.value.substring(el.selectionStart, el.selectionEnd);
    if (selected.trim().length > 10) { setSelectedText(selected); setSelectedRange({ start: el.selectionStart, end: el.selectionEnd }); }
    else { setSelectedText(""); setSelectedRange(null); }
  };

  const runProse = async (proseMode: string) => {
    if (!selectedText || proseLoading) return;
    setProseLoading(true); setProseResult(null);
    try {
      const res = await fetch("/api/ai/prose", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText, mode: proseMode, projectContext: buildFullContext(), activeMode: mode }),
      });
      const data = await res.json();
      setProseResult({ mode: proseMode, ...data, chosen: 0 });
    } catch (e) { toast.error("Prose tool failed. Please try again."); }
    setProseLoading(false);
  };

  const replaceSelection = (newText: string) => {
    if (!selectedRange) return;
    const content = activeChap.content || "";
    const updated = content.substring(0, selectedRange.start) + newText + content.substring(selectedRange.end);
    updateChapter("content", updated);
    setProseResult(null); setSelectedText(""); setSelectedRange(null);
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

  const generateCombat = async (styleA: string, styleB: string, combatPrompt: string) => {
    if (!styleA || !styleB) { toast.error("Select both fighting styles before generating."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const extended = { ...project, activeMode: 'combat', currentPrompt: combatPrompt, activeInfluence, activePatterns };
      const staticCtx = buildCombatContext(styleA, styleB) + "\n---\n" + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "combat", prompt: combatPrompt || `Write a fight scene between a ${styleA} fighter and a ${styleB} fighter.`, staticContext: staticCtx, dynamicContext: dynamicCtx, format: project.format }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch (e) { toast.error("Combat generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateEmotionalScene = async (emotionName: string, emotionalPrompt: string) => {
    if (!emotionName) { toast.error("Select an emotion before generating."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const extended = { ...project, activeMode: 'emotional', currentPrompt: emotionalPrompt, activeInfluence, activePatterns };
      const staticCtx = buildEmotionalContext(emotionName) + "\n---\n" + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "emotional", prompt: emotionalPrompt || `Write a scene that physicalizes ${emotionName}.`, staticContext: staticCtx, dynamicContext: dynamicCtx, format: project.format }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch (e) { toast.error("Emotional scene generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateAtmosphere = async (environmentName: string, atmospherePrompt: string) => {
    if (!environmentName) { toast.error("Select an environment before generating."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const extended = { ...project, activeMode: 'atmosphere', currentPrompt: atmospherePrompt, activeInfluence, activePatterns };
      const staticCtx = buildAtmosphereContext(environmentName) + "\n---\n" + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "atmosphere", prompt: atmospherePrompt || `Write a scene set in a ${environmentName.toLowerCase()} environment.`, staticContext: staticCtx, dynamicContext: dynamicCtx, format: project.format }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch (e) { toast.error("Atmosphere generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateTension = async (tensionType: string, tensionPrompt: string) => {
    if (!tensionType) { toast.error("Select a tension type before generating."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const extended = { ...project, activeMode: 'tension', currentPrompt: tensionPrompt, activeInfluence, activePatterns };
      const staticCtx = buildTensionContext(tensionType) + "\n---\n" + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "tension", prompt: tensionPrompt || `Write a scene using ${tensionType.toLowerCase()} tension structure.`, staticContext: staticCtx, dynamicContext: dynamicCtx, format: project.format }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch (e) { toast.error("Tension generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateHorror = async (archetypeName: string, horrorPrompt: string) => {
    if (!archetypeName) { toast.error("Select a horror archetype."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const extended = { ...project, activeMode: 'horror', currentPrompt: horrorPrompt, activeInfluence, activePatterns };
      const staticCtx = buildHorrorContext(archetypeName) + "\n---\n" + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "horror", prompt: horrorPrompt || `Write a ${archetypeName.toLowerCase()} horror scene.`, staticContext: staticCtx, dynamicContext: dynamicCtx, format: project.format, projectId: project.id, chapterId: activeChap.id }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch { toast.error("Horror generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateComedy = async (archetypeName: string, comedyPrompt: string) => {
    if (!archetypeName) { toast.error("Select a comedy archetype."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const extended = { ...project, activeMode: 'comedy', currentPrompt: comedyPrompt, activeInfluence, activePatterns };
      const staticCtx = buildComedyContext(archetypeName) + "\n---\n" + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "comedy", prompt: comedyPrompt || `Write a ${archetypeName.toLowerCase()} comedy scene.`, staticContext: staticCtx, dynamicContext: dynamicCtx, format: project.format, projectId: project.id, chapterId: activeChap.id }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch { toast.error("Comedy generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateMystery = async (archetypeName: string, mysteryPrompt: string) => {
    if (!archetypeName) { toast.error("Select a mystery archetype."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const extended = { ...project, activeMode: 'mystery', currentPrompt: mysteryPrompt, activeInfluence, activePatterns };
      const staticCtx = buildMysteryContext(archetypeName) + "\n---\n" + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "mystery", prompt: mysteryPrompt || `Write a ${archetypeName.toLowerCase()} mystery scene.`, staticContext: staticCtx, dynamicContext: dynamicCtx, format: project.format, projectId: project.id, chapterId: activeChap.id }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch { toast.error("Mystery generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateRomance = async (archetypeName: string, romancePrompt: string) => {
    if (!archetypeName) { toast.error("Select a romance archetype."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const extended = { ...project, activeMode: 'romance', currentPrompt: romancePrompt, activeInfluence, activePatterns };
      const staticCtx = buildRomanceContext(archetypeName) + "\n---\n" + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "romance", prompt: romancePrompt || `Write a ${archetypeName.toLowerCase()} romance scene.`, staticContext: staticCtx, dynamicContext: dynamicCtx, format: project.format, projectId: project.id, chapterId: activeChap.id }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch { toast.error("Romance generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateMonologue = async (archetypeName: string, monologuePrompt: string) => {
    if (!archetypeName) { toast.error("Select a monologue archetype."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const extended = { ...project, activeMode: 'monologue', currentPrompt: monologuePrompt, activeInfluence, activePatterns };
      const staticCtx = buildMonologueContext(archetypeName) + "\n---\n" + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "monologue", prompt: monologuePrompt || `Write a ${archetypeName.toLowerCase()} interior monologue.`, staticContext: staticCtx, dynamicContext: dynamicCtx, format: project.format, projectId: project.id, chapterId: activeChap.id }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch { toast.error("Monologue generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateVoice = async (profileName: string, voicePrompt: string) => {
    if (!profileName) { toast.error("Select a voice profile."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const extended = { ...project, activeMode: 'voice', currentPrompt: voicePrompt, activeInfluence, activePatterns };
      const staticCtx = buildVoiceContext(profileName) + "\n---\n" + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "voice", prompt: voicePrompt || `Write a scene using the ${profileName} voice profile.`, staticContext: staticCtx, dynamicContext: dynamicCtx, format: project.format, projectId: project.id, chapterId: activeChap.id }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch { toast.error("Voice generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateThriller = async (archetypeName: string, thrillerPrompt: string) => {
    if (!archetypeName) { toast.error("Select a thriller archetype."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const extended = { ...project, activeMode: 'thriller', currentPrompt: thrillerPrompt, activeInfluence, activePatterns };
      const staticCtx = buildThrillerContext(archetypeName) + "\n---\n" + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "thriller", prompt: thrillerPrompt || `Write a ${archetypeName.toLowerCase()} thriller scene.`, staticContext: staticCtx, dynamicContext: dynamicCtx, format: project.format, projectId: project.id, chapterId: activeChap.id }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch { toast.error("Thriller generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateSports = async (archetypeName: string, sportsPrompt: string) => {
    if (!archetypeName) { toast.error("Select a sports archetype."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const extended = { ...project, activeMode: 'sports', currentPrompt: sportsPrompt, activeInfluence, activePatterns };
      const staticCtx = buildSportsContext(archetypeName) + "\n---\n" + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "sports", prompt: sportsPrompt || `Write a ${archetypeName.toLowerCase()} sports scene.`, staticContext: staticCtx, dynamicContext: dynamicCtx, format: project.format, projectId: project.id, chapterId: activeChap.id }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch { toast.error("Sports generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateAction = async (archetypeName: string, actionPrompt: string) => {
    if (!archetypeName) { toast.error("Select an action archetype."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const extended = { ...project, activeMode: 'action', currentPrompt: actionPrompt, activeInfluence, activePatterns };
      const staticCtx = buildActionContext(archetypeName) + "\n---\n" + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "action", prompt: actionPrompt || `Write a ${archetypeName.toLowerCase()} action scene.`, staticContext: staticCtx, dynamicContext: dynamicCtx, format: project.format, projectId: project.id, chapterId: activeChap.id }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch { toast.error("Action generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateComposition = async (layers: CompositionLayer[], compositionPrompt: string) => {
    if (!layers.length) { toast.error("Select at least one layer before generating."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
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

  const generateSetting = async (archetypeName: string, settingPrompt: string) => {
    if (!archetypeName) { toast.error("Select a setting archetype."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const extended = { ...project, activeMode: 'setting', currentPrompt: settingPrompt, activeInfluence, activePatterns };
      const staticCtx = buildSettingContext(archetypeName) + "\n---\n" + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "setting", prompt: settingPrompt || `Write a scene using the ${archetypeName} setting archetype.`, staticContext: staticCtx, dynamicContext: dynamicCtx, format: project.format, projectId: project.id, chapterId: activeChap.id }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch { toast.error("Setting generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateHistorical = async (archetypeName: string, historicalPrompt: string) => {
    if (!archetypeName) { toast.error("Select a historical archetype."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const extended = { ...project, activeMode: 'historical', currentPrompt: historicalPrompt, activeInfluence, activePatterns };
      const staticCtx = buildHistoricalContext(archetypeName) + "\n---\n" + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "historical", prompt: historicalPrompt || `Write a scene using the ${archetypeName} historical texture.`, staticContext: staticCtx, dynamicContext: dynamicCtx, format: project.format, projectId: project.id, chapterId: activeChap.id }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch { toast.error("Historical generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateScitech = async (archetypeName: string, scitechPrompt: string) => {
    if (!archetypeName) { toast.error("Select a science/technology archetype."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const extended = { ...project, activeMode: 'scitech', currentPrompt: scitechPrompt, activeInfluence, activePatterns };
      const staticCtx = buildScitechContext(archetypeName) + "\n---\n" + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "scitech", prompt: scitechPrompt || `Write a scene using the ${archetypeName} science/technology archetype.`, staticContext: staticCtx, dynamicContext: dynamicCtx, format: project.format, projectId: project.id, chapterId: activeChap.id }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch { toast.error("Scitech generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateEthics = async (archetypeName: string, ethicsPrompt: string) => {
    if (!archetypeName) { toast.error("Select an ethics archetype."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const extended = { ...project, activeMode: 'ethics', currentPrompt: ethicsPrompt, activeInfluence, activePatterns };
      const staticCtx = buildEthicsContext(archetypeName) + "\n---\n" + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "ethics", prompt: ethicsPrompt || `Write a scene using the ${archetypeName} moral archetype.`, staticContext: staticCtx, dynamicContext: dynamicCtx, format: project.format, projectId: project.id, chapterId: activeChap.id }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch { toast.error("Ethics generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateEndings = async (archetypeName: string, endingsPrompt: string) => {
    if (!archetypeName) { toast.error("Select an endings archetype."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const extended = { ...project, activeMode: 'endings', currentPrompt: endingsPrompt, activeInfluence, activePatterns };
      const staticCtx = buildEndingsContext(archetypeName) + "\n---\n" + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "endings", prompt: endingsPrompt || `Write a scene using the ${archetypeName} ending archetype.`, staticContext: staticCtx, dynamicContext: dynamicCtx, format: project.format, projectId: project.id, chapterId: activeChap.id }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch { toast.error("Endings generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateIsekai = async (archetypeName: string, isekaiPrompt: string) => {
    if (!archetypeName) { toast.error("Select an isekai subgenre."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const extended = { ...project, activeMode: 'isekai', currentPrompt: isekaiPrompt, activeInfluence, activePatterns };
      const staticCtx = buildIsekaiContext(archetypeName) + "\n---\n" + buildStaticContext(extended);
      const dynamicCtx = buildDynamicContext(extended);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "isekai", prompt: isekaiPrompt || `Write a ${archetypeName} isekai scene.`, staticContext: staticCtx, dynamicContext: dynamicCtx, format: project.format, projectId: project.id, chapterId: activeChap.id }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch { toast.error("Isekai generation failed. Please try again."); }
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
    streamText, setStreamText,
    undoStack,
    pipelineRunning, pipelineResults, setPipelineResults, expandedAgent, setExpandedAgent, activePipelineId,
    selectedText, setSelectedText, selectedRange, setSelectedRange,
    proseResult, setProseResult, proseLoading,
    hookScore, hookScoring,
    qualityReview, setQualityReview,
    callAI, buildNeighbourContext, buildFullContext,
    generate, undoGeneration, autoSummarize, generateDialogue, generateCombat,
    generateEmotionalScene, generateAtmosphere, generateTension, generateComposition,
    generateHorror, generateComedy, generateMystery, generateRomance, generateAction,
    generateMonologue, generateVoice, generateThriller, generateSports,
    generateSetting, generateHistorical, generateScitech, generateEthics, generateEndings,
    generateIsekai,
    violationBanner, setViolationBanner, confirmViolation,
    runPipeline, usePipelineOutput,
    handleTextareaSelect, runProse, replaceSelection, scoreHook,
  };
}
