"use client";
import { useState } from "react";
import { buildContext, buildBeginnerContext, buildCreatorContext } from "@/lib/ai/context-builder";
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

export function useAIActions({
  project, mode, prompt, activeChap,
  updateChapter, setErrorMsg, setSavedMsg,
  creatorBible, cohostVoice, setUpgradeRequired,
}: {
  project: any; mode: string; prompt: string; activeChap: any;
  updateChapter: (f: string, v: any) => void;
  setErrorMsg: (msg: string | null) => void;
  setSavedMsg: (msg: string) => void;
  creatorBible: any;
  cohostVoice?: string;
  setUpgradeRequired?: (feature: string) => void;
}) {
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
    let base: string;
    if (isCreatorFormat(p.format)) { base = buildCreatorContext({ ...p, creatorBible }); }
    else { base = (p.skillLevel === "beginner" ? buildBeginnerContext : buildContext)(p); }
    const neighbourContext = buildNeighbourContext(p);
    return neighbourContext ? base + "\n\n" + neighbourContext : base;
  };

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const isCohost = mode === "cohost";
      const effectiveMode = isCohost ? "write" : mode;
      const effectiveFormat = isCohost ? "Podcast Episode (Co-host)" : project.format;
      const effectivePrompt = isCohost && cohostVoice
        ? `${prompt}\n\nCo-host voice persona: ${cohostVoice}`
        : prompt;
      const r = await callAI("generate", { mode: effectiveMode, prompt: effectivePrompt, context: buildFullContext(), format: effectiveFormat, projectId: project.id, chapterId: activeChap.id });
      if (r.error === "upgrade_required") { setUpgradeRequired?.(r.feature); }
      else if (mode === "write") { setUndoStack(s => [...s.slice(-9), activeChap.content]); updateChapter("content", activeChap.content + (activeChap.content ? "\n\n" : "") + r.text); }
      else setStreamText(r.text);
    } catch (e) { setErrorMsg("Generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
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
    catch (e) { setErrorMsg("Failed to summarize chapter. Please try again."); }
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
    } catch (e) { setErrorMsg("Agent pipeline failed. Please try again."); }
    setPipelineRunning(false);
  };

  const usePipelineOutput = (output: string) => {
    if (mode === "write") {
      setUndoStack(s => [...s.slice(-9), activeChap.content]);
      updateChapter("content", activeChap.content + (activeChap.content ? "\n\n" : "") + output);
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
        body: JSON.stringify({ text: selectedText, mode: proseMode, projectContext: buildFullContext() }),
      });
      const data = await res.json();
      setProseResult({ mode: proseMode, ...data, chosen: 0 });
    } catch (e) { setErrorMsg("Prose tool failed. Please try again."); }
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
    if (!charAId || !charBId) { setErrorMsg("Select both characters before generating dialogue."); return; }
    const p = project;
    const charA = p.characters?.find((c: any) => c.id === charAId);
    const charB = p.characters?.find((c: any) => c.id === charBId);
    if (!charA || !charB) return;
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const dialogueContext = buildDialogueContext(charA, charB, archetypeName) + "\n---\n" + buildFullContext(p);
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "dialogue", prompt: dialoguePrompt || `Write a ${archetypeName.toLowerCase()} scene between ${charA.name} and ${charB.name}.`, context: dialogueContext, format: p.format }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) {
        setUndoStack(prev => [...prev.slice(-4), activeChap?.content || ""]);
        setStreamText(data.text);
      }
    } catch (e) { setErrorMsg("Dialogue generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateCombat = async (styleA: string, styleB: string, combatPrompt: string) => {
    if (!styleA || !styleB) { setErrorMsg("Select both fighting styles before generating."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const combatCtx = buildCombatContext(styleA, styleB) + "\n---\n" + buildFullContext();
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "combat", prompt: combatPrompt || `Write a fight scene between a ${styleA} fighter and a ${styleB} fighter.`, context: combatCtx, format: project.format }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch (e) { setErrorMsg("Combat generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateEmotionalScene = async (emotionName: string, emotionalPrompt: string) => {
    if (!emotionName) { setErrorMsg("Select an emotion before generating."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const ctx = buildEmotionalContext(emotionName) + "\n---\n" + buildFullContext();
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "emotional", prompt: emotionalPrompt || `Write a scene that physicalizes ${emotionName}.`, context: ctx, format: project.format }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch (e) { setErrorMsg("Emotional scene generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateAtmosphere = async (environmentName: string, atmospherePrompt: string) => {
    if (!environmentName) { setErrorMsg("Select an environment before generating."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const ctx = buildAtmosphereContext(environmentName) + "\n---\n" + buildFullContext();
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "atmosphere", prompt: atmospherePrompt || `Write a scene set in a ${environmentName.toLowerCase()} environment.`, context: ctx, format: project.format }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch (e) { setErrorMsg("Atmosphere generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateTension = async (tensionType: string, tensionPrompt: string) => {
    if (!tensionType) { setErrorMsg("Select a tension type before generating."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const ctx = buildTensionContext(tensionType) + "\n---\n" + buildFullContext();
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "tension", prompt: tensionPrompt || `Write a scene using ${tensionType.toLowerCase()} tension structure.`, context: ctx, format: project.format }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch (e) { setErrorMsg("Tension generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateHorror = async (archetypeName: string, horrorPrompt: string) => {
    if (!archetypeName) { setErrorMsg("Select a horror archetype."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const ctx = buildHorrorContext(archetypeName) + "\n---\n" + buildFullContext();
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "horror", prompt: horrorPrompt || `Write a ${archetypeName.toLowerCase()} horror scene.`, context: ctx, format: project.format, projectId: project.id, chapterId: activeChap.id }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch { setErrorMsg("Horror generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateComedy = async (archetypeName: string, comedyPrompt: string) => {
    if (!archetypeName) { setErrorMsg("Select a comedy archetype."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const ctx = buildComedyContext(archetypeName) + "\n---\n" + buildFullContext();
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "comedy", prompt: comedyPrompt || `Write a ${archetypeName.toLowerCase()} comedy scene.`, context: ctx, format: project.format, projectId: project.id, chapterId: activeChap.id }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch { setErrorMsg("Comedy generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateMystery = async (archetypeName: string, mysteryPrompt: string) => {
    if (!archetypeName) { setErrorMsg("Select a mystery archetype."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const ctx = buildMysteryContext(archetypeName) + "\n---\n" + buildFullContext();
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "mystery", prompt: mysteryPrompt || `Write a ${archetypeName.toLowerCase()} mystery scene.`, context: ctx, format: project.format, projectId: project.id, chapterId: activeChap.id }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch { setErrorMsg("Mystery generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateRomance = async (archetypeName: string, romancePrompt: string) => {
    if (!archetypeName) { setErrorMsg("Select a romance archetype."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const ctx = buildRomanceContext(archetypeName) + "\n---\n" + buildFullContext();
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "romance", prompt: romancePrompt || `Write a ${archetypeName.toLowerCase()} romance scene.`, context: ctx, format: project.format, projectId: project.id, chapterId: activeChap.id }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch { setErrorMsg("Romance generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateAction = async (archetypeName: string, actionPrompt: string) => {
    if (!archetypeName) { setErrorMsg("Select an action archetype."); return; }
    setGenerating(true); setGenTarget("main"); setStreamText("");
    try {
      const ctx = buildActionContext(archetypeName) + "\n---\n" + buildFullContext();
      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "action", prompt: actionPrompt || `Write a ${archetypeName.toLowerCase()} action scene.`, context: ctx, format: project.format, projectId: project.id, chapterId: activeChap.id }),
      });
      const data = await res.json();
      if (data.error === "upgrade_required") { setUpgradeRequired?.(data.feature); }
      else if (data.text) setStreamText(data.text);
    } catch { setErrorMsg("Action generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const generateComposition = async (layers: CompositionLayer[], compositionPrompt: string) => {
    if (!layers.length) { setErrorMsg("Select at least one layer before generating."); return; }
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
    } catch (e) { setErrorMsg("Composition generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const scoreHook = async () => {
    if (!prompt.trim() || hookScoring) return;
    setHookScoring(true); setHookScore(null);
    try {
      const res = await fetch("/api/ai/score-hook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hook: prompt, format: project.format }) });
      const data = await res.json();
      if (data.score != null) setHookScore(data);
    } catch (e) { setErrorMsg("Hook scoring failed. Please try again."); }
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
    callAI, buildNeighbourContext, buildFullContext,
    generate, undoGeneration, autoSummarize, generateDialogue, generateCombat,
    generateEmotionalScene, generateAtmosphere, generateTension, generateComposition,
    generateHorror, generateComedy, generateMystery, generateRomance, generateAction,
    runPipeline, usePipelineOutput,
    handleTextareaSelect, runProse, replaceSelection, scoreHook,
  };
}
