"use client";
import { useState } from "react";
import { buildContext, buildBeginnerContext, buildCreatorContext } from "@/lib/ai/context-builder";
import { getPipelines, type Pipeline } from "@/lib/ai/pipelines";
import { isCreatorFormat } from "@/lib/formats";

export function useAIActions({
  project, mode, prompt, activeChap,
  updateChapter, setErrorMsg, setSavedMsg,
  creatorBible,
}: {
  project: any; mode: string; prompt: string; activeChap: any;
  updateChapter: (f: string, v: any) => void;
  setErrorMsg: (msg: string | null) => void;
  setSavedMsg: (msg: string) => void;
  creatorBible: any;
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
    if (recent.length) { parts.push("RECENT CHAPTERS:"); recent.forEach((c: any) => parts.push(`[${c.title}]: ${c.summary}`)); }
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
      const r = await callAI("generate", { mode, prompt, context: buildFullContext(), format: project.format, projectId: project.id, chapterId: activeChap.id });
      if (mode === "write") { setUndoStack(s => [...s.slice(-9), activeChap.content]); updateChapter("content", activeChap.content + (activeChap.content ? "\n\n" : "") + r.text); }
      else setStreamText(r.text);
    } catch (e) { setErrorMsg("Generation failed. Please try again."); }
    setGenerating(false); setGenTarget("");
  };

  const undoGeneration = () => {
    if (!undoStack.length) return;
    updateChapter("content", undoStack[undoStack.length - 1]);
    setUndoStack(s => s.slice(0, -1));
  };

  const saveToNotes = () => {
    if (!streamText) return;
    // updateProject is not in scope here — caller must handle notes update
    // We expose streamText and mode so the shell can do it
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
    generate, undoGeneration, saveToNotes, autoSummarize,
    runPipeline, usePipelineOutput,
    handleTextareaSelect, runProse, replaceSelection, scoreHook,
  };
}
